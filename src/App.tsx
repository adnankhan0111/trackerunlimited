import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Rocket, TrendingUp, CloudSun, RefreshCw, Globe, LayoutGrid, Plane, Trophy } from 'lucide-react';
import { useTelemetry } from './hooks/useTelemetry';
import { useTitanStore } from './store/useTitanStore';
import { useSeoSchema } from './hooks/useSeoSchema';
import { LocalMapCard } from './components/LocalMapCard';
import { TransitPage } from './pages/TransitPage';
import { SportsPage } from './pages/SportsPage';

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

function getCurrencyLabel(code: string): string {
  try {
    return currencyNames.of(code) || code;
  } catch {
    return code;
  }
}

function formatPrice(usdAmount: number | undefined, rate: number, currencyCode: string): string {
  if (usdAmount === undefined) return 'Loading...';
  const converted = usdAmount * rate;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: converted < 10 ? 4 : 2,
    }).format(converted);
  } catch {
    return `${currencyCode} ${converted.toLocaleString()}`;
  }
}

function MasterDashboard() {
  const { data } = useTelemetry();
  const { currency, coords } = useTitanStore();

  useSeoSchema({
    title: 'Project Titan — Live Local Incident Map, Flight Radar & Global Telemetry',
    description:
      'Real-time hyper-local event map, community incident alerts, live ISS orbital tracker, flight radar, and cryptocurrency prices in 160+ world currencies.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Project Titan Real-Time Telemetry Stream',
      description: 'Live edge-cached geospatial incidents, ISS coordinates, and global financial indices.',
      temporalCoverage: '2026/..',
    },
  });

  const selectedCode = currency.toUpperCase();
  const rates: Record<string, number> = data?.rates || { INR: 84.5, USD: 1, EUR: 0.92, GBP: 0.79, AED: 3.67 };
  const currentRate = rates[selectedCode] ?? 1;

  const btcUsd = data?.crypto?.bitcoin?.usd;
  const ethUsd = data?.crypto?.ethereum?.usd;
  const solUsd = data?.crypto?.solana?.usd;

  return (
    <>
      <section aria-label="Live Telemetry Summary" className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-indigo-950/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <strong>Live Status ({coords.label}):</strong>{' '}
            {data?.weather ? `${data.weather.temperature_2m}°C, Wind ${data.weather.wind_speed_10m} km/h` : 'Syncing local sensors...'}
          </span>
          <span className="font-mono text-cyan-300">
            1 USD = {currentRate.toFixed(2)} {selectedCode} | ISS: {data?.iss ? `${data.iss.latitude.toFixed(2)}°, ${data.iss.longitude.toFixed(2)}°` : 'Tracking...'}
          </span>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LocalMapCard />

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2 mb-3">
              <Rocket className="w-4 h-4" /> ISS Orbital Telemetry
            </h2>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Latitude</span>
                <span className="text-base font-bold text-white">
                  {data?.iss ? `${data.iss.latitude.toFixed(4)}°` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Longitude</span>
                <span className="text-base font-bold text-white">
                  {data?.iss ? `${data.iss.longitude.toFixed(4)}°` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Velocity</span>
                <span className="text-sm font-semibold text-cyan-300">
                  {data?.iss ? `${Math.round(data.iss.velocity).toLocaleString()} km/h` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Altitude</span>
                <span className="text-sm font-semibold text-cyan-300">
                  {data?.iss ? `${data.iss.altitude.toFixed(1)} km` : '—'}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Live Assets ({selectedCode})
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                1 USD = {currentRate.toFixed(2)} {selectedCode}
              </span>
            </div>
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="font-bold text-slate-200">Bitcoin (BTC)</span>
                <span className="text-sm font-bold text-emerald-400">
                  {formatPrice(btcUsd, currentRate, selectedCode)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="font-bold text-slate-200">Ethereum (ETH)</span>
                <span className="text-sm font-bold text-emerald-400">
                  {formatPrice(ethUsd, currentRate, selectedCode)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="font-bold text-slate-200">Solana (SOL)</span>
                <span className="text-sm font-bold text-emerald-400">
                  {formatPrice(solUsd, currentRate, selectedCode)}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between"
          >
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-1">
                <CloudSun className="w-4 h-4" /> Local Atmospheric Sensor
              </h2>
              <p className="text-xs text-slate-400">{coords.label}</p>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-bold text-white">
                {data?.weather ? `${data.weather.temperature_2m}°C` : '--'}
              </span>
              <span className="block text-[11px] text-slate-400">
                Wind: {data?.weather ? `${data.weather.wind_speed_10m} km/h` : '--'}
              </span>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}

export default function App() {
  const { data, isLoading } = useTelemetry();
  const { currency, setCurrency } = useTitanStore();

  const selectedCode = currency.toUpperCase();
  const rates: Record<string, number> = data?.rates || { INR: 84.5, USD: 1, EUR: 0.92, GBP: 0.79, AED: 3.67 };
  const availableCurrencies = Object.keys(rates).sort();

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#060913] text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#060913]/85 border-b border-slate-800/80 px-4 sm:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-lg sm:text-xl font-bold tracking-tight">
                  PROJECT <span className="text-cyan-400">TITAN</span>
                </span>
              </div>

              {/* Multi-Page Navigation Links */}
              <nav className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                      isActive ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Master Grid
                </NavLink>
                <NavLink
                  to="/transit"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                      isActive ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  <Plane className="w-3.5 h-3.5" /> Flight Radar
                </NavLink>
                <NavLink
                  to="/sports"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                      isActive ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  <Trophy className="w-3.5 h-3.5" /> Live Sports
                </NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-cyan-500 px-3 py-1.5 rounded-lg transition">
                <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <select
                  aria-label="Select World Currency"
                  value={selectedCode}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-xs font-mono text-slate-100 focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[220px]"
                >
                  {availableCurrencies.map((code) => (
                    <option key={code} value={code} className="bg-slate-900 text-slate-100">
                      {code} — {getCurrencyLabel(code)}
                    </option>
                  ))}
                </select>
              </div>

              <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg">
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
                Edge Sync 15s
              </span>
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<MasterDashboard />} />
          <Route path="/transit" element={<TransitPage />} />
          <Route path="/sports" element={<SportsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}