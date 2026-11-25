import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

interface Env {
  OPENSKY_USER?: string;
  OPENSKY_PASS?: string;
}

interface NormalizedFlight {
  icao24: string;
  callsign: string;
  originCountry: string;
  lon: number;
  lat: number;
  altitudeMeters: number;
  onGround: boolean;
  velocityKmh: number;
  heading: number;
  verticalRate: number;
  squawk: string;
}

interface AdsbV2Aircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number; // knots
  track?: number; // degrees
  baro_rate?: number; // ft/min
  squawk?: string;
  r?: string; // registration
  t?: string; // aircraft type
}

// Multi-hub scan points (250 NM radius each) to cover large regions densely
const GLOBAL_HUBS: Array<[number, number]> = [
  [28.56, 77.10], // Delhi
  [19.09, 72.86], // Mumbai
  [13.19, 77.70], // Bengaluru
  [25.25, 55.36], // Dubai
  [51.47, -0.45], // London
  [40.64, -73.78], // New York
  [35.55, 139.78], // Tokyo
  [1.36, 103.99], // Singapore
];

const INDIA_HUBS: Array<[number, number]> = [
  [28.56, 77.10], // Delhi / North
  [19.09, 72.86], // Mumbai / West
  [13.19, 77.70], // Bengaluru / South
  [22.65, 88.45], // Kolkata / East
];

async function fetchAdsbPoint(lat: number, lon: number, distNm = 250): Promise<NormalizedFlight[]> {
  const urls = [
    `https://api.adsb.lol/v2/point/${lat}/${lon}/${distNm}`,
    `https://api.airplanes.live/v2/point/${lat}/${lon}/${distNm}`,
  ];

  for (const endpoint of urls) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'User-Agent': 'ProjectTitan-Edge/2.1' },
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { ac?: AdsbV2Aircraft[] };
      if (!Array.isArray(data.ac)) continue;

      return data.ac
        .filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number' && a.hex)
        .map((a) => {
          const onGround = a.alt_baro === 'ground';
          const altFeet = typeof a.alt_baro === 'number' ? a.alt_baro : (a.alt_geom ?? 0);
          return {
            icao24: String(a.hex).toLowerCase(),
            callsign: String(a.flight || a.r || 'PRIVATE').trim() || 'PRIVATE',
            originCountry: a.t ? `Type: ${a.t}` : 'ADS-B Live',
            lat: Number(a.lat),
            lon: Number(a.lon),
            altitudeMeters: onGround ? 0 : Math.max(0, Math.round(altFeet * 0.3048)),
            onGround,
            velocityKmh: Math.round(Number(a.gs || 0) * 1.852),
            heading: Math.round(Number(a.track || 0)),
            verticalRate: Number((Number(a.baro_rate || 0) * 0.00508).toFixed(1)),
            squawk: String(a.squawk || '—'),
          };
        });
    } catch {
      // Try next provider in fallback chain
    }
  }
  return [];
}

async function fetchOpenSky(
  mode: string,
  lat: number,
  lon: number,
  radius: number,
  env: Env
): Promise<NormalizedFlight[]> {
  let openSkyUrl = 'https://opensky-network.org/api/states/all';
  if (mode !== 'global') {
    const lamin = Math.max(-85, lat - radius).toFixed(2);
    const lamax = Math.min(85, lat + radius).toFixed(2);
    const lomin = Math.max(-180, lon - radius * 1.4).toFixed(2);
    const lomax = Math.min(180, lon + radius * 1.4).toFixed(2);
    openSkyUrl += `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  }

  const headers: Record<string, string> = { 'User-Agent': 'ProjectTitan-Edge/2.1' };
  if (env.OPENSKY_USER && env.OPENSKY_PASS) {
    headers.Authorization = `Basic ${btoa(`${env.OPENSKY_USER}:${env.OPENSKY_PASS}`)}`;
  }

  try {
    const res = await fetch(openSkyUrl, { headers });
    if (!res.ok) return [];
    const raw = (await res.json()) as { states?: unknown[][] | null };

    return (raw.states || [])
      .filter((s) => typeof s[5] === 'number' && typeof s[6] === 'number')
      .map((s) => ({
        icao24: String(s[0] || '').toLowerCase(),
        callsign: String(s[1] || '').trim() || 'PRIVATE',
        originCountry: String(s[2] || 'Unknown'),
        lon: Number(s[5]),
        lat: Number(s[6]),
        altitudeMeters: Math.round(Number(s[7] ?? s[13] ?? 0)),
        onGround: Boolean(s[8]),
        velocityKmh: Math.round(Number(s[9] || 0) * 3.6),
        heading: Math.round(Number(s[10] || 0)),
        verticalRate: Number(Number(s[11] || 0).toFixed(1)),
        squawk: String(s[14] || '—'),
      }));
  } catch {
    return [];
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(context.request.url);
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached as unknown as CfResponse;

  const url = new URL(context.request.url);
  const mode = url.searchParams.get('mode') || 'region';
  const lat = parseFloat(url.searchParams.get('lat') || '22.5');
  const lon = parseFloat(url.searchParams.get('lon') || '79.0');
  const radius = Math.min(45, Math.max(1, parseFloat(url.searchParams.get('radius') || '10')));

  // Pick multi-hub scan points for maximum density
  const isIndiaSector = mode !== 'global' && lat > 8 && lat < 35 && lon > 68 && lon < 97;
  const scanPoints: Array<[number, number]> =
    mode === 'global'
      ? GLOBAL_HUBS
      : isIndiaSector
      ? INDIA_HUBS
      : [
          [lat, lon],
          [lat + 3.5, lon + 4],
          [lat - 3.5, lon - 4],
        ];

  const [adsbBatches, openSkyFlights] = await Promise.all([
    Promise.all(scanPoints.map(([pLat, pLon]) => fetchAdsbPoint(pLat, pLon, 250))),
    fetchOpenSky(mode, lat, lon, radius, context.env),
  ]);

  // Merge and deduplicate by ICAO24 hex (ADSB.lol / Airplanes.live take priority)
  const mergedMap = new Map<string, NormalizedFlight>();
  for (const batch of adsbBatches) {
    for (const f of batch) {
      mergedMap.set(f.icao24, f);
    }
  }
  for (const f of openSkyFlights) {
    if (!mergedMap.has(f.icao24)) {
      mergedMap.set(f.icao24, f);
    }
  }

  const allFlights = Array.from(mergedMap.values());
  const limit = mode === 'global' ? 800 : 500;
  const step = allFlights.length > limit ? Math.floor(allFlights.length / limit) : 1;

  const flights: NormalizedFlight[] = [];
  for (let i = 0; i < allFlights.length && flights.length < limit; i += step) {
    flights.push(allFlights[i]);
  }

  const response = new Response(
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      totalInAirspace: allFlights.length,
      flights,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=15',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );

  context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response as unknown as CfResponse;
};