const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ctx={window:{},document:{getElementById:()=>null}};
vm.runInNewContext(fs.readFileSync('lg3s-desk.js','utf8'),ctx);
const {finals,records}=ctx.window.LG3DeskData;
const game={lg_game_id:1,game_night_date:'2026-10-21',is_verified:true,status:'final',away_nation:'A',home_nation:'B',away_score:5,home_score:3};
test('finals exclude pending, invalid, tied, future and duplicate results',()=>{
 const rows=[game,{...game},{...game,lg_game_id:2,is_verified:false},{...game,lg_game_id:3,away_score:null},{...game,lg_game_id:4,away_score:-1},{...game,lg_game_id:5,away_score:3},{...game,lg_game_id:6,game_night_date:'2026-10-25'},{...game,lg_game_id:7,status:'scheduled'},{...game,lg_game_id:8,away_score:2.5}];
 assert.equal(finals(rows,'2026-10-23').length,1);
});
test('records reconcile games and goals, without fabricated overtime or points',()=>{
 const table=records([{name:'A'},{name:'B'},{name:'C'}],[game,{...game,lg_game_id:2,away_score:1,home_score:2}]);
 const a=table.find(t=>t.name==='A'),b=table.find(t=>t.name==='B'),c=table.find(t=>t.name==='C');
 assert.deepEqual([a.gp,a.w,a.l,a.gf,a.ga,a.gd],[2,1,1,6,5,1]);assert.deepEqual([b.gf,b.ga],[5,6]);assert.equal(c.gp,0);assert.equal('pts' in a,false);
});
