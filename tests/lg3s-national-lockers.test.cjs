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
 assert.match(teamHTML,/lg3s-team\.js\?v=20261115-jersey-v2/);
 assert.match(teamHTML,/lg3s-team\.css\?v=20261115-jersey-v2/);
 const cards=load('player-cards.html');
 assert.match(cards,/player-cards\.js\?v=20261115-lg3s-roster/);
 assert.match(cardJS,/lg3s-team\.html\?team=/);
 assert.match(cardJS,/lg3s-gb-locker\.html/);
});
