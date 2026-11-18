import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

export const onRequestGet: PagesFunction = async (context) => {
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(context.request.url);
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached as unknown as CfResponse;

  const url = new URL(context.request.url);
  const lat = parseFloat(url.searchParams.get('lat') || '25.3176');
  const lon = parseFloat(url.searchParams.get('lon') || '82.9739');

  // Bounding box (~400km radius around user's selected sector)
  const lamin = (lat - 3.5).toFixed(2);
  const lamax = (lat + 3.5).toFixed(2);
  const lomin = (lon - 3.5).toFixed(2);
  const lomax = (lon + 3.5).toFixed(2);

  try {
    const res = await fetch(
      `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`,
      { headers: { 'User-Agent': 'ProjectTitan-Edge/1.0' } }
    );
    const raw = (await res.json()) as { time: number; states: unknown[][] | null };

    const flights = (raw.states || []).slice(0, 35).map((s) => ({
      icao24: String(s[0] || ''),
      callsign: String(s[1] || 'N/A').trim() || 'PRIVATE',
      originCountry: String(s[2] || 'Unknown'),
      lon: Number(s[5] || 0),
      lat: Number(s[6] || 0),
      altitudeMeters: Math.round(Number(s[7] || 0)),
      velocityKmh: Math.round(Number(s[9] || 0) * 3.6),
      heading: Math.round(Number(s[10] || 0)),
    }));

    const response = new Response(JSON.stringify({ updatedAt: new Date().toISOString(), flights }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=15',
        'Access-Control-Allow-Origin': '*',
      },
    });

    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    return response as unknown as CfResponse;
  } catch {
    return new Response(JSON.stringify({ updatedAt: new Date().toISOString(), flights: [] }), {
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as CfResponse;
  }
};