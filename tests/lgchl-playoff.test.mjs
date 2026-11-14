import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseBracket, parseDetail, parseWhen, buildBoard, refreshFromSources, isBlocked, bracketSpec, HITMEN_LG_TEAM_ID,
} from '../lib/lgchl-playoff.mjs';

const NOW = Date.parse('2026-11-11T21:30:00Z');
const read = (name) => fs.readFileSync(new URL('./fixtures/lgchl/' + name, import.meta.url), 'utf8');

function cellById(bracket, id) {
  for (const row of bracket.grid) {
    for (const cell of row) if (cell && !cell.span && cell.id === id) return cell;
  }
  return null;
}

test('official bracket page is 16 by 11 with 12 series and 12 byes', () => {
  const bracket = parseBracket(read('playoff-bracket.html'));
  assert.equal(bracket.rows, 16);
  assert.equal(bracket.cols, 11);
  assert.equal(bracket.labels[5], 'Finals');
  let series = 0; let byes = 0;
  for (const row of bracket.grid) {
    for (const cell of row) {
      if (!cell || cell.span || cell.kind === 'empty') continue;
      if (cell.kind === 'series') {
        series += 1;
        assert.deepEqual(cell.score, [0, 0]);
        assert.equal(cell.teams.length, 2);
      } else if (cell.kind === 'bye') byes += 1;
    }
  }
  assert.equal(series, 12);
  assert.equal(byes, 12);
});

test('series detail carries seeds, seven games and evening start times', () => {
  const detail = parseDetail(read('playoff-series.html'), NOW);
  assert.deepEqual(detail.entries.map((e) => [e.team_id, e.seed, e.group]), [
    [2983, 6, 'WHL Eastern'],
    [415, 3, 'WHL Eastern'],
  ]);
  assert.equal(detail.games.length, 7);
  assert.equal(detail.games[0].id, 923563);
  assert.equal(detail.games[0].away, 2983);
  assert.equal(detail.games[0].home, 415);
  assert.equal(detail.games[0].at, '2026-11-16T02:00:00.000Z');
  assert.equal(parseWhen('Tue 17 10:10 EST', NOW), '2026-11-18T03:10:00.000Z');
});

test('a printed final score and the winner crest both count as a game win', () => {
  const html = read('playoff-series.html').replace(
    '<img src="/images/team/p100/team2983.png" style="max-height:60px;" class="">',
    '<img src="/images/team/p100/team2983.png" style="max-height:60px;" class="teamiconwin">',
  ).replace('Sun 15 09:00 EST</small>', 'Sun 15 09:00 EST</small><strong>4</strong> vs <strong>1</strong>');
  const detail = parseDetail(html, NOW);
  assert.equal(detail.games[0].away_score, 4);
  assert.equal(detail.games[0].home_score, 1);
  assert.equal(detail.games[0].winner, 2983);
  assert.equal(detail.games[1].away_score, null);
});

test('bye pages keep the seed and are not treated as a series', () => {
  const detail = parseDetail(read('playoff-bye.html'), NOW);
  assert.deepEqual(detail.entries, [{ team_id: 413, nick: 'Raiders', seed: 1, group: 'WHL Eastern' }]);
});

test('challenge pages are rejected', () => {
  assert.equal(isBlocked('<html><title>Just a moment...</title></html>'), true);
  assert.throws(() => parseBracket('<title>Just a moment...</title>'), /blocked/);
  assert.throws(() => parseDetail('<title>Just a moment...</title>'), /blocked/);
});

