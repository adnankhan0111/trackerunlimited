import type { PagesFunction, KVNamespace, Response as CfResponse } from '@cloudflare/workers-types';

interface Env {
  TITAN_INCIDENTS?: KVNamespace;
}

const KV_KEY = 'live_incidents_v1';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = context.env.TITAN_INCIDENTS
    ? await context.env.TITAN_INCIDENTS.get(KV_KEY)
    : null;
  const incidents = raw ? JSON.parse(raw) : [];

  return new Response(JSON.stringify({ incidents }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  }) as unknown as CfResponse;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.TITAN_INCIDENTS) {
    return new Response(JSON.stringify({ error: 'KV namespace TITAN_INCIDENTS not bound' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as CfResponse;
  }

  const body = (await context.request.json()) as {
    title?: string;
    category?: string;
    lat?: number;
    lon?: number;
  };

  if (!body.title || typeof body.lat !== 'number' || typeof body.lon !== 'number') {
    return new Response(JSON.stringify({ error: 'Invalid incident payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as CfResponse;
  }

  const incident = {
    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: body.title.slice(0, 80),
    category: body.category || 'community',
    lat: body.lat,
    lon: body.lon,
    createdAt: new Date().toISOString(),
  };

  const existingRaw = await context.env.TITAN_INCIDENTS.get(KV_KEY);
  const existing = existingRaw ? (JSON.parse(existingRaw) as unknown[]) : [];
  const updated = [incident, ...existing].slice(0, 100); // Keep latest 100 pins

  await context.env.TITAN_INCIDENTS.put(KV_KEY, JSON.stringify(updated), {
    expirationTtl: 60 * 60 * 24 * 7, // Auto-expire stale list after 7 days of inactivity
  });

  return new Response(JSON.stringify({ incident }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  }) as unknown as CfResponse;
};