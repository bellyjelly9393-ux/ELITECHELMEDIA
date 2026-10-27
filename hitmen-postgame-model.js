(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HitmenPostgame = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';
  const TEAM = 'b0bcbdda-da9d-419d-8f61-b34937966d49';
  const SEASON = 55;
  function lgId(game) {
    try {
      const u = new URL(game.source_url);
      if (!['leaguegaming.com', 'www.leaguegaming.com'].includes(u.hostname)) return null;
      const id = Number(u.searchParams.get('gameid'));
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    } catch { return null; }
  }
  const final = g => g?.status === 'final' && [g.calgary_score, g.opponent_score].every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0);
  const canRead = s => Boolean(s?.user && (['admin', 'commissioner'].includes(s.profile?.role) ||
    (s.memberships || []).some(m => m.team_id === TEAM && m.active !== false && ['owner', 'gm', 'agm', 'scout'].includes(m.role))));
  const canPublish = s => Boolean(s?.user && ['admin', 'commissioner'].includes(s.profile?.role));
  const canManageVOD = s => Boolean(canPublish(s) || (s?.user && (s.memberships || []).some(m => m.team_id === TEAM && m.active !== false && ['owner', 'gm', 'agm'].includes(m.role))));
  function date(g) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(g.scheduled_at));
  }
  function label(g) {
    const when = new Date(g.scheduled_at).toLocaleString('en-US', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return (g.status || 'scheduled').toUpperCase() + ' · ' + when + ' ET · Calgary vs ' + g.opponent_name +
      (final(g) ? ' · ' + g.calgary_score + '–' + g.opponent_score + (g.overtime ? ' OT' : '') : '');
  }
  function matches(post, g) {
    const m = post.source_metrics || {};
    if (m.team !== 'Calgary Hitmen' || Number(m.season) !== Number(g.season)) return false;
    // An explicit schedule link takes precedence: never merge two games against the same team.
    if (m.schedule_game_id) return m.schedule_game_id === g.id;
    const id = lgId(g);
    return id !== null && Number(m.lg_game_id) === id;
  }
  function metadata(g, old = {}) {
    const id = lgId(g);
    return { ...old, team: 'Calgary Hitmen', season: g.season, league: 'LGCHL',
      schedule_game_id: g.id, ...(id ? {lg_game_id: id} : {}),
      opponent: g.opponent_name, week: g.week, game_date: date(g), sort_at: g.scheduled_at,
      source_url: g.source_url || old.source_url || null, source_label: g.source_label || old.source_label || 'Hitmen schedule',
      ...(final(g) ? { calgary_score: g.calgary_score, opponent_score: g.opponent_score,
        final: g.calgary_score + '-' + g.opponent_score,
        result: g.calgary_score > g.opponent_score ? 'W' : g.overtime ? 'OTL' : 'L' } : {}) };
  }
  function draft(g) {
    if (!final(g)) throw new Error('A verified final score is required before drafting a postgame report.');
    return { title: 'Calgary Hitmen ' + g.calgary_score + '–' + g.opponent_score + ' ' + g.opponent_name + (g.overtime ? ' (OT)' : ''),
      body: 'Calgary finished ' + g.calgary_score + '–' + g.opponent_score + ' against ' + g.opponent_name + (g.overtime ? ' in overtime' : '') + '.\n\n' +
        'The final score establishes the result. Review the linked period evidence before drawing conclusions about the breakout, forecheck, coverage or individual decision-making.' };
  }
  const approved = rows => (rows || []).filter(s => !s.archived_at && s.status === 'complete' && String(s.analysis_summary || '').trim());
  function time(n) {
    const v = Math.max(0, Math.floor(Number(n) || 0));
    return Math.floor(v / 3600) + ':' + String(Math.floor(v / 60) % 60).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  }
  return { TEAM, SEASON, lgId, final, canRead, canPublish, canManageVOD, date, label, matches, metadata, draft, approved, time };
});
