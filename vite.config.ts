import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function localEdgeApiPlugin(): Plugin {
  return {
    name: 'local-edge-api',
    configureServer(server) {
      server.middlewares.use('/api/summary', async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost');
        const lat = url.searchParams.get('lat') || '25.3176';
        const lon = url.searchParams.get('lon') || '82.9739';

        try {
          const [issRes, weatherRes, cryptoRes, forexRes] = await Promise.all([
            fetch('https://api.wheretheiss.at/v1/satellites/25544'),
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code`
            ),
            fetch(
              'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'
            ),
            fetch('https://open.er-api.com/v6/latest/USD'),
          ]);

          const [iss, weather, crypto, forex] = await Promise.all([
            issRes.json(),
            weatherRes.json(),
            cryptoRes.json(),
            forexRes.json(),
          ]);

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              updatedAt: new Date().toISOString(),
              iss,
              weather: (weather as { current: unknown }).current,
              crypto,
              rates: (forex as { rates: Record<string, number> }).rates,
            })
          );
        } catch {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'Upstream telemetry timeout' }));
        }
      });
      server.middlewares.use('/api/flights', async (req, res) => {
  const url = new URL(req.url || '', 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat') || '25.3176');
  const lon = parseFloat(url.searchParams.get('lon') || '82.9739');

  const lamin = (lat - 3.5).toFixed(2);
  const lamax = (lat + 3.5).toFixed(2);
  const lomin = (lon - 3.5).toFixed(2);
  const lomax = (lon + 3.5).toFixed(2);

  try {
    const apiRes = await fetch(
      `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
    );
    const raw = (await apiRes.json()) as { states: unknown[][] | null };

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

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ updatedAt: new Date().toISOString(), flights }));
  } catch {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ updatedAt: new Date().toISOString(), flights: [] }));
  }
});
    },
  };
}



export default defineConfig({
  plugins: [react(), tailwindcss(), localEdgeApiPlugin()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
});