import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bracket=JSON.parse(read('assets/lgchl/playoffs/s55.json'));
const js=read('playoff-central.js');
const sql=read('supabase/migrations/20261115000000_ecm_playoff_predictor_s55.sql');
const page=read('playoff-central.html');
const home=read('index.html');
const lg=read('lgchl-media.html');

test('browser bundle parses cleanly',()=>{assert.doesNotThrow(()=>new vm.Script(js));});
test('playoff scoreboard uses official bracket and never guesses live state from schedule',()=>{
 assert.match(js,/\/api\/lgchl-playoffs/);
 assert.match(js,/g\.status === 'live'/);
 assert.match(js,/label = 'Await'/);
 assert.match(js,/data\.stale/);
 assert.match(page,/id="pcScoreGrid"/);
});
test('snapshot contains twelve distinct first-round eligible series',()=>{
 const entries=bracket.leagues.flatMap(l=>l.conferences.flatMap(c=>c.rounds.filter(r=>r.label==='R1').flatMap(r=>r.slots.filter(s=>s.kind==='series'))));
 assert.equal(entries.length,12);
 assert.equal(new Set(entries.map(e=>e.id)).size,12);
 for(const s of entries){
   assert.ok(s.sides?.length===2);
   assert.ok(s.sides.every(t=>Number.isInteger(t.team_id)&&Number.isInteger(t.seed)));
   assert.ok(s.games?.[0]?.at);
 }
});
test('predictor schemas restrict reads and prohibit public direct pick writes',()=>{
 for(const name of ['ecm_playoff_series','ecm_playoff_handles','ecm_playoff_picks']){
   assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security','i'));
 }
 assert.match(sql,/grant select on public\.ecm_playoff_handles,public\.ecm_playoff_picks to authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete|all) on public\.ecm_playoff_picks to (anon|authenticated)/i);
 assert.match(sql,/clock_timestamp\(\)/);
 assert.match(sql,/complete_round_required/);
 assert.match(sql,/is_open\)\s*values[\s\S]*false/);
});
test('leaderboard points derive only from verified winners and expose eligibility',()=>{
 assert.match(sql,/confirmed_winner_id/);
 assert.match(sql,/verified_at is not null/);
 assert.match(sql,/10\*count\(\*\) filter\(where correct\)/);
 assert.match(sql,/grand_prize_eligible boolean/);
 assert.match(page,/Grand Prize/);
});
test('navigation links to the new dashboard',()=>{
 assert.match(home,/href="playoff-central\.html"/);
 assert.match(lg,/href="playoff-central\.html"/);
 assert.match(page,/id="pcLeaders"/);
 assert.match(page,/id="pcBallot"/);
});


test('predictor series-length changes use the same ID key as saved and submitted picks',()=>{
 assert.match(js,/const seriesKey = \(id\) => String\(id\)/);
 assert.match(js,/state\.saved\.set\(seriesKey\(x\.series_id\),x\)/);
 assert.match(js,/state\.picks\.get\(seriesKey\(s\.id\)\)/);
 assert.match(js,/state\.saved\.get\(seriesKey\(s\.id\)\)/);
 assert.match(js,/state\.picks\.set\(s,\{\.\.\.current,games:Number\(select\.value\)\}\)/);
 assert.match(js,/\[4,5,6,7\]\.map/);
 const saved=new Map([['101',{winner_id:11,games:6}]]);
 const picks=new Map();
 for(const games of [4,5,6,7]){
   const fromDom='101';
   const previous=picks.get(fromDom)||saved.get(fromDom);
   picks.set(fromDom,{...previous,games});
   const rendered=picks.get(String(101))||saved.get(String(101));
   assert.equal(rendered.games,games);
   assert.equal(rendered.winner_id,11);
 }
});
