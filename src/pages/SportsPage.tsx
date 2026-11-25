import { useMemo, useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Trophy,
  Radio,
  Calendar,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  MapPin,
  Flag,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { useSeoSchema } from '../hooks/useSeoSchema';

interface TeamSide {
  name: string;
  abbr: string;
  logo: string;
  score: string;
  winner: boolean;
}

interface MatchItem {
  id: string;
  league: string;
  sport: string;
  eventTitle?: string;
  date: string;
  state: 'live' | 'upcoming' | 'completed';
  statusText: string;
  venue: string;
  home: TeamSide;
  away: TeamSide;
}

interface SportsApiResponse {
  updatedAt?: string;
  cricketConfigured?: boolean;
  total?: number;
  matches?: MatchItem[];
}

const LEAGUES = [
  { id: 'all', label: 'All Sports' },
  { id: 'cricket', label: 'Cricket (All)' },
  { id: 'soccer', label: 'Football (All)' },
  { id: 'epl', label: 'Premier League' },
  { id: 'laliga', label: 'La Liga' },
  { id: 'ucl', label: 'Champions League' },
  { id: 'nhl', label: 'Hockey (NHL)' },
  { id: 'f1', label: 'Formula 1' },
  { id: 'tennis', label: 'Tennis (ATP)' },
  { id: 'nba', label: 'NBA' },
  { id: 'ufc', label: 'UFC / MMA' },
  { id: 'nfl', label: 'NFL' },
  { id: 'mlb', label: 'MLB' },
];

const fetcher = (url: string) =>
  axios.get(url).then((r) => {
    if (typeof r.data === 'string') {
      throw new Error('Expected JSON, received HTML');
    }
    return r.data;
  });

function formatDateYmd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatInputDate(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

export function SportsPage() {
  const [league, setLeague] = useState('all');
  const [dateYmd, setDateYmd] = useState(() => formatDateYmd(0));
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, error, isLoading } = useSWR<SportsApiResponse>(
    `/api/sports?league=${league}&date=${dateYmd}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  useSeoSchema({
    title: 'Live Sports Scoreboard — Cricket, Football, Formula 1, Hockey, NBA & Global Leagues',
    description:
      'Real-time live sports scores, completed match results, and upcoming schedules across Cricket, Premier League, Champions League, Formula 1, NHL, Tennis, UFC, NBA, and NFL.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'SportsOrganization',
      name: 'Project Titan Live Sports Telemetry',
    },
  });

  const matches = useMemo(() => data?.matches ?? [], [data]);
  const showCricketSetupNotice =
    !error && league === 'cricket' && data !== undefined && data.cricketConfigured === false;

  const counts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let completed = 0;
    for (const m of matches) {
      if (m.state === 'live') live += 1;
      else if (m.state === 'upcoming') upcoming += 1;
      else completed += 1;
    }
    return { live, upcoming, completed };
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (statusFilter !== 'all' && m.state !== statusFilter) return false;
      if (!q) return true;
      return (
        m.home.name.toLowerCase().includes(q) ||
        m.away.name.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q) ||
        m.sport.toLowerCase().includes(q) ||
        (m.eventTitle && m.eventTitle.toLowerCase().includes(q))
      );
    });
  }, [matches, statusFilter, searchQuery]);

  const datePresets = useMemo(
    () => [
      { label: 'Yesterday', ymd: formatDateYmd(-1) },
      { label: 'Today (Live)', ymd: formatDateYmd(0) },
      { label: 'Tomorrow', ymd: formatDateYmd(1) },
      { label: '+2 Days', ymd: formatDateYmd(2) },
      { label: '+3 Days', ymd: formatDateYmd(3) },
    ],
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"
    >
      {/* Top Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Live Matches
          </span>
          <span className="text-xl font-bold text-rose-400">{counts.live}</span>
        </div>
        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Upcoming Fixtures
          </span>
          <span className="text-xl font-bold text-cyan-400">{counts.upcoming}</span>
        </div>
        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Completed Results
          </span>
          <span className="text-xl font-bold text-emerald-400">{counts.completed}</span>
        </div>
        <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4">
          <span className="text-slate-400 flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> Total on Matchday
          </span>
          <span className="text-xl font-bold text-white">{matches.length}</span>
        </div>
      </div>

      {/* Controls Card */}
      <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Global Live Sports &amp; Fixtures Hub
            </h1>
            <p className="text-xs text-slate-400">
              30-second live scoreboards, past results &amp; future schedules across Cricket, Football, Formula 1, Hockey &amp; more
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team, GP, or league..."
                className="bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none w-48 sm:w-56"
              />
            </div>

            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              30s LIVE
            </span>
          </div>
        </div>

        {/* League Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLeague(l.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                league === l.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-cyan-500/50'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Date & Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
            {datePresets.map((p) => (
              <button
                key={p.ymd}
                type="button"
                onClick={() => setDateYmd(p.ymd)}
                className={`px-2.5 py-1 rounded-lg font-mono transition cursor-pointer ${
                  dateYmd === p.ymd
                    ? 'bg-slate-100 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Pick match date"
              value={formatInputDate(dateYmd)}
              onChange={(e) => {
                if (e.target.value) setDateYmd(e.target.value.replace(/-/g, ''));
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            {(['all', 'live', 'upcoming', 'completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg uppercase transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* API Error Banner (e.g. running on localhost:5173 without Wrangler) */}
      {error && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200 font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-rose-300 block mb-0.5">Live Sports API Offline</strong>
            <span>
              Could not reach <code>/api/sports</code>. Deploy to Cloudflare Pages or run{' '}
              <code>npx wrangler pages dev dist</code> locally to load live scoreboards.
            </span>
          </div>
        </div>
      )}

      {/* Cricket API Key Setup Notice */}
      {showCricketSetupNotice && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-5 flex items-start gap-3 text-xs text-amber-100">
          <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h2 className="font-bold text-amber-300 uppercase tracking-wider">
              Enable Live Cricket Feed (Free 1-Minute Setup)
            </h2>
            <p className="text-slate-300 leading-relaxed">
              International, IPL, and domestic cricket scores require a free API key from{' '}
              <a
                href="https://cricketdata.org"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                cricketdata.org
              </a>
              . Add it in your <strong>Cloudflare Pages Dashboard -&gt; Settings -&gt; Environment Variables</strong>{' '}
              as <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300">CRICKETDATA_API_KEY</code> and redeploy.
            </p>
          </div>
        </div>
      )}

      {/* Matches Grid */}
      {!showCricketSetupNotice && filteredMatches.length === 0 ? (
        <div className="bg-[#0d1323] border border-slate-800 rounded-2xl p-10 text-center font-mono text-xs text-slate-400">
          {isLoading
            ? 'Syncing live global scoreboards...'
            : 'No matches scheduled for this league and date. Try another league or pick a different date.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((m) => (
            <div
              key={m.id}
              className={`bg-[#0d1323] border rounded-2xl p-4 shadow-lg space-y-3 transition ${
                m.state === 'live'
                  ? 'border-rose-500/40'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 truncate max-w-[62%]">{m.league}</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                    m.state === 'live'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : m.state === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {m.state === 'live' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  )}
                  {m.statusText}
                </span>
              </div>

              {/* Formula 1 Grand Prix / UFC Event Title Banner */}
              {m.eventTitle && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{m.eventTitle}</span>
                </div>
              )}

              {/* Teams / Drivers & Scores */}
              <div className="space-y-2.5 font-mono text-xs">
                {[m.home, m.away].map((team, idx) => (
                  <div
                    key={`${m.id}-${idx}`}
                    className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.abbr}
                          className="w-5 h-5 object-contain shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[9px] flex items-center justify-center text-slate-300 shrink-0">
                          {team.abbr.slice(0, 2)}
                        </span>
                      )}
                      <span
                        className={`truncate ${
                          team.winner ? 'font-bold text-white' : 'text-slate-200'
                        }`}
                      >
                        {team.name}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-bold ml-2 shrink-0 ${
                        m.state === 'upcoming'
                          ? 'text-slate-500'
                          : team.winner
                          ? 'text-emerald-400'
                          : 'text-white'
                      }`}
                    >
                      {m.state === 'upcoming' ? '—' : team.score}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer: Kickoff & Venue */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                <span className="truncate max-w-[65%] flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" /> {m.venue}
                </span>
                <span>
                  {new Date(m.date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}