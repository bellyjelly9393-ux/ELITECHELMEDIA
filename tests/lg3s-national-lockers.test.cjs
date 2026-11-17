'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const roster=JSON.parse(load('data/lg3s/season1-active-roster-2026-11-14.json'));
const teamJS=load('lg3s-team.js');
const teamHTML=load('lg3s-team.html');
const cardJS=load('player-cards.js');
const expectedIds=[341,342,343,404,531,532,591,822,1079,1439,1444];

test('twelve LG3s nations have a unique team ID and Great Britain retains its 3D portal',()=>{
 assert.equal(roster.league,'lg3s');
 assert.equal(roster.season,1);
 assert.equal(roster.teams.length,12);
 assert.equal(new Set(roster.teams.map(t=>Number(t.lgTeamId))).size,12);
 assert.equal(roster.teams.find(t=>t.teamName==='Great Britain')?.lgTeamId,1446);
 assert.match(teamJS,/teamId===1446/);
 assert.match(teamJS,/lg3s-gb-locker\.html/);
});

test('all eleven non-GB nations have original jersey artwork and mapped theme colors',()=>{
 const ids=roster.teams.filter(t=>t.lgTeamId!==1446).map(t=>t.lgTeamId).sort((a,b)=>a-b);
 assert.deepEqual(ids,expectedIds);
 for(const id of ids){
  const art=load('assets/lg3s/jerseys/'+id+'.svg');
  assert.match(art,/<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(art,/<title id="title">/);
  assert.match(art,/not an official licensed uniform/);
  assert.match(teamJS,new RegExp('(?:^|[^0-9])'+id+':\\['));
 }
 assert.doesNotThrow(()=>fs.accessSync(path.join(root,'assets/lg3s/jerseys/341.svg')));
 assert.equal(fs.existsSync(path.join(root,'assets/lg3s/jerseys/1446.svg')),false);
});

test('public roster player identity uses LG IDs and does not fabricate jersey numbers',()=>{
 assert.match(roster.scope,/main-roster-only/);
 for(const team of roster.teams){
  const ids=new Set();
  for(const player of team.players){
   assert.match(String(player.lgUserId),/^[0-9]+$/);
   assert.equal(player.rosterStatus,'active');
   assert.equal(ids.has(player.lgUserId),false);
   ids.add(player.lgUserId);
  }
 }
 assert.match(teamJS,/player-cards\.html\?league=lg3s&id=/);
 assert.match(cardJS,/async function addRosterOnlyPlayers/);
 assert.match(cardJS,/player\.rosterStatus!=='active'/);
});

test('season totals come only from read-only public leader views',()=>{
 assert.match(teamJS,/lg3s_public_skater_leaders/);
 assert.match(teamJS,/lg3s_public_goalie_leaders/);
 assert.match(teamJS,/\.stats=map\.get\(p\.id\)\|\|null/);
 assert.match(teamJS,/SEASON GP/);
 assert.match(teamJS,/Concept jerseys are not official uniforms/);
 assert.doesNotMatch(teamJS,/service_role|sb_secret_/);
});

test('LG3s card page and generic locker use cache-busted assets',()=>{
 assert.match(teamHTML,/lg3s-team\.js\?v=20261117-photo11-v1/);
 assert.match(teamHTML,/lg3s-team\.css\?v=20261117-photo11-v1/);
 const cards=load('player-cards.html');
 assert.match(cards,/player-cards\.js\?v=20261115-lg3s-roster/);
 assert.match(cardJS,/lg3s-team\.html\?team=/);
 assert.match(cardJS,/lg3s-gb-locker\.html/);
});

const vm=require('node:vm');

function roomHarness(teamId){
 const nodes=new Map();
 const get=id=>{
  if(!nodes.has(id))nodes.set(id,{
   value:'',textContent:'',innerHTML:'',src:'',alt:'',href:'',
   listeners:{},setAttribute(){},addEventListener(name,cb){this.listeners[name]=cb;}
  });
  return nodes.get(id);
 };
 const document={getElementById:get,body:{style:{setProperty(){}}},title:''};
 const location={search:'?team='+teamId,href:'',replaced:null,replace(url){this.replaced=url;}};
 const fetch=async url=>{
  if(url.includes('season1-active-roster-2026-11-14.json'))return {ok:true,json:async()=>roster};
  if(url.includes('lg3s_public_skater_leaders'))return {ok:true,json:async()=>[{lg_user_id:55504,gp:12,p:20}]};
  if(url.includes('lg3s_public_goalie_leaders'))return {ok:true,json:async()=>[{lg_user_id:54463,gp:9,sv_pct:0.92}]};
  throw Error('Unexpected URL '+url);
 };
 const context={document,location,fetch,URLSearchParams,AbortSignal,console};
 return {nodes,get,document,location,context};
}

test('Canada room renders real roster identities, front jersey assets and verified season stats',async()=>{
 const h=roomHarness(341);
 vm.runInNewContext(teamJS,h.context,{timeout:2000,filename:'lg3s-team.js'});
 await new Promise(resolve=>setTimeout(resolve,25));
 const html=h.get('roomPlayers').innerHTML;
 assert.match(h.get('roomName').textContent,/Canada/);
 assert.match(h.get('roomRecord').textContent,/10 main-roster players/);
 assert.match(html,/Brayl18l/i);
 assert.match(html,/assets\/lg3s\/jerseys\/341.webp/);
 assert.match(html,/player-cards.html\?league=lg3s&id=55504&kind=skater/);
 assert.match(html,/SEASON GP<b>12<\/b>/);
 assert.match(html,/PTS<b>20<\/b>/);
 assert.match(html,/92\.0%/);
 assert.doesNotMatch(html,/#91 OVR|CAPTAIN/);
 assert.match(h.get('rosterNote').textContent,/Season-wide GP/);
 h.get('roomSearch').value='not-a-real-player';
 h.get('roomSearch').listeners.input();
 assert.match(h.get('roomPlayers').innerHTML,/No main-roster players match/);
});

test('Great Britain entry preserves separate 3D routing and does not fetch generic stalls',()=>{
 const h=roomHarness(1446);
 vm.runInNewContext(teamJS,h.context,{timeout:2000,filename:'lg3s-team.js'});
 assert.equal(h.location.replaced,'lg3s-gb-locker.html');
 assert.equal(h.nodes.size,0);
});

test('national jersey display uses the verified LGCHL physical bay without touching GB 3D',()=>{
 const css=load('lg3s-team.css');
 const overlay=load('assets/lg3s/jerseys/fabric-overlay.svg');
 assert.match(css,/hitmen-bay\.webp/);
 assert.match(css,/jersey-fabric/);
 assert.match(css,/\.jersey-hanger/);
 assert.match(teamJS,/fabric-overlay\.svg/);
 assert.match(teamJS,/nation-jersey/);
 assert.match(overlay,/<svg/);
 assert.match(overlay,/stitch/);
 assert.doesNotMatch(teamJS,/write\(|INSERT INTO|service_role/);
});

test('panoramic arena remains real navigable content with twelve nations and live identity',async()=>{
 assert.match(teamHTML,/class="arena-header"/);
 assert.match(teamHTML,/id="nationRibbon"/);
 assert.match(teamHTML,/class="room-stage"/);
 assert.match(teamHTML,/class="arena-floor"/);
 assert.match(teamHTML,/class="arena-action-bar"/);
 assert.match(teamHTML,/id="roomPrev"/);
 assert.match(teamHTML,/id="roomNext"/);
 assert.match(teamHTML,/id="roomPageStatus"/);
 const css=load('lg3s-team.css');
 assert.match(css,/repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/\.arena-side-banner/);
 assert.match(css,/\.nation-tab\.is-active/);
 const h=roomHarness(341);
 vm.runInNewContext(teamJS,h.context,{timeout:2000,filename:'lg3s-team.js'});
 await new Promise(resolve=>setTimeout(resolve,25));
 const nav=h.get('nationRibbon').innerHTML;
 assert.equal((nav.match(/class="nation-tab/g)||[]).length,12);
 assert.match(nav,/lg3s-gb-locker\.html/);
 assert.match(nav,/aria-current="page"/);
 assert.equal(h.get('roomFloorName').textContent,'CANADA');
 assert.match(h.get('roomName').textContent,/TEAM Canada/);
 assert.match(h.get('roomPlayers').innerHTML,/Brayl18l/i);
});

test('arena paging shows six verified players at a time, with the rest reachable',async()=>{
 const h=roomHarness(341);
 vm.runInNewContext(teamJS,h.context,{timeout:2000,filename:'lg3s-team.js'});
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(h.get('roomPageStatus').textContent,'STALLS 1–6 OF 10');
 assert.equal(h.get('roomPrev').disabled,true);
 assert.equal(h.get('roomNext').disabled,false);
 assert.equal((h.get('roomPlayers').innerHTML.match(/ hidden href=/g)||[]).length,4);
 h.get('roomNext').listeners.click();
 assert.equal(h.get('roomPageStatus').textContent,'STALLS 7–10 OF 10');
 assert.equal(h.get('roomPrev').disabled,false);
 assert.equal(h.get('roomNext').disabled,true);
 h.get('roomPrev').listeners.click();
 assert.equal(h.get('roomPageStatus').textContent,'STALLS 1–6 OF 10');
 h.get('roomSearch').value='Brayl18l';
 h.get('roomSearch').listeners.input();
 assert.equal(h.get('roomPageStatus').textContent,'STALLS 1–1 OF 1');
 assert.equal(h.get('roomNext').disabled,true);
});

test('all 11 national jersey photographs are valid WebP assets and retain the nation navigation order',()=>{
 const idList=[341,342,532,343,591,822,404,1439,1444,1079,531];
 for(const id of idList){
  const image=fs.readFileSync(path.join(root,'assets/lg3s/jerseys/'+id+'.webp'));
  assert.ok(image.length>10000,'photo jersey image too small for '+id);
  assert.equal(image.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(image.subarray(8,12).toString('ascii'),'WEBP');
  assert.match(teamJS,new RegExp('(?:^|[^0-9])'+id+':\\['));
 }
 assert.doesNotMatch(teamJS,/341-photo\\.svg/);
 assert.match(teamJS,/jerseys\/'+id+'\\.webp/);
 const order=['341','342','1446','532','343','591','822','404','1439','1444','1079','531'];
 assert.match(teamJS,new RegExp('const order=\\['+order.join(',')+'\\]'));
});
