import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

interface IssResponse {
  latitude: number;
  longitude: number;
  velocity: number;
  altitude: number;
}

interface WeatherResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

interface CryptoResponse {
  bitcoin?: { usd: number; usd_24h_change?: number };
  ethereum?: { usd: number; usd_24h_change?: number };
  solana?: { usd: number; usd_24h_change?: number };
}

interface ForexResponse {
  rates: Record<string, number>;
}

export const onRequestGet: PagesFunction = async (context) => {
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(context.request.url);
  const cachedResponse = await edgeCache.match(cacheKey);

  if (cachedResponse) {
    return cachedResponse as unknown as CfResponse;
  }

  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat') || '25.3176';
  const lon = url.searchParams.get('lon') || '82.9739';

  try {
    const [issRes, weatherRes, cryptoRes, forexRes] = await Promise.all([
      fetch('https://api.wheretheiss.at/v1/satellites/25544'),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code`
      ),
      fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
        {
          headers: { 'User-Agent': 'ProjectTitan-Edge/1.0' },
        }
      ),
      fetch('https://open.er-api.com/v6/latest/USD'),
    ]);

    const iss = (await issRes.json()) as IssResponse;
    const weather = (await weatherRes.json()) as WeatherResponse;
    const crypto = (await cryptoRes.json()) as CryptoResponse;
    const forex = (await forexRes.json()) as ForexResponse;

    const payload = {
      updatedAt: new Date().toISOString(),
      iss,
      weather: weather.current,
      crypto,
      rates: forex.rates,
    };

    const response = new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=15',
        'Access-Control-Allow-Origin': '*',
      },
    });

    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    return response as unknown as CfResponse;
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream telemetry timeout' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as CfResponse;
  }
};