import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

interface Env {
  CRICKETDATA_API_KEY?: string;
}

interface PlayItem {
  id: string;
  clock: string;
  text: string;
  isScoring: boolean;
}

interface EspnPlay {
  id?: string;
  clock?: { displayValue?: string };
  period?: { number?: number };
  text?: string;
  scoringPlay?: boolean;
}

interface EspnKeyEvent {
  id?: string;
  clock?: { displayValue?: string };
  text?: string;
  type?: { text?: string };
  scoringPlay?: boolean;
}

const ESPN_PATHS: Record<string, string> = {
  soccer: 'soccer/all',
  epl: 'soccer/eng.1',
  laliga: 'soccer/esp.1',
  ucl: 'soccer/uefa.champions',
  nhl: 'hockey/nhl',
  f1: 'racing/f1',
  nba: 'basketball/nba',
  tennis: 'tennis/atp',
  ufc: 'mma/ufc',
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const edgeCache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(context.request.url);
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached as unknown as CfResponse;

  const url = new URL(context.request.url);
  const rawId = url.searchParams.get('id') || '';
  const dashIdx = rawId.indexOf('-');

  if (dashIdx === -1) {
    return new Response(JSON.stringify({ error: 'Invalid match ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as CfResponse;
  }

  const leagueKey = rawId.slice(0, dashIdx);
  const eventId = rawId.slice(dashIdx + 1);

  let statusText = '';
  let homeScore = '';
  let awayScore = '';
  let summaryNote = '';
  let plays: PlayItem[] = [];

  try {
    if (leagueKey === 'cricket') {
      if (context.env.CRICKETDATA_API_KEY) {
        const res = await fetch(
          `https://api.cricapi.com/v1/match_info?apikey=${encodeURIComponent(
            context.env.CRICKETDATA_API_KEY
          )}&id=${encodeURIComponent(eventId)}`,
          { headers: { 'User-Agent': 'ProjectTitan-Edge/2.2' } }
        );

        if (res.ok) {
          const raw = (await res.json()) as {
            data?: {
              status?: string;
              venue?: string;
              score?: Array<{ r: number; w: number; o: number; inning: string }>;
            };
          };
          const d = raw.data;
          statusText = d?.status || '';
          summaryNote = d?.venue ? `Venue: ${d.venue}` : '';

          if (Array.isArray(d?.score) && d.score.length > 0) {
            homeScore = `${d.score[0].r}/${d.score[0].w} (${d.score[0].o} ov)`;
            if (d.score[1]) {
              awayScore = `${d.score[1].r}/${d.score[1].w} (${d.score[1].o} ov)`;
            }
            plays = d.score.map((inn, i) => ({
              id: `inn-${i}`,
              clock: `${inn.o} ov`,
              text: `${inn.inning}: ${inn.r}/${inn.w}`,
              isScoring: true,
            }));
          }
        }
      }
    } else if (ESPN_PATHS[leagueKey]) {
      const path = ESPN_PATHS[leagueKey];
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(
          eventId
        )}`,
        {
          headers: {
            'User-Agent': 'ProjectTitan-Edge/2.2',
            Accept: 'application/json',
          },
        }
      );

      if (res.ok) {
        const raw = (await res.json()) as {
          header?: {
            competitions?: Array<{
              status?: { type?: { shortDetail?: string; description?: string } };
              competitors?: Array<{ homeAway?: string; score?: string }>;
            }>;
          };
          plays?: EspnPlay[];
          keyEvents?: EspnKeyEvent[];
          commentary?: Array<{ id?: string; time?: { displayValue?: string }; text?: string }>;
        };

        const comp = raw.header?.competitions?.[0];
        statusText =
          comp?.status?.type?.shortDetail || comp?.status?.type?.description || '';
        const competitors = comp?.competitors || [];
        const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
        const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
        homeScore = home?.score ?? '';
        awayScore = away?.score ?? '';

        if (Array.isArray(raw.commentary) && raw.commentary.length > 0) {
          plays = raw.commentary
            .slice(0, 20)
            .map((c, idx) => ({
              id: c.id || `comm-${idx}`,
              clock: c.time?.displayValue || 'LIVE',
              text: c.text || '',
              isScoring: false,
            }))
            .filter((p) => p.text.length > 0);
        } else if (Array.isArray(raw.keyEvents) && raw.keyEvents.length > 0) {
          plays = raw.keyEvents
            .slice(-20)
            .reverse()
            .map((ev, idx) => ({
              id: ev.id || `key-${idx}`,
              clock: ev.clock?.displayValue || ev.type?.text || 'EVENT',
              text: ev.text || ev.type?.text || '',
              isScoring: Boolean(ev.scoringPlay),
            }))
            .filter((p) => p.text.length > 0);
        } else if (Array.isArray(raw.plays) && raw.plays.length > 0) {
          plays = raw.plays
            .slice(-20)
            .reverse()
            .map((p, idx) => ({
              id: p.id || `play-${idx}`,
              clock: p.clock?.displayValue || (p.period?.number ? `P${p.period.number}` : 'LIVE'),
              text: p.text || '',
              isScoring: Boolean(p.scoringPlay),
            }))
            .filter((p) => p.text.length > 0);
        }
      }
    }
  } catch {
    // Return graceful empty plays on upstream timeout
  }

  const response = new Response(
    JSON.stringify({
      id: rawId,
      updatedAt: new Date().toISOString(),
      statusText,
      homeScore,
      awayScore,
      summaryNote,
      plays,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10, s-maxage=10',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );

  context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response as unknown as CfResponse;
};