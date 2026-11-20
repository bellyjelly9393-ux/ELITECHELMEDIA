'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('lg3s-gb-panorama.html');
const css=read('lg3s-gb-panorama.css');
const js=read('lg3s-gb-panorama.js');
const oldPublic=read('lg3s-gb-locker.html');
const oldLoader=read('lg3s-gb-locker.js');
const fixture=JSON.parse(read('data/lg3s/season1-active-roster-2026-11-14.json'));
const gb=fixture.teams.find(t=>Number(t.lgTeamId)===1446);

test('original Great Britain public 3D locker remains independent and unchanged in shape',()=>{
 assert.match(oldPublic,/<title>Great Britain 3D Locker Room/);
 assert.match(oldPublic,/id="enterLocker"/);
 assert.match(oldPublic,/id="lockerFrame"/);
 assert.match(oldPublic,/lg3s-gb-locker-config\.js/);
 assert.doesNotMatch(oldPublic,/lg3s-gb-panorama\.js/);
 assert.doesNotMatch(oldPublic,/class="room-stage"/);
 assert.match(oldLoader,/const enterRoom=/);
});
test('Great Britain public panoramic page uses actual Calgary 360 viewer architecture',()=>{
 assert.match(html,/Great Britain \| 360/);
 for(const id of ['gbPanorama','gbpEntrance','gbpCentre','gbpSearch','gbpPlayers','gbpPrev','gbpNext','gbpStallModal','gbpRosterToggle','gbpModalCard'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/vendor\/pannellum\/pannellum\.js/);
 assert.match(html,/lg3s-gb-panorama\.js/);
 assert.match(html,/lg3s-gb-locker\.html/);
 assert.match(css,/\.gbp-hotspot/);
 assert.match(js,/pannellum\.viewer/);
 assert.match(js,/type:'equirectangular'/);
 assert.match(js,/createTooltipFunc:playerHotspot/);
 assert.match(js,/viewer\.loadScene/);
 assert.match(js,/viewer\.lookAt/);
});
test('shared panoramic scene sources and vendor assets actually exist',()=>{
 for(const filename of ['vendor/pannellum/pannellum.js','vendor/pannellum/pannellum.css','assets/lg3s/team1446.svg','assets/lg3s/scene/gb-royal-blue.webp'])
  assert.ok(fs.statSync(path.join(root,filename)).size>500,filename);
 for(const scene of ['entrance','centre']){
  const file=path.join(root,'assets/lgchl/room-360/'+scene+'-gear-v7.png');
  const png=fs.readFileSync(file);
  assert.ok(png.length>1000000,file);
  assert.equal(png.subarray(1,4).toString('ascii'),'PNG',file);
 }
});
test('verified public GB roster is used, with no fictional player numbers, private VOD or permissions',()=>{
 assert.equal(fixture.league,'lg3s');
 assert.equal(fixture.season,1);
 assert.equal(gb.teamName,'Great Britain');
 assert.equal(gb.players.length,11);
 assert.equal(new Set(gb.players.map(p=>Number(p.lgUserId))).size,11);
 assert.ok(gb.players.every(p=>p.rosterStatus==='active'&&Number.isSafeInteger(Number(p.lgUserId))&&p.jerseyNumber==null));
 assert.match(js,/TEAM_ID=1446/);
 assert.match(js,/rosterStatus==='active'/);
 assert.match(js,/cardLink=p=>/);
 assert.match(js,/player-cards\.html\?league=lg3s&id=/);
 assert.doesNotMatch(js,/service_role|sb_secret_|lg3s_gb_members|lg3s_gb_vod_refs/);
 assert.doesNotMatch(html,/overall:|[0-9]{2} OVR|#97\b/);
});
test('both room views assign 11 positions and can find the real GB players',()=>{
 const extract=name=>{
  const m=js.match(new RegExp(name+":\\{title:'[^']+',image:'[^']+',coords:\\[(.*?)\\]\\}"));
  assert.ok(m,name+' scene coordinates');
  return [...m[1].matchAll(/\[-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\]/g)].length;
 };
 assert.equal(extract('entrance'),11);
 assert.equal(extract('centre'),11);
 assert.match(js,/const q=search\.value\.trim\(\)/);
 assert.match(js,/showPlayer\(match\)/);
});
