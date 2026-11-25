import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import useSWR from 'swr';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Radio,
  Rocket,
  TrendingUp,
  CloudSun,
  Globe,
  LayoutGrid,
  Plane,
  Trophy,
  Coins,
  Satellite,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useTelemetry } from './hooks/useTelemetry';
import { useRealtimeCrypto, type LiveAssetTick } from './hooks/useRealtimeCrypto';
import { useTitanStore } from './store/useTitanStore';
import { useSeoSchema } from './hooks/useSeoSchema';
import { LocalMapCard } from './components/LocalMapCard';
import { TransitPage } from './pages/TransitPage';
import { SportsPage } from './pages/SportsPage';
import { FinancePage } from './pages/FinancePage';
import { SpacePage } from './pages/SpacePage';
import { Footer } from './components/Footer';

interface LiveIssData {
  latitude: number;
  longitude: number;
  velocity: number;
  altitude: number;
}

const issFetcher = (url: string) => axios.get<LiveIssData>(url).then((res) => res.data);
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

function LiveAssetRow({
  name,
  tick,
  fallbackUsd,
  rate,
  currencyCode,
}: {
  name: string;
  tick?: LiveAssetTick;
  fallbackUsd?: number;
  rate: number;
  currencyCode: string;
}) {
  const usdPrice = tick?.price ?? fallbackUsd;
  const dir = tick?.direction ?? 'neutral';
  const colorClass =
    dir === 'up'
      ? 'text-emerald-400'
      : dir === 'down'
      ? 'text-rose-400'
      : 'text-slate-100';

  return (
    <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800/80 transition-colors">
      <div>
        <span className="font-bold text-slate-200 block">{name}</span>
        {tick && (
          <span className={`text-[10px] ${tick.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            24h: {tick.change24h >= 0 ? '+' : ''}
            {tick.change24h.toFixed(2)}%
          </span>
        )}
      </div>
      <div className={`flex items-center gap-1.5 text-sm font-bold ${colorClass}`}>
        {dir === 'up' && <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />}
        {dir === 'down' && <ArrowDown className="w-3.5 h-3.5 text-rose-400" />}
        <span>{formatPrice(usdPrice, rate, currencyCode)}</span>
      </div>
    </div>
  );
}

function MasterDashboard() {
  const { data } = useTelemetry();
  const liveCrypto = useRealtimeCrypto();
  const { currency, coords } = useTitanStore();

  // Live 2-second ISS orbital coordinates
  const { data: liveIss } = useSWR<LiveIssData>(
    'https://api.wheretheiss.at/v1/satellites/25544',
    issFetcher,
    { refreshInterval: 2000 }
  );

  const iss = liveIss || data?.iss;

  useSeoSchema({
    title: 'Project Titan — Live Local Incident Map, Flight Radar & Global Telemetry',
    description:
      'Real-time hyper-local event map, community incident alerts, live ISS orbital tracker, flight radar, and 1-second cryptocurrency prices in 160+ world currencies.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Project Titan Real-Time Telemetry Stream',
      description: 'Live edge-cached geospatial incidents, ISS coordinates, and global financial indices.',
      temporalCoverage: '2026/..',
    },
  });

  const selectedCode = currency.toUpperCase();
  const rates: Record<string, number> = data?.rates || {
    INR: 84.5,
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
  };
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
            {data?.weather
              ? `${data.weather.temperature_2m}°C, Wind ${data.weather.wind_speed_10m} km/h`
              : 'Syncing local sensors...'}
          </span>
          <span className="font-mono text-cyan-300">
            1 USD = {currentRate.toFixed(2)} {selectedCode} | ISS:{' '}
            {iss ? `${iss.latitude.toFixed(4)}°, ${iss.longitude.toFixed(4)}°` : 'Tracking...'}
          </span>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LocalMapCard />

        <div className="space-y-6">
          {/* ISS Orbital Telemetry (2s Live) */}
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Rocket className="w-4 h-4" /> ISS Orbital Telemetry
              </h2>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                2s LIVE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Latitude</span>
                <span className="text-base font-bold text-white">
                  {iss ? `${iss.latitude.toFixed(4)}°` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Longitude</span>
                <span className="text-base font-bold text-white">
                  {iss ? `${iss.longitude.toFixed(4)}°` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Velocity</span>
                <span className="text-sm font-semibold text-cyan-300">
                  {iss ? `${Math.round(iss.velocity).toLocaleString()} km/h` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block">Altitude</span>
                <span className="text-sm font-semibold text-cyan-300">
                  {iss ? `${iss.altitude.toFixed(1)} km` : '—'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* 1-Second Live WebSocket Assets */}
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
                {liveCrypto.connected ? `Tick: ${liveCrypto.lastTick}` : 'Connecting...'}
              </span>
            </div>
            <div className="space-y-2.5 font-mono text-xs">
              <LiveAssetRow
                name="Bitcoin (BTC)"
                tick={liveCrypto.bitcoin}
                fallbackUsd={btcUsd}
                rate={currentRate}
                currencyCode={selectedCode}
              />
              <LiveAssetRow
                name="Ethereum (ETH)"
                tick={liveCrypto.ethereum}
                fallbackUsd={ethUsd}
                rate={currentRate}
                currencyCode={selectedCode}
              />
              <LiveAssetRow
                name="Solana (SOL)"
                tick={liveCrypto.solana}
                fallbackUsd={solUsd}
                rate={currentRate}
                currencyCode={selectedCode}
              />
            </div>
          </motion.div>

          {/* Micro-Weather Telemetry */}
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
  const { data } = useTelemetry();
  const { currency, setCurrency } = useTitanStore();

  const selectedCode = currency.toUpperCase();
  const rates: Record<string, number> = data?.rates || {
    INR: 84.5,
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
  };
  const availableCurrencies = Object.keys(rates).sort();

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
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
              <nav className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs">
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
                <NavLink
                  to="/finance"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                      isActive ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  <Coins className="w-3.5 h-3.5" /> Finance &amp; Gold
                </NavLink>
                <NavLink
                  to="/space"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition ${
                      isActive ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  <Satellite className="w-3.5 h-3.5" /> Space Cockpit
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

              <span className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-slate-900/90 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE 1s STREAM
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1">
          <Routes>
            <Route path="/" element={<MasterDashboard />} />
            <Route path="/transit" element={<TransitPage />} />
            <Route path="/sports" element={<SportsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/space" element={<SpacePage />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}