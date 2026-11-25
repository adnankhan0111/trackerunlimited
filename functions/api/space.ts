import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

interface EonetEvent {
  id: string;
  title: string;
  categories?: Array<{ id: string; title: string }>;
  geometry?: Array<{ date: string; type: string; coordinates: number[] | number[][] }>;
}

interface NoaaFlare {
  max_class?: string;
  current_class?: string;
  max_time?: string;
  begin_time?: string;
}

interface NoaaScaleEntry {
  Scale?: string;
  Text?: string;
}

export const onRequestGet: PagesFunction = async (context) => {
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(context.request.url);
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached as unknown as CfResponse;

  const [eonetRes, kpRes, flaresRes, scalesRes, astrosRes] = await Promise.allSettled([
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60', {
      headers: { 'User-Agent': 'ProjectTitan-Edge/2.0' },
    }).then((r) => (r.ok ? r.json() : null)),
    fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json').then((r) =>
      r.ok ? r.json() : null
    ),
    fetch('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json').then((r) =>
      r.ok ? r.json() : null
    ),
    fetch('https://services.swpc.noaa.gov/products/noaa-scales.json').then((r) =>
      r.ok ? r.json() : null
    ),
    fetch('http://api.open-notify.org/astros.json').then((r) => (r.ok ? r.json() : null)),
  ]);

  // 1. Parse NASA EONET Active Hazards (Wildfires, Volcanoes, Storms)
  const rawEvents =
    eonetRes.status === 'fulfilled' && eonetRes.value
      ? ((eonetRes.value as { events?: EonetEvent[] }).events || [])
      : [];

  const hazards = rawEvents
    .map((ev) => {
      const latestGeo = ev.geometry?.[ev.geometry.length - 1];
      const coords = latestGeo?.coordinates;
      if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
        return null;
      }
      return {
        id: ev.id,
        title: ev.title,
        category: ev.categories?.[0]?.title || 'Natural Event',
        categoryId: ev.categories?.[0]?.id || 'other',
        lon: coords[0],
        lat: coords[1],
        date: latestGeo?.date || new Date().toISOString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // 2. Parse NOAA Planetary Kp-Index (Magnetosphere & Aurora)
  let kpIndex = 2.0;
  let kpTime = new Date().toISOString();
  if (kpRes.status === 'fulfilled' && Array.isArray(kpRes.value) && kpRes.value.length > 1) {
    const rows = kpRes.value as string[][];
    const latest = rows[rows.length - 1];
    const parsedKp = parseFloat(latest[1]);
    if (!Number.isNaN(parsedKp)) {
      kpIndex = parsedKp;
      kpTime = latest[0] || kpTime;
    }
  }

  // 3. Parse Latest Solar X-Ray Flare
  let latestFlare = { classType: 'B4.2', peakTime: new Date().toISOString() };
  if (flaresRes.status === 'fulfilled' && Array.isArray(flaresRes.value) && flaresRes.value.length > 0) {
    const f = flaresRes.value[0] as NoaaFlare;
    latestFlare = {
      classType: f.max_class || f.current_class || 'Nominal',
      peakTime: f.max_time || f.begin_time || new Date().toISOString(),
    };
  }

  // 4. Parse NOAA R / S / G Space Weather Scales
  const currentScales =
    scalesRes.status === 'fulfilled' && scalesRes.value
      ? (scalesRes.value as Record<string, { R?: NoaaScaleEntry; S?: NoaaScaleEntry; G?: NoaaScaleEntry }>)['0']
      : undefined;

  const cosmicWeather = {
    kpIndex,
    kpTime,
    auroraLevel:
      kpIndex >= 7
        ? 'Extreme (Mid-Latitudes Visible)'
        : kpIndex >= 5
        ? 'Storm (High Aurora Activity)'
        : kpIndex >= 3
        ? 'Active (Polar Circle)'
        : 'Quiet (High Arctic Only)',
    solarFlare: latestFlare,
    scales: {
      radioBlackout: `R${currentScales?.R?.Scale ?? '0'} (${currentScales?.R?.Text ?? 'none'})`,
      solarRadiation: `S${currentScales?.S?.Scale ?? '0'} (${currentScales?.S?.Text ?? 'none'})`,
      geomagnetic: `G${currentScales?.G?.Scale ?? '0'} (${currentScales?.G?.Text ?? 'none'})`,
    },
  };

  // 5. Parse Off-Earth Personnel Roster
  const astrosRaw =
    astrosRes.status === 'fulfilled' && astrosRes.value
      ? (astrosRes.value as { number?: number; people?: Array<{ name: string; craft: string }> })
      : null;

  const peopleInSpace = {
    count: astrosRaw?.number ?? 10,
    crew: astrosRaw?.people ?? [
      { name: 'ISS Expedition Crew', craft: 'ISS' },
      { name: 'Tiangong Crew', craft: 'Tiangong' },
    ],
  };

  const response = new Response(
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      hazards,
      cosmicWeather,
      peopleInSpace,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );

  context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response as unknown as CfResponse;
};