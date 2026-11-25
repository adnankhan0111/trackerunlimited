import { Link } from 'react-router-dom';
import { Radio, ShieldCheck, Database, ExternalLink } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-slate-800/80 bg-[#080d1a] text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
        {/* Brand & Edge Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-100">
              PROJECT <span className="text-cyan-400">TITAN</span>
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed max-w-xs">
            Real-time global telemetry dashboard delivering live hyper-local radar, ADS-B aviation
            tracking, NASA satellite Earth observation, ISS orbital vectors, and 1-second financial
            streams across 160+ currencies.
          </p>
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <Radio className="w-3.5 h-3.5" />
            Cloudflare Edge Network • Online
          </div>
        </div>

        {/* Navigation & Endpoints */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              Dashboards
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="hover:text-cyan-400 transition">
                  Master Grid
                </Link>
              </li>
              <li>
                <Link to="/transit" className="hover:text-cyan-400 transition">
                  Flight Radar
                </Link>
              </li>
              <li>
                <Link to="/sports" className="hover:text-cyan-400 transition">
                  Live Sports
                </Link>
              </li>
              <li>
                <Link to="/finance" className="hover:text-cyan-400 transition">
                  Finance &amp; Gold
                </Link>
              </li>
              <li>
                <Link to="/space" className="hover:text-cyan-400 transition">
                  Space Cockpit
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              Open Data &amp; AI
            </h3>
            <ul className="space-y-2 font-mono text-[11px]">
              <li>
                <a
                  href="/api/summary"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition inline-flex items-center gap-1"
                >
                  /api/summary <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="/api/flights"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition inline-flex items-center gap-1"
                >
                  /api/flights <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="/api/space"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition inline-flex items-center gap-1"
                >
                  /api/space <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="/llms.txt"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition inline-flex items-center gap-1"
                >
                  /llms.txt <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 transition inline-flex items-center gap-1"
                >
                  /sitemap.xml <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Live Data Sources & Disclaimer */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" /> Telemetry Feeds
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Powered by public streams from OpenStreetMap, ADSB.lol, Airplanes.live, OpenSky
            Network, NASA GIBS/EONET, NOAA SWPC, Open-Meteo, WhereTheISSAt, and Binance WebSocket.
          </p>
          <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Market prices, metal rates, space weather, and radar feeds are for informational
              telemetry only—not financial or navigational advice.
            </span>
          </p>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="border-t border-slate-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
          <span>© {year} Project Titan (trackerunlimited.pages.dev). All rights reserved.</span>
          <span>Zero-Latency Static Edge Architecture</span>
        </div>
      </div>
    </footer>
  );
}