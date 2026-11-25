import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

interface Env {
  CRICKETDATA_API_KEY?: string;
}

interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  order?: number;
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  athlete?: {
    displayName?: string;
    shortName?: string;
    flag?: { href?: string };
  };
}

interface EspnEvent {
  id: string;
  name?: string;
  shortName?: string;
  date?: string;
  status?: {
    type?: {
      state?: 'pre' | 'in' | 'post';
      shortDetail?: string;
      description?: string;
    };
  };
  competitions?: Array<{
    venue?: { fullName?: string };
    competitors?: EspnCompetitor[];
  }>;
}

interface CricApiMatch {
  id: string;
  dateTimeGMT?: string;
  matchType?: string;
  status?: string;
  ms?: 'live' | 'fixture' | 'result';
  t1?: string;
  t2?: string;
  t1s?: string;
  t2s?: string;
  t1img?: string;
  t2img?: string;
  series?: string;
}

interface NormalizedMatch {
  id: string;
  league: string;
  sport: string;
  eventTitle?: string;
  date: string;
  state: 'live' | 'upcoming' | 'completed';
  statusText: string;
  venue: string;
  home: { name: string; abbr: string; logo: string; score: string; winner: boolean };
  away: { name: string; abbr: string; logo: string; score: string; winner: boolean };
}

const ESPN_LEAGUES: Record<string, { label: string; sport: string; path: string }> = {
  soccer: { label: 'All Football Leagues', sport: 'Football', path: 'soccer/all' },
  epl: { label: 'Premier League', sport: 'Football', path: 'soccer/eng.1' },
  laliga: { label: 'La Liga', sport: 'Football', path: 'soccer/esp.1' },
  ucl: { label: 'Champions League', sport: 'Football', path: 'soccer/uefa.champions' },
  nhl: { label: 'NHL Hockey', sport: 'Hockey', path: 'hockey/nhl' },
  f1: { label: 'Formula 1', sport: 'Formula Racing', path: 'racing/f1' },
  nba: { label: 'NBA Basketball', sport: 'Basketball', path: 'basketball/nba' },
  tennis: { label: 'ATP Tennis', sport: 'Tennis', path: 'tennis/atp' },
  ufc: { label: 'UFC / MMA', sport: 'Combat', path: 'mma/ufc' },
  nfl: { label: 'NFL', sport: 'American Football', path: 'football/nfl' },
  mlb: { label: 'MLB', sport: 'Baseball', path: 'baseball/mlb' },
};

function isTodayDateParam(dateParam: string | null): boolean {
  if (!dateParam || dateParam === 'today') return true;
  const now = new Date();
  const todayUtc = now.toISOString().slice(0, 10).replace(/-/g, '');
  const todayIst = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  return dateParam === todayUtc || dateParam === todayIst;
}

