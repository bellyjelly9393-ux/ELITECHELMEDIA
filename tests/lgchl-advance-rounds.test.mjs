import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceRounds } from '../lib/lgchl-playoff.mjs';

const done = (a, b, sa, sb, at = '2026-11-25T03:00:00Z') => ({
  kind: 'series', best_of: 7, wins_needed: 4, score: [sa, sb],
  sides: [{ team_id: a, seed: 1, from: null }, { team_id: b, seed: 6, from: null }],
  games: [{ id: 1, at, status: 'final' }], winner_id: null, clinched: false,
});
const pending = (from) => ({
  id: null, kind: 'pending', best_of: 7, wins_needed: 4, score: [0, 0], games: [],
  sides: from.map(f => ({ team_id: null, seed: null, from: f })), winner_id: null, clinched: false,
});
const conf = (name, r2a, r2b) => ({ name, rounds: [
  { label: 'R1', slots: [done(1, 2, 4, 0), done(3, 4, 4, 1), done(5, 6, 4, 2), done(7, 8, 4, 3)] },
  { label: 'R2', slots: [r2a, r2b] },
  { label: 'R3', slots: [pending(['#1 A / #6 B', '#5 C / #2 D'])] },
] });
const board = (east = [done(413, 416, 4, 1), done(377, 418, 2, 4)], west = [done(420, 401, 4, 0), done(399, 422, 0, 4)]) => ({
  ok: true, source: 'Saved official bracket', teams: {},
  leagues: [{ id: 'WHL', conferences: [conf('Eastern', ...east), conf('Western', ...west)],
    final: pending(['Eastern champion', 'Western champion']) }],
  championship: { semi: pending(['WHL champion', 'OHL champion']), final: pending(['Semifinal winner', 'QMJHL champion']) },
});
const row = (gameId, away, home, at, as = null, hs = null) => ({
  lg_game_id: gameId, away_lg_team_id: away, home_lg_team_id: home, game_at: at,
  status: as === null ? 'scheduled' : 'final', away_score: as, home_score: hs,
});
const r3 = (out, c = 0) => out.leagues[0].conferences[c].rounds[2].slots[0];

test('conference final takes both Round 2 winners with their seeds', () => {
  const out = advanceRounds(board(), []);
  assert.deepEqual(r3(out).sides.map(s => s.team_id), [413, 418]);
  assert.deepEqual(r3(out).sides.map(s => s.seed), [1, 6]);
  assert.equal(r3(out).kind, 'series');
  assert.deepEqual(r3(out).score, [0, 0]);
  assert.deepEqual(r3(out, 1).sides.map(s => s.team_id), [420, 422]);
  assert.equal(out.advanced_series, 2);
  assert.match(out.source, /carried forward/);
});

test('an undecided feeder leaves that side pending', () => {
  const out = advanceRounds(board([done(413, 416, 4, 1), done(377, 418, 3, 3)]), []);
  assert.equal(r3(out).sides[0].team_id, 413);
  assert.equal(r3(out).sides[1].team_id, null);
  assert.equal(r3(out).sides[1].from, '#5 C / #2 D');
  assert.equal(r3(out).kind, 'pending');
});

test('attaches the pair\'s games played after Round 2 and scores the series', () => {
  const out = advanceRounds(board(), [
    row(900, 418, 413, '2026-11-20T02:00:00Z', 3, 2), // before Round 2 ended: not this series
    row(901, 418, 413, '2026-11-30T02:00:00Z', 1, 4),
    row(902, 418, 413, '2026-11-30T02:35:00Z', 5, 2),
    row(903, 413, 418, '2026-11-30T03:10:00Z'),
  ]);
  const s = r3(out);
  assert.deepEqual(s.games.map(g => [g.n, g.id]), [[1, 901], [2, 902], [3, 903]]);
  assert.deepEqual(s.score, [1, 1]);
  assert.equal(s.winner_id, null);
});

test('four wins clinch, and the champion moves into the league final', () => {
  const wins = [0, 1, 2, 3].map(i => row(910 + i, 422, 420, `2026-11-30T0${2 + i}:00:00Z`, 1, 3));
  const out = advanceRounds(board(), wins);
  assert.equal(r3(out, 1).winner_id, 420);
  assert.equal(r3(out, 1).clinched, true);
  assert.deepEqual(out.leagues[0].final.sides.map(s => s.team_id), [null, 420]);
  assert.equal(out.leagues[0].final.sides[0].from, 'Eastern champion');
});

test('a slot that already lists both teams is left alone', () => {
  const b = board();
  b.leagues[0].conferences[0].rounds[2].slots[0] = done(111, 222, 0, 0);
  const out = advanceRounds(b, []);
  assert.deepEqual(r3(out).sides.map(s => s.team_id), [111, 222]);
});