test('Round 2 shows the bye team against the unfinished series', () => {
  const bracket = parseBracket(read('playoff-bracket.html'));
  const matchups = {
    1: parseDetail(read('playoff-bye.html'), NOW),
    2: parseDetail(read('playoff-series.html'), NOW),
    4: { entries: [{ team_id: 416, nick: 'Tigers', seed: 2, group: 'WHL Eastern' }], games: [] },
    3: { entries: [
      { team_id: 377, nick: 'Broncos', seed: 5, group: 'WHL Eastern' },
      { team_id: 385, nick: 'Rebels', seed: 4, group: 'WHL Eastern' },
    ], games: [] },
  };
  const board = buildBoard({ bracket, matchups, teams: {
    413: { name: 'Prince Albert Raiders', nick: 'Raiders', abbr: 'PAR' },
    2983: { name: 'Chilliwack Bruins', nick: 'Bruins', abbr: 'CHW' },
    415: { name: 'Edmonton Oil Kings', nick: 'Oil Kings', abbr: 'EDM' },
  }, now: NOW });
  const east = board.leagues.find((l) => l.id === 'WHL').conferences[0];
  assert.equal(east.name, 'Eastern');
  assert.equal(east.rounds[0].slots[0].kind, 'bye');
  assert.equal(east.rounds[0].slots[0].winner_id, 413);
  assert.equal(east.rounds[0].slots[1].games.length, 7);
  const r2 = east.rounds[1].slots[0];
  assert.equal(r2.sides[0].team_id, 413);
  assert.equal(r2.sides[1].team_id, null);
  assert.match(r2.sides[1].from, /Bruins/);
  assert.match(r2.sides[1].from, /Oil Kings/);
  assert.equal(board.championship.semi.sides[0].from, 'WHL champion');
  assert.equal(board.championship.semi.sides[1].from, 'OHL champion');
  assert.equal(board.championship.final.sides[1].from, 'QMJHL champion');
  assert.equal(board.teams[413].hitmen, false);
  assert.equal(HITMEN_LG_TEAM_ID, 412);
  assert.equal(board.teams[412], undefined);
});

test('four wins advance that club into the next round beside the bye', () => {
  const bracket = parseBracket(read('playoff-bracket.html'));
  const series = parseDetail(read('playoff-series.html'), NOW);
  series.games.forEach((g, i) => {
    if (i < 4) {
      g.away_score = g.away === 415 ? 3 : 1;
      g.home_score = g.home === 415 ? 3 : 1;
      g.status = 'final';
    }
  });
  const board = buildBoard({
    bracket,
    matchups: {
      1: parseDetail(read('playoff-bye.html'), NOW),
      2: series,
    },
    teams: {},
    now: NOW,
  });
  const r1 = board.leagues[0].conferences[0].rounds[0].slots[1];
  assert.deepEqual(r1.score, [0, 4]);
  assert.equal(r1.winner_id, 415);
  assert.equal(r1.clinched, true);
  const r2 = board.leagues[0].conferences[0].rounds[1].slots[0];
  assert.deepEqual(r2.sides.map((s) => s.team_id), [413, 415]);
  assert.equal(r2.kind, 'series');
});

test('the bracket series score is used when game pages have no finals yet', () => {
  const bracket = parseBracket(read('playoff-bracket.html'));
  const cell = cellById(bracket, 2);
  cell.score = [4, 1];
  const series = parseDetail(read('playoff-series.html'), NOW);
  series.games = [];
  const board = buildBoard({
    bracket,
    matchups: { 1: parseDetail(read('playoff-bye.html'), NOW), 2: series },
    teams: {},
    now: NOW,
  });
  const r1 = board.leagues[0].conferences[0].rounds[0].slots[1];
  assert.deepEqual(r1.score, [4, 1]);
  assert.equal(r1.winner_id, 2983);
});

test('game rows advance the saved bracket when the playoff page is blocked', async () => {
  const bracket = parseBracket(read('playoff-bracket.html'));
  const series = parseDetail(read('playoff-series.html'), NOW);
  const bye = parseDetail(read('playoff-bye.html'), NOW);
  const snapshot = {
    ok: true, stale: false, season: 55, fetched_at: '2026-11-11T00:00:00.000Z',
    leagues: [{ id: 'WHL' }], teams: {}, bracket: bracketSpec(bracket),
    matchups: { 1: bye, 2: series },
  };
  const scores = new Map(series.games.slice(0, 4).map((g) => [g.id, {
    lg_game_id: g.id, away_lg_team_id: g.away, home_lg_team_id: g.home,
    away_score: g.away === 415 ? 3 : 1, home_score: g.home === 415 ? 3 : 1, status: 'final',
  }]));
  const out = await refreshFromSources({
    snapshot,
    fetchHtml: async () => { throw new Error('down'); },
    loadScores: async () => scores,
    now: NOW,
  });
  assert.equal(out.stale, false);
  assert.match(out.source, /lgchl_games/);
  const r1 = out.leagues[0].conferences[0].rounds[0].slots[1];
  assert.equal(r1.winner_id, 415);
  assert.deepEqual(out.leagues[0].conferences[0].rounds[1].slots[0].sides.map((s) => s.team_id), [413, 415]);
});

