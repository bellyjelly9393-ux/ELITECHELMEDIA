// Team branding for the OBS pregame and Carbon screens.
//
// To add or change a team, edit one line in TEAMS below:
//   name     - how the team is written on screen
//   code     - three-letter code used on small labels
//   lgId     - the LeagueGaming team id (from the game sheet URL or schedule feed)
//   logo     - crest shown beside the team name (optional: LeagueGaming's crest is used if left out)
//   wordmark - optional wide logo that replaces the crest + name in the matchup title
//   jersey   - optional jersey art for the team
//   color    - accent colour for the team's lineup panel
//
// Opponents that are not listed still work: their crest is loaded from LeagueGaming by team id.
(function () {
  'use strict';

  const TEAMS = [
    { name: 'Czechia', code: 'CZE', lgId: null, logo: '/assets/lg3s-world/flags/cz.svg', wordmark: '/assets/teams/czechia-wordmark.webp', jersey: '/assets/lg3s/jerseys/czechia-home.webp', color: '#e33b51' },
    { name: 'Canada', code: 'CAN', lgId: 341, color: '#e03a3e' },
    { name: 'USA', code: 'USA', lgId: 342, color: '#3c6fd1' },
    { name: 'Sweden', code: 'SWE', lgId: 343, color: '#f2c230' },
    { name: 'Switzerland', code: 'SUI', lgId: 404, color: '#e03a3e' },
    { name: 'Kazakhstan', code: 'KAZ', lgId: 531, color: '#27b4d8' },
    { name: 'Germany', code: 'GER', lgId: 532, color: '#f0c419' },
    { name: 'Japan', code: 'JPN', lgId: 591, color: '#e8eef6' },
    { name: 'Italy', code: 'ITA', lgId: 822, color: '#2b9a5a' },
    { name: 'Slovakia', code: 'SVK', lgId: 1079, color: '#3c6fd1' },
    { name: 'Latvia', code: 'LAT', lgId: 1439, color: '#a3283f' },
    { name: 'Poland', code: 'POL', lgId: 1444, color: '#e03a3e' },
    { name: 'Great Britain', code: 'GBR', lgId: 1446, color: '#3c6fd1' },
    { name: 'Finland', code: 'FIN', lgId: null, logo: '/assets/lg3s-world/flags/fi.svg', color: '#3c6fd1' },
  ];

  // Crests and jerseys already stored on the site, by LeagueGaming team id.
  const LOCAL_ART = new Set([341, 342, 343, 404, 531, 532, 591, 822, 1079, 1439, 1444, 1446]);
  const DEFAULT_HOME = 'Czechia';

  const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const byKey = new Map(TEAMS.map(team => [slug(team.name), team]));
  const byId = new Map(TEAMS.filter(team => team.lgId).map(team => [team.lgId, team]));

  function resolve(name, lgId) {
    const id = Number.isSafeInteger(Number(lgId)) && Number(lgId) > 0 ? Number(lgId) : null;
    const listed = byKey.get(slug(name)) || (id && byId.get(id)) || {};
    const teamId = listed.lgId || id;
    const label = listed.name || String(name || '').trim() || 'Opponent';
    return {
      key: slug(label),
      name: label,
      code: listed.code || label.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TBC',
      lgId: teamId,
      wordmark: listed.wordmark || '',
      logo: listed.logo || (teamId ? (LOCAL_ART.has(teamId) ? '/assets/lg3s/team' + teamId + '.svg' : '/api/lg-team-logo?team=' + teamId) : ''),
      jersey: listed.jersey || (teamId && LOCAL_ART.has(teamId) ? '/assets/lg3s/jerseys/' + teamId + '.webp' : ''),
      color: /^#[0-9a-f]{6}$/i.test(listed.color || '') ? listed.color : '#76a9f3',
    };
  }

  window.ECMTeams = {
    list: () => TEAMS.map(team => resolve(team.name, team.lgId)),
    resolve,
    slug,
    defaultHome: DEFAULT_HOME,
  };
})();