async function fetchEspnLeague(
  key: string,
  dateParam: string | null
): Promise<NormalizedMatch[]> {
  const cfg = ESPN_LEAGUES[key];
  if (!cfg) return [];

  // Skip strict ?dates= on today's live slate and multi-day weekend sports (F1, UFC, Tennis)
  const useDate = !isTodayDateParam(dateParam) && key !== 'f1' && key !== 'ufc' && key !== 'tennis';
  const query = useDate && dateParam ? `?dates=${encodeURIComponent(dateParam)}&limit=100` : '?limit=100';
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/scoreboard${query}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ProjectTitan-Edge/2.2',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return [];

    const raw = (await res.json()) as {
      leagues?: Array<{ name?: string }>;
      events?: EspnEvent[];
    };
    const defaultLeagueName = raw.leagues?.[0]?.name || cfg.label;

    return (raw.events || []).map((ev) => {
      const comp = ev.competitions?.[0];
      const competitors = comp?.competitors || [];
      const homeRaw = competitors.find((c) => c.homeAway === 'home') || competitors[0];
      const awayRaw = competitors.find((c) => c.homeAway === 'away') || competitors[1];

      const rawState = ev.status?.type?.state;
      const state: 'live' | 'upcoming' | 'completed' =
        rawState === 'in' ? 'live' : rawState === 'post' ? 'completed' : 'upcoming';

      const getName = (c?: EspnCompetitor, fallback = 'TBD') =>
        c?.team?.shortDisplayName ||
        c?.team?.displayName ||
        c?.athlete?.shortName ||
        c?.athlete?.displayName ||
        fallback;

      const getLogo = (c?: EspnCompetitor) => c?.team?.logo || c?.athlete?.flag?.href || '';

      return {
        id: `${key}-${ev.id}`,
        league: defaultLeagueName,
        sport: cfg.sport,
        eventTitle: key === 'f1' || key === 'ufc' ? ev.name || ev.shortName : undefined,
        date: ev.date || new Date().toISOString(),
        state,
        statusText: ev.status?.type?.shortDetail || ev.status?.type?.description || 'Scheduled',
        venue: comp?.venue?.fullName || 'Global Venue',
        home: {
          name: getName(homeRaw, key === 'f1' ? 'P1 / Pole' : 'Home'),
          abbr: homeRaw?.team?.abbreviation || 'P1',
          logo: getLogo(homeRaw),
          score: homeRaw?.score ?? (key === 'f1' ? 'P1' : '0'),
          winner: Boolean(homeRaw?.winner),
        },
        away: {
          name: getName(awayRaw, key === 'f1' ? 'P2 / Grid' : 'Away'),
          abbr: awayRaw?.team?.abbreviation || 'P2',
          logo: getLogo(awayRaw),
          score: awayRaw?.score ?? (key === 'f1' ? 'P2' : '0'),
          winner: Boolean(awayRaw?.winner),
        },
      };
    });
  } catch {
    return [];
  }
}

async function fetchCricket(apiKey?: string): Promise<NormalizedMatch[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://api.cricapi.com/v1/cricScore?apikey=${encodeURIComponent(apiKey)}`,
      {
        headers: {
          'User-Agent': 'ProjectTitan-Edge/2.2',
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as { data?: CricApiMatch[] };

    return (raw.data || []).slice(0, 40).map((m) => {
      const state: 'live' | 'upcoming' | 'completed' =
        m.ms === 'live' ? 'live' : m.ms === 'result' ? 'completed' : 'upcoming';

      return {
        id: `cricket-${m.id}`,
        league: m.series || `${(m.matchType || 'CRICKET').toUpperCase()} Series`,
        sport: 'Cricket',
        date: m.dateTimeGMT ? `${m.dateTimeGMT}Z` : new Date().toISOString(),
        state,
        statusText: m.status || (state === 'live' ? 'LIVE' : 'Scheduled'),
        venue: m.matchType ? m.matchType.toUpperCase() : 'International',
        home: {
          name: m.t1 || 'Team 1',
          abbr: (m.t1 || 'T1').slice(0, 3).toUpperCase(),
          logo: m.t1img || '',
          score: m.t1s || '—',
          winner: false,
        },
        away: {
          name: m.t2 || 'Team 2',
          abbr: (m.t2 || 'T2').slice(0, 3).toUpperCase(),
          logo: m.t2img || '',
          score: m.t2s || '—',
          winner: false,
        },
      };
    });
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
  const league = url.searchParams.get('league') || 'all';
  const dateParam = url.searchParams.get('date');

  const tasks: Promise<NormalizedMatch[]>[] = [];

  if (league === 'all') {
    tasks.push(fetchCricket(context.env.CRICKETDATA_API_KEY));
    for (const k of ['soccer', 'nhl', 'f1', 'nba', 'tennis', 'ufc', 'nfl']) {
      tasks.push(fetchEspnLeague(k, dateParam));
    }
  } else if (league === 'cricket') {
    tasks.push(fetchCricket(context.env.CRICKETDATA_API_KEY));
  } else {
    tasks.push(fetchEspnLeague(league, dateParam));
  }

  const batches = await Promise.all(tasks);
  const matches = batches.flat().sort((a, b) => {
    const rank = { live: 0, upcoming: 1, completed: 2 };
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const response = new Response(
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      league,
      date: dateParam || 'today',
      cricketConfigured: Boolean(context.env.CRICKETDATA_API_KEY),
      total: matches.length,
      matches,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );

  context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response as unknown as CfResponse;
};