test('a saved board is returned when LeagueGaming is unreachable', async () => {
  const snapshot = {
    ok: true, stale: false, season: 55, fetched_at: '2026-11-11T00:00:00.000Z',
    leagues: [{ id: 'WHL', conferences: [] }], championship: {}, teams: {}, matchups: {},
  };
  const out = await refreshFromSources({
    snapshot,
    fetchHtml: async () => '<title>Just a moment...</title>',
    now: NOW,
  });
  assert.equal(out.stale, true);
  assert.equal(out.stale_reason, 'lg_unavailable');
  assert.equal(out.fetched_at, snapshot.fetched_at);
});

import { readFileSync } from 'node:fs';
import handler, { fetchLg, __resetPlayoffCache, __setPlayoffSnapshot } from '../api/lgchl-playoffs.mjs';
import { setRestFetcher } from '../api/_lgchl.js';

function mockRes() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const realFetch = globalThis.fetch;

function stubNetwork({ fetchImpl, restRows = [] } = {}) {
  __resetPlayoffCache();
  setRestFetcher(async () => ({
    ok: true,
    status: 200,
    json: async () => restRows,
  }));
  globalThis.fetch = fetchImpl || (async () => { throw new Error('network_down'); });
}

function restoreNetwork() {
  globalThis.fetch = realFetch;
  __resetPlayoffCache();
  setRestFetcher((url, init) => fetch(url, init));
}

test('playoff API file is ESM and does not spawn curl', () => {
  const src = readFileSync(new URL('../api/lgchl-playoffs.mjs', import.meta.url), 'utf8');
  assert.equal(src.includes('child_process'), false);
  assert.equal(src.includes("spawn('curl'"), false);
  assert.match(src, /from '\.\.\/lib\/lgchl-playoff\.mjs'/);
});

test('playoff API returns the saved bracket when LeagueGaming fetch fails', async () => {
  stubNetwork({
    fetchImpl: async () => { throw new Error('network_down'); },
  });
  try {
    const res = mockRes();
    const result = await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(result, res);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.leagues) && res.body.leagues.length >= 3);
    assert.equal(res.body.matchups, undefined);
  } finally {
    restoreNetwork();
  }
});

test('playoff API still returns the saved bracket when LeagueGaming blocks the request', async () => {
  stubNetwork({
    fetchImpl: async () => ({
      status: 403,
      ok: false,
      text: async () => '<title>Just a moment...</title>',
    }),
  });
  try {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.leagues.length >= 3);
    assert.equal(res.body.ok, true);
  } finally {
    restoreNetwork();
  }
});

test('playoff API still returns the saved bracket when Supabase also fails', async () => {
  __resetPlayoffCache();
  setRestFetcher(async () => { throw new Error('supabase_down'); });
  globalThis.fetch = async () => { throw new Error('network_down'); };
  try {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.stale, true);
    assert.ok(res.body.leagues.length >= 3);
  } finally {
    restoreNetwork();
  }
});

test('fetchLg uses fetch only and throws when the official page is blocked', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    ok: true,
    text: async () => '<title>Just a moment...</title>',
  });
  try {
    await assert.rejects(() => fetchLg('https://example.invalid/bracket'), /lg_/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('playoff API returns 503 only when the saved bracket is also missing', async () => {
  const saved = JSON.parse(readFileSync(new URL('../assets/lgchl/playoffs/s55.json', import.meta.url), 'utf8'));
  setRestFetcher(async () => { throw new Error('down'); });
  globalThis.fetch = async () => { throw new Error('down'); };
  try {
    __setPlayoffSnapshot({ ok: false, leagues: [], teams: {} });
    __resetPlayoffCache();
    const empty = mockRes();
    await handler({ method: 'GET' }, empty);
    assert.equal(empty.statusCode, 503);
    assert.equal(empty.body.error, 'playoff_bracket_unavailable');
  } finally {
    __setPlayoffSnapshot(saved);
    restoreNetwork();
  }
});

test('unsupported methods are rejected without crashing', async () => {
  const res = mockRes();
  await handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.error, 'method_not_allowed');
});
