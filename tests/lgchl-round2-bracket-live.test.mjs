import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeRoundTwoGames } from '../lib/lgchl-playoff.mjs';

const match=(a,b)=>({kind:'series',sides:[{team_id:a,seed:a===413||a===420?1:3},{team_id:b,seed:5}],score:[0,0],games:[],winner_id:null,clinched:false});
const board=(crossed=false)=>({
  ok:true,source:'Saved official bracket',fetched_at:'2026-11-23T23:00:00Z',
  leagues:[{id:'WHL',conferences:[{name:'Eastern',rounds:[
    {label:'R1',slots:[{kind:'series',score:[4,2],games:[{id:923563,status:'final'}]}]},
    {label:'R2',slots:crossed?[match(420,399),match(2981,422)]:[match(413,2983),match(377,416)]},
    {label:'R3',slots:[{kind:'pending',sides:[],score:[0,0],games:[]}]}]}]}]
});
const row=(gameId,away,home,as=null,hs=null,status='scheduled',index=0)=>({
  lg_game_id:gameId,away_lg_team_id:away,home_lg_team_id:home,
  away_score:as,home_score:hs,status,
  game_at:new Date(Date.parse('2026-11-23T02:00:00Z')+index*35*60_000).toISOString()
});
const schedule=(start,a,b,results={})=>Array.from({length:7},(_,i)=>{
  const final=results[i];
  return row(start+i,a,b,final?.[0]??null,final?.[1]??null,final?'final':'scheduled',i);
});
const slot=(out,i)=>out.leagues[0].conferences[0].rounds[1].slots[i];

test('official seven-game series recover Round 2 scores and preserve Round 1',()=>{
  const rows=[
    ...schedule(923788,2983,413,{0:[0,4],1:[0,1]}),
    ...schedule(923795,377,416,{0:[4,3],1:[7,2]}),
  ];
  const out=mergeRoundTwoGames(board(),rows);
  assert.deepEqual(slot(out,0).score,[2,0]);
  assert.deepEqual(slot(out,1).score,[2,0]);
  assert.equal(slot(out,0).games.length,7);
  assert.equal(slot(out,0).games[0].id,923788);
  assert.equal(slot(out,0).games[2].away_score,null);
  assert.equal(slot(out,0).winner_id,null);
  assert.equal(out.round2_index_series,2);
  assert.match(out.source,/Round 2 pairings/);
  assert.deepEqual(out.leagues[0].conferences[0].rounds[0].slots[0].score,[4,2]);
});

test('repairs cross-wired feeders using two disjoint official complete schedules',()=>{
  const out=mergeRoundTwoGames(board(true),[
    ...schedule(923802,2981,420,{0:[0,1],1:[2,9]}),
    ...schedule(923809,399,422,{0:[2,3],1:[1,2]}),
  ]);
  assert.deepEqual(slot(out,0).sides.map(x=>x.team_id),[420,2981]);
  assert.deepEqual(slot(out,1).sides.map(x=>x.team_id),[399,422]);
  assert.deepEqual(slot(out,0).score,[2,0]);
  assert.deepEqual(slot(out,1).score,[0,2]);
});

test('reversed home ice still credits the correct side and clinches after four',()=>{
  const first=schedule(923788,2983,413,{0:[1,4],1:[3,1],2:[5,0],3:[6,1]});
  // Game 1 goes to side A, games 2–4 go to side B.
  const result=mergeRoundTwoGames(board(),[
    ...first,
    ...schedule(923795,377,416)
  ]);
  assert.deepEqual(slot(result,0).score,[1,3]);
  assert.equal(slot(result,0).clinched,false);
  const fourB=schedule(923788,2983,413,{0:[1,4],1:[3,1],2:[5,0],3:[6,1],4:[2,1]});
  const decided=mergeRoundTwoGames(board(),[...fourB,...schedule(923795,377,416)]);
  assert.deepEqual(slot(decided,0).score,[1,4]);
  assert.equal(slot(decided,0).winner_id,2983);
  assert.equal(slot(decided,0).clinched,true);
});

test('rejects incomplete, conflicting, and unrelated schedules instead of guessing',()=>{
  const saved=board();
  const incomplete=[
    ...schedule(923788,2983,413,{0:[0,4],1:[0,1]}).slice(0,6),
    ...schedule(923795,377,416)
  ];
  assert.equal(mergeRoundTwoGames(saved,incomplete),saved);
  const tied=[
    ...schedule(923788,2983,413,{0:[1,1],1:[0,4]}),
    ...schedule(923795,377,416)
  ];
  assert.equal(mergeRoundTwoGames(saved,tied),saved);
  const other=[
    ...schedule(923788,999,998,{0:[1,0]}),
    ...schedule(923795,377,416)
  ];
  assert.equal(mergeRoundTwoGames(saved,other),saved);
});

test('does not overwrite published official series details or fabricate an update',()=>{
  const saved=board();
  saved.leagues[0].conferences[0].rounds[1].slots[0].games=[{id:923788,status:'final'}];
  const complete=[...schedule(923788,2983,413),...schedule(923795,377,416)];
  assert.equal(mergeRoundTwoGames(saved,complete),saved);
  assert.equal(mergeRoundTwoGames(board(),[]).round2_index_series,undefined);
});

test('production queries the official game index; homepage does not infer LIVE from time',()=>{
  const api=readFileSync(new URL('../api/lgchl-playoffs.js',import.meta.url),'utf8');
  const home=readFileSync(new URL('../lgchl-playoffs.js',import.meta.url),'utf8');
  const central=readFileSync(new URL('../playoff-central.js',import.meta.url),'utf8');
  assert.match(api,/loadRoundTwoIndex/);
  assert.match(api,/mergeRoundTwoGames/);
  assert.match(api,/round2_index_unavailable/);
  assert.doesNotMatch(home,/if \(now < t \+ 35 \* 60 \* 1000\) return 'live'/);
  assert.match(home,/game\.status === 'live'/);
  assert.match(central,/round: 'R2'/);
});
