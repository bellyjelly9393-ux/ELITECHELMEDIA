// hitmen-recap-autowriter: server-side Calgary Hitmen recaps, no browser session needed.
// pg_cron (private.hitmen_kick_autorecap) calls this only when an official LGCHL Calgary final has
// no recap yet. For each such game it reads the public LG game page (one request at a time,
// identified User-Agent, pause between requests), reconciles every total against the official
// final (parse.mjs), writes the recap deterministically from those numbers (compose.mjs) and
// publishes through public.hitmen_publish_verified_recap, which refuses duplicates.
// POST { dryRun?: boolean, lgGameId?: number, days?: number, max?: number } with x-sync-token.
import { createClient } from '@supabase/supabase-js';
import { parseLgGamePage } from './parse.mjs';
import { composeRecap } from './compose.mjs';

const UA = 'Wildman-Hockey-Esports/1.0 (Hitmen recap writer; one request at a time)';
const PAUSE_MS = 1500;
const CALGARY = 412;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class Blocked extends Error {}

async function getHtml(url: string) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    if (res.status === 403 || res.status === 429 || (!html.includes('Period Stats') && /<title>\s*Just a moment|cf-chl-|cf_chl_opt/i.test(html)))
      throw new Blocked('LG blocked or challenged automated access (' + res.status + ')');
    if (!res.ok) throw new Error('LG returned ' + res.status);
    return html;
  } finally { await sleep(PAUSE_MS); }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: cfg } = await db.from('lg_sync_settings').select('value').eq('key', 'sync_token').maybeSingle();
  if (!cfg?.value || req.headers.get('x-sync-token') !== cfg.value) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const one = Number.isSafeInteger(Number(body.lgGameId)) && Number(body.lgGameId) > 0 ? Number(body.lgGameId) : null;
  const max = Math.min(Math.max(Number(body.max) || 4, 1), 8);
  const { data: rows, error } = await db.rpc('hitmen_autorecap_games', { p_days: Math.min(Math.max(Number(body.days) || 14, 1), 60), p_lg_game_id: one });
  if (error) return json({ error: error.message }, 500);
  const games = (rows || []).filter((g: any) => (one ? true : !g.has_recap && g.due)).slice(0, max);
  if (!games.length) return json({ idle: true, dryRun });

  const { data: teamRows, error: te } = await db.from('lgchl_teams').select('lg_team_id,name,nickname,abbr').eq('season', 55);
  if (te) return json({ error: te.message }, 500);
  const teams = Object.fromEntries((teamRows || []).map((t: any) => [t.lg_team_id, t]));

  const results: unknown[] = [];
  for (const g of games) {
    try {
      if (!dryRun && g.has_recap) { results.push({ lg_game_id: g.lg_game_id, skipped: 'recap already exists' }); continue; }
      const html = await getHtml(g.source_url);
      const parsed = parseLgGamePage(html, { lg_game_id: Number(g.lg_game_id), status: g.status, away_lg_team_id: g.away_lg_team_id, home_lg_team_id: g.home_lg_team_id, away_score: g.away_score, home_score: g.home_score });
      const recap = composeRecap(parsed, { calgaryId: CALGARY, teams, game_at: g.game_at, week: g.week, game_no: g.game_no, schedule_game_id: g.schedule_game_id, source_url: g.source_url });
      if (dryRun) { results.push({ lg_game_id: g.lg_game_id, dryRun: true, has_recap: g.has_recap, title: recap.title, body: recap.body, metrics: recap.metrics }); continue; }
      const { data: id, error: pe } = await db.rpc('hitmen_publish_verified_recap', { p_lg_game_id: Number(g.lg_game_id), p_title: recap.title, p_body: recap.body, p_metrics: recap.metrics });
      if (pe) throw new Error(pe.message);
      results.push({ lg_game_id: g.lg_game_id, published: id, title: recap.title });
    } catch (e) {
      const msg = String((e as Error)?.message || e).slice(0, 500);
      if (!dryRun) await db.rpc('hitmen_autorecap_note', { p_lg_game_id: Number(g.lg_game_id), p_error: msg });
      results.push({ lg_game_id: g.lg_game_id, error: msg });
      if (e instanceof Blocked) break;
    }
  }
  return json({ dryRun, results });
});
