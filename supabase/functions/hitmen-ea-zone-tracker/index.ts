// hitmen-ea-zone-tracker: per-game EA shot/goal ice zones for Calgary games.
// EA's public API has no per-event data (no x/y, clock or shot type); it only exposes running 16-zone
// shot/goal totals per club member. This function snapshots Calgary's and tonight's opponents' member
// totals every 2 minutes around games (pg_cron, private.hitmen_kick_ea_zone_tracker), and when a new
// Calgary match appears, stores the before/after difference in public.hitmen_ea_match_events, only
// when it provably belongs to that one match (see zones.mjs). Read-only against EA; never publishes.
// POST { force?: boolean, dryRun?: boolean } with x-sync-token.
import { createClient } from '@supabase/supabase-js';
import { parseMembers, zoneDelta, windowHasOnlyMatch, leagueGameFor, nextMatchAt } from './zones.mjs';

const CALGARY_CLUB = '9495', TEAM = 'b0bcbdda-da9d-419d-8f61-b34937966d49', PLATFORM = 'common-gen5';
const UA = 'Elitechel-Media-Esports/1.0 (Hitmen EA zone tracker)';
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

async function ea(path: string, params: Record<string, string>) {
  const url = new URL('https://proclubs.ea.com/api/nhl' + path);
  Object.entries({ platform: PLATFORM, ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Accept: 'application/json', Referer: 'https://www.ea.com/', Origin: 'https://www.ea.com', 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(path + ' HTTP ' + res.status);
  return await res.json();
}
async function allMatches(club: string) {
  const out: any[] = [];
  for (const t of ['club_private', 'gameType5', 'gameType10']) {
    try { const d = await ea('/clubs/matches', { clubIds: club, matchType: t, maxResultCount: '10' }); if (Array.isArray(d)) out.push(...d); } catch (_) { /* partial ok */ }
  }
  return out.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: cfg } = await db.from('lg_sync_settings').select('value').eq('key', 'sync_token').maybeSingle();
  if (!cfg?.value || req.headers.get('x-sync-token') !== cfg.value) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  // Calgary games around now, and their opponents' verified EA clubs.
  const now = Date.now();
  const { data: games } = await db.from('lgchl_games').select('lg_game_id,game_at,home_lg_team_id,away_lg_team_id')
    .eq('season', 55).or('home_lg_team_id.eq.412,away_lg_team_id.eq.412')
    .gte('game_at', new Date(now - 3 * 3600e3).toISOString()).lte('game_at', new Date(now + 3600e3).toISOString());
  if (!games?.length && !body.force) return json({ idle: true });
  const oppIds = (games || []).map((g: any) => (g.home_lg_team_id === 412 ? g.away_lg_team_id : g.home_lg_team_id));
  const { data: teams } = await db.from('lgchl_teams').select('lg_team_id,name').eq('season', 55).in('lg_team_id', oppIds.length ? oppIds : [-1]);
  const { data: links } = await db.from('hitmen_opponents').select('opponent_name,ea_club_id').eq('team_id', TEAM).eq('season', 55)
    .in('opponent_name', (teams || []).map((t: any) => t.name).concat(['-']));
  const clubByName = new Map((links || []).map((l: any) => [l.opponent_name, String(l.ea_club_id)]));
  const nameById = new Map((teams || []).map((t: any) => [t.lg_team_id, t.name]));
  const leagueGames = (games || []).map((g: any) => ({ lg_game_id: g.lg_game_id, game_at: g.game_at,
    opp_club: clubByName.get(nameById.get(g.home_lg_team_id === 412 ? g.away_lg_team_id : g.home_lg_team_id)) || null }));
  const clubs = [CALGARY_CLUB, ...new Set((links || []).map((l: any) => String(l.ea_club_id)).filter((c: string) => /^\d+$/.test(c)))];

  // 1. Snapshot every tracked club.
  const matchesByClub: Record<string, any[]> = {}, snaps: any[] = [], warnings: string[] = [];
  for (const club of clubs) {
    try {
      const [members, matches] = await Promise.all([ea('/members/stats', { clubId: club }), allMatches(club)]);
      matchesByClub[club] = matches;
      snaps.push({ club_id: club, platform: PLATFORM, members: parseMembers(members), last_match_id: matches[0] ? String(matches[0].matchId) : null,
        last_match_at: matches[0] ? new Date(Number(matches[0].timestamp) * 1000).toISOString() : null, raw: { members } });
    } catch (e) { warnings.push(club + ': ' + String((e as Error).message)); }
  }
  if (!dryRun && snaps.length) await db.from('hitmen_ea_member_zone_snapshots').insert(snaps);

  // 2. For each recent Calgary club_private match, try to derive zones for both clubs.
  const results: any[] = [];
  const recent = (matchesByClub[CALGARY_CLUB] || []).filter((m: any) => m.clubs?.[CALGARY_CLUB] && Number(m.timestamp) * 1000 > now - 6 * 3600e3);
  for (const m of recent) {
    const matchId = String(m.matchId), at = Number(m.timestamp) * 1000;
    const { data: done } = await db.from('hitmen_ea_match_events').select('club_id').eq('source_game_id', matchId).eq('source', 'ea_member_zone_delta');
    const { data: link } = await db.from('hitmen_opponent_ea_games').select('lg_game_id').eq('source_game_id', matchId).not('lg_game_id', 'is', null).limit(1);
    // Only official LGCHL games: scrims and public matchmaking after the league night are not ours to file.
    const lgGameId = leagueGameFor(m, CALGARY_CLUB, leagueGames, link?.[0]?.lg_game_id ?? null);
    if (!lgGameId) { results.push({ matchId, skipped: 'not an LGCHL game (no verified link, other club is not tonight\'s opponent)' }); continue; }
    for (const club of Object.keys(m.clubs)) {
      if ((done || []).some((d: any) => d.club_id === club)) continue;
      const clubMatches = matchesByClub[club] || await allMatches(club);
      // EA can publish the match a few minutes before member totals catch up, so use the latest snapshot
      // taken before this club's next match (or now) rather than the first one after the match.
      const until = nextMatchAt(clubMatches, matchId) ?? now + 60e3;
      const { data: before } = await db.from('hitmen_ea_member_zone_snapshots').select('captured_at,members').eq('club_id', club)
        .lt('captured_at', new Date(at).toISOString()).order('captured_at', { ascending: false }).limit(1);
      const { data: after } = await db.from('hitmen_ea_member_zone_snapshots').select('captured_at,members').eq('club_id', club)
        .gt('captured_at', new Date(at).toISOString()).lt('captured_at', new Date(until).toISOString()).order('captured_at', { ascending: false }).limit(1);
      if (!before?.[0] || !after?.[0]) { results.push({ matchId, club, skipped: 'no before/after snapshot pair' }); continue; }
      if (!windowHasOnlyMatch(clubMatches, matchId, before[0].captured_at, after[0].captured_at)) { results.push({ matchId, club, skipped: 'other matches inside snapshot window' }); continue; }
      const { rows, rejected } = zoneDelta(before[0].members, after[0].members, m.players?.[club]);
      const side = club === CALGARY_CLUB ? 'calgary' : 'opponent';
      const insert = rows.map((r) => ({ ...r, team_id: TEAM, lg_game_id: lgGameId, source_game_id: matchId, club_id: club, side, source: 'ea_member_zone_delta', verified: true,
        raw: { before_at: before[0].captured_at, after_at: after[0].captured_at } }));
      if (!dryRun && insert.length) {
        const { error } = await db.from('hitmen_ea_match_events').upsert(insert, { onConflict: 'source,source_game_id,club_id,player,event_type,ice_zone', ignoreDuplicates: true });
        if (error) warnings.push(matchId + '/' + club + ': ' + error.message);
      }
      results.push({ matchId, club, lgGameId, rows: insert.length, rejected });
    }
  }
  return json({ dryRun, clubs, snapshots: snaps.length, results, warnings });
});
