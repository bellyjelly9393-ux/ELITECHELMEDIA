// GET /api/lgchl-playoffs
// Season 55 LGCHL playoff bracket. The official LeagueGaming playoff pages are the source
// of truth (bracket shape, byes, seeds, series score, game list). public.lgchl_games fills
// in a final score when the existing league sync has it and the series page does not yet.
// A saved snapshot is served if LeagueGaming or Supabase is unavailable.
//
// This file is .mjs on purpose: the repo has no package.json, so Vercel treats .js API
// routes as CommonJS. CommonJS cannot import ../lib/lgchl-playoff.mjs, which crashed the
// function on startup (FUNCTION_INVOCATION_FAILED) before any snapshot fallback could run.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rest } from './_lgchl.js';
import { bracketUrl, isBlocked, refreshFromSources, toPublic } from '../lib/lgchl-playoff.mjs';

const UA = 'Elitechel-Media-Esports/1.0 (playoff bracket; elitechelmedia.com)';
const FRESH_MS = 120000;
const STALE_MS = 30000;

function snapshotPath() {
  return fileURLToPath(new URL('../assets/lgchl/playoffs/s55.json', import.meta.url));
}

function readSnapshot() {
  const paths = [snapshotPath(), 'assets/lgchl/playoffs/s55.json'];
  let last;
  for (const path of paths) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

let snapshot = null;
try {
  snapshot = readSnapshot();
} catch {
  snapshot = { ok: false, leagues: [], teams: {}, stale: true, stale_reason: 'snapshot_missing' };
}

let memory = null;
let memoryAt = 0;
let inflight = null;

export async function fetchLg(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(12000),
  });
  const html = await res.text();
  if (res.status === 403 || res.status === 429 || isBlocked(html) || !res.ok) throw new Error('lg_' + res.status);
  return html;
}

async function loadTeams() {
  const rows = await rest('lgchl_teams?select=lg_team_id,name,abbr,nickname,league,conference&season=eq.55');
  return Object.fromEntries(rows.map((t) => [t.lg_team_id, {
    id: t.lg_team_id,
    name: t.name,
    nick: t.nickname || t.name,
    abbr: t.abbr || '',
    league: t.league || '',
    conference: t.conference || '',
    logo: `assets/lgchl/s55/team${t.lg_team_id}.png`,
  }]));
}

async function loadScores(ids) {
  const rows = await rest(`lgchl_games?select=lg_game_id,away_lg_team_id,home_lg_team_id,away_score,home_score,status,game_at&lg_game_id=in.(${ids.join(',')})`);
  return new Map(rows.map((row) => [row.lg_game_id, row]));
}

export async function loadPlayoffs(now = Date.now()) {
  if (memory && now - memoryAt < (memory.stale ? STALE_MS : FRESH_MS)) return memory;
  if (!inflight) {
    inflight = refreshFromSources({ snapshot, fetchHtml: fetchLg, loadTeams, loadScores, now })
      .catch(() => ({ ...snapshot, ok: true, stale: true, stale_reason: 'lg_unavailable', refresh_seconds: 30 }))
      .finally(() => { inflight = null; });
  }
  const value = await inflight;
  memory = value;
  memoryAt = now;
  return value;
}

export function __resetPlayoffCache() {
  memory = null;
  memoryAt = 0;
  inflight = null;
}

export function __setPlayoffSnapshot(value) {
  snapshot = value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const full = await loadPlayoffs();
    const body = toPublic(full);
    if (!body.leagues?.length) throw new Error('empty');
    const seconds = body.stale ? 30 : 120;
    res.setHeader('Cache-Control', `public, max-age=60, s-maxage=${seconds}, stale-while-revalidate=600`);
    return res.status(200).json(body);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const fallback = toPublic(snapshot);
      if (fallback?.leagues?.length) {
        return res.status(200).json({ ...fallback, stale: true, stale_reason: 'lg_unavailable' });
      }
    } catch { /* still report unavailable below */ }
    return res.status(503).json({ ok: false, error: 'playoff_bracket_unavailable', source_url: bracketUrl() });
  }
}
