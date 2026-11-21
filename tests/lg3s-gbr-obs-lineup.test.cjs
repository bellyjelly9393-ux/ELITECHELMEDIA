'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const lineup=JSON.parse(read('data/lg3s/gb-obs-lineup.json'));
const official=JSON.parse(read('data/lg3s/season1-active-roster-2026-11-14.json'));
const roster=official.teams.find(t=>Number(t.lgTeamId)===1446).players;
const common=read('assets/lg3s-world/assets/match-DgEO52-w.js');
const live=read('assets/lg3s-world/assets/live-gkMd1E-Q.js');
const pregame=read('assets/lg3s-world/assets/pregame-BV4tjS1-.js');
const bridge=read('assets/lg3s-world/lg3s-rink-bridge.js');
const ctl=read('obs-control.html');
const ctljs=read('obs-control.js');
test('operator-selected GB four is distinct from historical posted lineup records',()=>{
 assert.equal(lineup.schema,'lg3s-gbr-obs-lineup-v1');
 assert.equal(lineup.team_id,1446);
 assert.equal(lineup.players.length,4);
 assert.deepEqual(lineup.players.map(p=>p.slot),['C','W','D','G']);
 assert.deepEqual(lineup.players.map(p=>p.display_name),['Setty','xSogaard','Pazi','Johnny']);
 assert.deepEqual(lineup.players.map(p=>p.scene_slot_id),[1,2,3,4]);
 assert.ok(lineup.players.every(p=>p.jersey_number===null));
 for(const p of lineup.players.slice(0,3)){
   const verified=roster.find(x=>Number(x.lgUserId)===p.lg_user_id);
   assert.ok(verified,'missing verified LG3s identity '+p.display_name);
   assert.equal(verified.gamertag,p.gamertag);
 }
 assert.equal(lineup.players[3].lg_user_id,null,'Johnny must not gain fabricated LG ID');
 assert.equal(lineup.players[3].gamertag,'Johnny');
 assert.equal(lineup.status,'operator-selected');
});
test('3D rink and live UI replace the Kirk demo without pretending scene handles are numbers',()=>{
 for(const name of ['SETTY','XSOGAARD','PAZI','JOHNNY'])
  assert.ok(common.includes('"name":"'+name+'"'),name);
 assert.doesNotMatch(common,/Kirk_88|LakeShow_20|Clem_D19|BownsWall_35/);
 assert.doesNotMatch(live,/L\. Kirk|B\. Lake|D\. Clements|B\. Bowns/);
 assert.match(common,/jerseyNumber\?\?/,'jersey SVG should have blank number when unknown');
 assert.match(common,/1:\[2,0\],2:\[-5,-5\],3:\[-9,5\],4:\[-23,0\]/);
 assert.match(live,/L=\[`Setty`,`xSogaard`,`Pazi`,`Johnny`\]/);
 assert.match(live,/GB STARTING LINEUP/);
 assert.match(live,/Great Britain player identities/);
 assert.doesNotMatch(live,/<b>#\$\{e\.num\}<\/b>/);
 assert.match(bridge,/\[1,2,3,4\]\.includes\(payload\)/);
});
test('OBS control highlights only current scene positions, not old player numbers',()=>{
 for(const [num,label] of [[1,'Setty'],[2,'xSogaard'],[3,'Pazi'],[4,'Johnny']])
  assert.ok(ctl.includes('<option value="'+num+'">')&&ctl.includes(label),label);
 assert.doesNotMatch(ctl,/#88 L\. Kirk|#20 B\. Lake|#19 D\. Clements|#35 B\. Bowns/);
 assert.match(ctljs,/\[1,2,3,4\]\.includes\(Number\(p\.rinkHighlight\)\)/);
 assert.match(ctljs,/numberVal\('obsGbrHighlight'\)\|\|1/);
});
test('pregame OBS view reads operator selection without rewriting official posted game sheets',()=>{
 assert.match(pregame,/gb-obs-lineup\.json/);
 assert.match(pregame,/function obsGBLineup\(/);
 assert.match(pregame,/document\.body\.classList\.contains\(`on-air`\)/);
 assert.match(pregame,/currentGB=obsGBLineup/);
 assert.match(pregame,/for\(let match of d\)match\.gb=currentGB/);
 assert.match(pregame,/e\.id>0/,'unverified identity excluded from stat lookups');
 assert.match(pregame,/Operator-selected · LG ID not verified/);
 assert.ok(JSON.parse(read('data/lg3s/pregame-lineups.json')).games.length>=3,
   'historical posted lineup file must be unchanged and present');
});
test('3D rink displays source-linked four-player lineup beside models rather than fake jersey numbers',()=>{
 const html=read('assets/lg3s-world/rink-preview.html');
 assert.match(html,/gbRinkLineup/);
 assert.match(html,/GBR · STARTING FOUR/);
 assert.match(html,/gb-obs-lineup\.json/);
 assert.match(html,/\.textContent=slot/);
 assert.match(html,/\.display_name\.trim\(\)/);
 assert.match(html,/lineup'\)===\s*'off'/);
 assert.doesNotMatch(html,/L\. Kirk|B\. Lake|D\. Clements|B\. Bowns/);
});
test('cache-busted public HTML and modules point at the new OBS lineup assets',()=>{
 for(const file of ['assets/lg3s-world/live.html','assets/lg3s-world/pregame.html','assets/lg3s-world/rink-preview.html']){
   assert.ok(read(file).includes('20261120-gb-starting-four'),file);
 }
 assert.ok(ctl.includes('obs-control.js?v=20261120-gbr-lineup'));
 for(const js of [common,live,pregame]) assert.ok(js.length>12000);
});
