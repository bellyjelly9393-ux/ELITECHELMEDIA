import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeRoundTwoGames } from '../lib/lgchl-playoff.mjs';

const board = () => ({
  ok: true, source: 'Saved official bracket', fetched_at:'2026-11-23T23:00:00Z',
  leagues:[{id:'WHL',conferences:[{name:'Eastern',rounds:[
    {label:'R1',slots:[{kind:'series',score:[4,2],games:[{id:923563,status:'final'}]}]},
    {label:'R2',slots:[{kind:'series',sides:[{team_id:413},{team_id:2983}],score:[0,0],games:[],winner_id:null,clinched:false}]},
    {label:'R3',slots:[{kind:'pending',sides:[],score:[0,0],games:[]}]}]}]}]
});
const row=(n,away=2983,home=413,as=null,hs=null,status='scheduled')=>({
  lg_game_id:923788+n,away_lg_team_id:away,home_lg_team_id:home,
  away_score:as,home_score:hs,status,game_at:new Date(Date.parse('2026-11-23T02:00:00Z')+n*35*60_000).toISOString()
});

test('recover exact-match Round 2 from complete official game IDs while preserving R1',()=>{
  const games=[
    row(0,2983,413,0,4,'final'),
    row(1,2983,413,0,1,'final'),
    ...[2,3,4,5,6].map(n=>row(n))
  ];
  const result=mergeRoundTwoGames(board(),games);
  const rounds=result.leagues[0].conferences[0].rounds;
  const slot=rounds[1].slots[0];
  assert.deepEqual(slot.score,[2,0]);
  assert.equal(slot.games.length,7);
  assert.equal(slot.games[0].id,923788);
  assert.equal(slot.games[0].status,'final');
  assert.equal(slot.games[2].away_score,null);
  assert.equal(slot.winner_id,null);
  assert.equal(slot.clinched,false);
  assert.deepEqual(rounds[0].slots[0].score,[4,2]);
  assert.deepEqual(rounds[2].slots[0].score,[0,0]);
  assert.match(result.source,/Round 2 schedules/);
  assert.equal(result.round2_index_series,1);
});

test('reversed home-ice orientation still credits the correct series side',()=>{
  const result=mergeRoundTwoGames(board(),[
    row(0,413,2983,2,3,'final'),
    row(1,2983,413,4,3,'final'),
    row(2,2983,413,5,0,'final'),
    row(3,2983,413,7,0,'final'),
    row(4,2983,413,1,0,'final'),
  ]);
  const slot=result.leagues[0].conferences[0].rounds[1].slots[0];
  assert.deepEqual(slot.score,[0,5]);
  assert.equal(slot.winner_id,2983);
  assert.equal(slot.clinched,true);
});

test('ignore other matchups, duplicates, ties, and unfinished games',()=>{
  const games=[
    row(0,999,998,4,0,'final'),
    row(0,2983,413,0,4,'final'),
    row(1,2983,413,1,1,'final'),
    row(2,2983,413,0,3,'scheduled'),
    row(3,2983,413,0,3,'in_progress'),
    {...row(4,2983,413,0,3,'final'),game_at:'2026-11-02T00:00:00Z'},
    row(5,2983,413,0,3,'final'),
  ];
  const s=mergeRoundTwoGames(board(),games).leagues[0].conferences[0].rounds[1].slots[0];
  assert.deepEqual(s.score,[2,0]);
  assert.equal(s.games.length,4);
  assert.equal(s.games.filter(g=>g.status==='final').length,2);
  assert.equal(s.games.filter(g=>g.status==='in_progress').length,1);
  assert.equal(s.games[2].away_score,null);
});

test('does not override known official series details or fabricate an update',()=>{
  const p=board();
  p.leagues[0].conferences[0].rounds[1].slots[0].games=[{id:100,status:'final'}];
  const output=mergeRoundTwoGames(p,[row(0,2983,413,0,4,'final')]);
  assert.equal(output,p);
  assert.equal(mergeRoundTwoGames(board(),[]).leagues[0].conferences[0].rounds[1].slots[0].games.length,0);
});

test('production API uses the official index and homepage does not infer LIVE from a kickoff clock',()=>{
  const api=readFileSync(new URL('../api/lgchl-playoffs.js',import.meta.url),'utf8');
  const home=readFileSync(new URL('../lgchl-playoffs.js',import.meta.url),'utf8');
  assert.match(api,/loadRoundTwoIndex/);
  assert.match(api,/mergeRoundTwoGames/);
  assert.match(api,/round2_index_unavailable/);
  assert.doesNotMatch(home,/if \(now < t \+ 35 \* 60 \* 1000\) return 'live'/);
});
