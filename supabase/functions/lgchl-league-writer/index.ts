// lgchl-league-writer: deterministic LGCHL night wraps for the LG Media desk, saved as DRAFTS only.
// No AI, no LG requests, no publishing, no Discord. Content reads go exclusively through the
// public-source allowlist (public-sources.mjs): the composer never receives a database client.
// POST { night?: 'YYYY-MM-DD' (Eastern; default = latest night whose games have started), dryRun?: boolean (default true),
//        partial?: boolean (default true: write finals, list unreported games; refuse below 80% final) }
// with x-sync-token. dryRun:false stores/refreshes the draft via public.lgchl_media_save_draft.
import { createClient } from '@supabase/supabase-js';
import { createPublicReader, supabaseBackend } from './public-sources.mjs';
import { loadNight, localDate } from './load.mjs';
import { composeNightWrap, WRITER_VERSION } from './compose.mjs';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Auth check only; this value never reaches the writer.
  const { data: cfg } = await db.from('lg_sync_settings').select('value').eq('key', 'sync_token').maybeSingle();
  if (!cfg?.value || req.headers.get('x-sync-token') !== cfg.value) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun !== false;
  const reader = createPublicReader(supabaseBackend(db));

  let night = typeof body.night === 'string' ? body.night : null;
  if (!night) {
    const games = await reader.read('lgchl_games', ['game_at', 'status'], { season: { op: 'eq', value: 55 }, game_at: { op: 'lt', value: new Date().toISOString() } }, { order: 'game_at' });
    // Latest night whose last game started 60+ minutes ago; partial mode handles unreported games.
    const cutoff = Date.now() - 60 * 60e3;
    night = games.filter((g: any) => Date.parse(g.game_at) <= cutoff).map((g: any) => localDate(g.game_at)).sort().pop() ?? null;
    if (!night) return json({ idle: true, reason: 'no started game night' });
  }
  try {
    const ctx = await loadNight(reader, { night, season: 55 });
    if (ctx.empty) return json({ idle: true, night, reason: 'no LGCHL games that night' });
    const wrap = composeNightWrap(ctx, { allowPartial: body.partial !== false, minFinalShare: 0.8 });
    if (!wrap.ok) { console.log(JSON.stringify({ writer: WRITER_VERSION, night, saved: false, reason: wrap.reason, pending: wrap.pending })); return json({ idle: true, night, saved: false, ...wrap }); }
    if (wrap.metrics?.not_reported?.length) console.log(JSON.stringify({ writer: WRITER_VERSION, night, partial: true, not_reported: wrap.metrics.not_reported }));
    const payload = { cards: wrap.cards, scores: wrap.scores, mentions: wrap.mentions, metrics: wrap.metrics, sources: [...new Set(reader.reads.map((r) => r.table))] };
    if (dryRun) return json({ dryRun, night, would_save: true, not_reported: wrap.metrics?.not_reported ?? [], title: wrap.title, dek: wrap.dek, body_md: wrap.markdown, payload });
    const { data: id, error } = await db.rpc('lgchl_media_save_draft', { p_kind: 'night-wrap', p_season: 55, p_night: night, p_title: wrap.title, p_dek: wrap.dek, p_body_md: wrap.markdown, p_payload: payload, p_generator: WRITER_VERSION });
    if (error) return json({ error: error.message }, 500);
    return json({ dryRun, night, draft_id: id, kept_existing_review: id == null, title: wrap.title });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e).slice(0, 500), privacy: (e as Error)?.name === 'PrivacyError' }, 500);
  }
});
