import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseLgGamePage } from '../supabase/functions/hitmen-recap-autowriter/parse.mjs';
import { composeRecap } from '../supabase/functions/hitmen-recap-autowriter/compose.mjs';

const dir = new URL('./fixtures/hitmen-recap/', import.meta.url);
const games = JSON.parse(fs.readFileSync(new URL('games.json', dir)));
const page = (id) => fs.readFileSync(new URL(`lg_${id}.html`, dir), 'utf8');
const teams = {
  412: { name: 'Calgary Hitmen', nickname: 'Hitmen', abbr: 'CGY' }, 418: { name: 'Lethbridge Hurricanes', nickname: 'Hurricanes', abbr: 'LET' },
  2983: { name: 'Chilliwack Bruins', nickname: 'Bruins', abbr: 'CHW' }, 385: { name: 'Red Deer Rebels', nickname: 'Rebels', abbr: 'RDR' },
  416: { name: 'Medicine Hat Tigers', nickname: 'Tigers', abbr: 'MH' },
};
const ctx = (id) => ({ calgaryId: 412, teams, game_at: '2026-10-14T01:00:00Z', week: 3, game_no: 25, schedule_game_id: null, source_url: 'https://www.leaguegaming.com/x?gameid=' + id });

test('real LG pages reconcile with the official finals', () => {
  const k = parseLgGamePage(page(917493), games[917493]);
  assert.equal(k.status, 'REG');
  assert.deepEqual(k.periods[418], [1, 1, 2]);
  assert.equal(k.records[412], '11-12-2');
  const kud = k.goalies.find((g) => g.gamertag === 'Kudolken');
  assert.deepEqual([kud.saves, kud.shots_against, kud.goals_against], [13, 17, 4]);
  assert.deepEqual(k.team[418].pp, [3, 3]);
  assert.equal(k.team[412].shots, 21);
  const ot = parseLgGamePage(page(917523), games[917523]);
  assert.equal(ot.status, 'OT');
  assert.deepEqual(ot.periods[2983], [1, 0, 3, 0, 1]);
  assert.equal(ot.skaters.find((p) => p.gamertag === 'geocustom').goals, 3);
  assert.ok(ot.skaters.find((p) => p.gamertag === 'iCLassYxTTV').gwg);
  assert.equal(parseLgGamePage(page(917212), games[917212]).status, 'OT');
});

test('pages that do not match the official final are rejected', () => {
  assert.throws(() => parseLgGamePage(page(917493), { ...games[917493], away_score: 5 }), /reconcile|match/);
  assert.throws(() => parseLgGamePage(page(917493), { ...games[917493], lg_game_id: 917494 }), /game id/);
  assert.throws(() => parseLgGamePage(page(917493), { ...games[917493], status: 'scheduled' }), /official final/);
  assert.throws(() => parseLgGamePage('<html><title>Just a moment...</title>cf-chl-x</html>', games[917493]), /Cloudflare/);
  const broken = page(917554).replace(/(geocustom<\/a>[\s\S]*?<td[^>]*>)\s*3</, '$1 2<');
  assert.throws(() => parseLgGamePage(broken, games[917554]));
});

test('recaps use only parsed numbers', () => {
  for (const id of Object.keys(games)) {
    const g = parseLgGamePage(page(id), games[id]);
    const r = composeRecap(g, ctx(id));
    assert.ok(r.title.length > 10 && r.title.length <= 160);
    assert.match(r.body, /\n\nThree stars\n1\. /);
    assert.match(r.body, /\nSource: LeagueGaming Game \d+ public box score/);
    // Every number in the body traces to the page or the official final.
    const allowed = new Set(JSON.stringify(g).match(/\d+(?:\.\d+)?/g));
    for (const t of r.body.match(/\b\d+:\d\d\b/g) || []) assert.ok(page(id).includes('>' + t + '<') || page(id).includes(' ' + t + '<'), `time ${t} not on page ${id}`);
    for (const n of r.body.replace(/\b\d+:\d\d\b/g, '').match(/\d+(?:\.\d+)?/g)) assert.ok(allowed.has(n) || /^\d$/.test(n), `unexpected number ${n} in ${id}`);
    assert.equal(r.metrics.lg_game_id, Number(id));
  }
  const k = composeRecap(parseLgGamePage(page(917493), games[917493]), ctx(917493));
  assert.equal(k.title, 'KOLLER Blanks Calgary as Lethbridge Wins 4–0');
  assert.match(k.body, /Kudolken made 13 saves on 17 shots/);
  assert.equal(k.metrics.final, '0-4');
  const ot = composeRecap(parseLgGamePage(page(917523), games[917523]), ctx(917523));
  assert.equal(ot.metrics.final, '4-5 OT');
  assert.match(ot.body, /Calgary led 2–1 after one period and 4–1 after two\. Chilliwack scored three times in the third to force overtime at 4–4\./);
  assert.match(ot.body, /Calgary gets a point and moves to 11-12-3\./);
});
