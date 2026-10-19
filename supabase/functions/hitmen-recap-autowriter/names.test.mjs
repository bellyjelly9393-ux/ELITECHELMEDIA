import assert from 'node:assert';
import { nameKey, withScheduleName } from './names.mjs';
import { composeRecap } from './compose.mjs';
assert.equal(nameKey('Chicoutimi Sagueneens'), nameKey('Chicoutimi Saguenéens'));
assert.equal(nameKey("Val-d'Or Foreurs"), nameKey('VAL D OR FOREURS'));
assert.equal(nameKey('Rimouski Oceanic'), nameKey('Rimouski Océanic'));
assert.notEqual(nameKey('Brantford Bulldogs'), nameKey('Chicoutimi Saguenéens'));
const teams = { 412: { name: 'Calgary Hitmen', nickname: 'Hitmen', abbr: 'CGY' }, 468: { name: 'Chicoutimi Sagueneens', nickname: 'Saguenéens', abbr: 'CHI' } };
const t2 = withScheduleName(teams, 468, 'Chicoutimi Saguenéens');
assert.equal(t2[468].name, 'Chicoutimi Saguenéens');
assert.equal(withScheduleName(teams, 468, 'Brantford Bulldogs'), teams); // different team: never relabel
// Synthetic box score: the recap must use the accented name and never the unaccented LG spelling.
const g = { lg_game_id: 1, status: 'REG', away_lg_team_id: 412, home_lg_team_id: 468, away_score: 3, home_score: 5, period_labels: ['1', '2', '3'],
  periods: { 412: [1, 1, 1], 468: [2, 1, 2] }, records: { 412: '1-1-0' },
  team: { 412: { shots: 20, toa_seconds: 500, hits: 5, faceoffs_won: 10, pp: [0, 1] }, 468: { shots: 25, toa_seconds: 600, hits: 6, faceoffs_won: 12, pp: [1, 2] } },
  skaters: [{ gamertag: 'a', lg_team_id: 412, goals: 3, assists: 0, points: 3 }, { gamertag: 'b', lg_team_id: 468, goals: 5, assists: 0, points: 5, gwg: true }],
  goalies: [{ gamertag: 'g1', lg_team_id: 412, saves: 20, shots_against: 25, goals_against: 5 }, { gamertag: 'g2', lg_team_id: 468, saves: 17, shots_against: 20, goals_against: 3 }] };
const r = composeRecap(g, { calgaryId: 412, teams: t2, game_at: '2026-10-19T01:00:00Z', game_no: 1 });
assert.ok(!/Sagueneens/.test(r.title + r.body + JSON.stringify(r.metrics)), 'unaccented name leaked');
assert.equal(r.metrics.opponent, 'Chicoutimi Saguenéens');
console.log('names OK:', r.title);
