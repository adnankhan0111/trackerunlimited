import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Timer } from 'lucide-react';
import { useSeoSchema } from '../hooks/useSeoSchema';

type SportTab = 'Cricket' | 'Football' | 'Formula 1';

const LIVE_FIXTURES = {
  Cricket: [
    {
      id: 'cric-1',
      series: 'ICC World Test Championship',
      status: 'LIVE • Day 3, Session 2',
      teamA: 'India',
      scoreA: '342/6 (88.4 ov)',
      teamB: 'Australia',
      scoreB: '298 all out',
      commentary: 'Last Ball: 4 runs — Driven cleanly through extra cover.',
    },
    {
      id: 'cric-2',
      series: 'International T20 Series',
      status: 'LIVE • 2nd Innings',
      teamA: 'England',
      scoreA: '184/5 (20.0 ov)',
      teamB: 'South Africa',
      scoreB: '141/3 (15.2 ov)',
      commentary: 'Required: 44 runs from 28 balls (RRR: 9.42)',
    },
  ],
  Football: [
    {
      id: 'fb-1',
      series: 'UEFA Champions League',
      status: "LIVE • 68'",
      teamA: 'Real Madrid',
      scoreA: '2',
      teamB: 'Arsenal',
      scoreB: '1',
      commentary: 'Possession: 54% - 46% | Shots on Target: 7 - 5',
    },
    {
      id: 'fb-2',
      series: 'Premier League',
      status: "LIVE • 42'",
      teamA: 'Liverpool',
      scoreA: '1',
      teamB: 'Manchester City',
      scoreB: '1',
      commentary: 'Possession: 49% - 51% | Corners: 4 - 3',
    },
  ],
  'Formula 1': [
    {
      id: 'f1-1',
      series: 'Grand Prix — Qualifying Telemetry',
      status: 'LIVE • Q3 Session',
      teamA: 'P1: M. Verstappen',
      scoreA: '1:28.412',
      teamB: 'P2: L. Norris',
      scoreB: '+0.084s',
      commentary: 'Track Temp: 34°C | Sector 3 Purple: C. Leclerc',
    },
  ],
};

export const SportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SportTab>('Cricket');

  useSeoSchema({
    title: 'Live International Sports Scorecards (Cricket, Football, F1) — Project Titan',
    description: 'Real-time ball-by-ball cricket scores, European football match clocks, and Formula 1 timing telemetry.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'LiveBlogPosting',
      headline: 'Live International Sports Telemetry & Scorecards',
    },
  });

  const tabs: SportTab[] = ['Cricket', 'Football', 'Formula 1'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d1323] border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> International Sports Telemetry Center
          </h2>
          <p className="text-xs text-slate-400">Zero-video ultra-fast match scorelines & live intervals</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === tab ? 'text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="sports-tab-pill"
                  className="absolute inset-0 bg-cyan-400 rounded-lg -z-0"
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LIVE_FIXTURES[activeTab].map((match) => (
          <motion.div
            key={match.id}
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0d1323] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">{match.series}</span>
              <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-mono">
                <Flame className="w-3 h-3" /> {match.status}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{match.teamA}</span>
                <span className="text-sm font-bold text-cyan-400">{match.scoreA}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">{match.teamB}</span>
                <span className="text-sm font-bold text-emerald-400">{match.scoreB}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
              <Timer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{match.commentary}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};