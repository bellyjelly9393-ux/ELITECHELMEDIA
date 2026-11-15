/* Node source-level regression for Japan Nation 3D prototype.
 * Uses the saved, explicit Nov 14 roster; no live player data is invented. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const path=n=>join(__dirname,'..',n);
const roster=JSON.parse(readFileSync(path('data/lg3s/season1-active-roster-2026-11-14.json'),'utf8'));
const html=readFileSync(path('lg3s-japan-locker.html'),'utf8');
const css=readFileSync(path('lg3s-japan-locker.css'),'utf8');
const shell=readFileSync(path('lg3s-japan-shell.js'),'utf8');
const scene=readFileSync(path('lg3s-japan-3d.js'),'utf8');
const team=readFileSync(path('lg3s-team.js'),'utf8');
const media=readFileSync(path('lg3s-media.js'),'utf8');
const gb=readFileSync(path('lg3s-gb-locker.js'),'utf8');
const config=readFileSync(path('lg3s-gb-locker-config.js'),'utf8');

test('Japan is team 591 with 11 distinct verified active main-roster player IDs',()=>{
 assert.equal(roster.league,'lg3s');assert.equal(roster.season,1);
 assert.equal(roster.capturedOn,'2026-11-14');
 const japan=roster.teams.find(t=>t.teamName==='Japan'&&t.lgTeamId===591);
 assert.ok(japan);
 const players=japan.players.filter(p=>p.rosterStatus==='active');
 assert.equal(players.length,11);
 assert.equal(new Set(players.map(p=>p.lgUserId)).size,players.length);
 assert.ok(players.every(p=>Number.isSafeInteger(Number(p.lgUserId))&&Number(p.lgUserId)>0&&p.gamertag));
});
test('No unverified jersey numbers are published as player facts',()=>{
 const japan=roster.teams.find(t=>t.lgTeamId===591);
 assert.ok(japan.players.every(p=>p.jerseyNumber===null));
 assert.match(html,/Real player number: unverified/);
 assert.match(shell,/number:null/);
 assert.match(shell,/NOT the player/);
 assert.doesNotMatch(scene,/jerseyNumber.*\|\|\s*22/);
});
test('Actual 3D renderer and red/black jersey silhouette are present',()=>{
 assert.match(scene,/from 'three'/);
 assert.match(scene,/OrbitControls/);
 assert.match(scene,/WebGLRenderer/);
 assert.match(scene,/ExtrudeGeometry/);
 assert.match(scene,/drawJapanFront/);
 assert.match(scene,/drawJapanBack/);
 assert.match(scene,/const baySlots=\[\]/);
 assert.match(scene,/for\(const x of \[-6\.8,-3\.4,0,3\.4,6\.8\]\)/);
 assert.match(scene,/for\(const z of \[-5,0,5\]\)/);
 assert.match(scene,/if\(players\.length!==11\)/);
 assert.match(scene,/redGlow/);
});
test('Card and nation links use actual IDs and preserve the Great Britain 3D route',()=>{
 assert.match(shell,/player-cards\.html\?league=lg3s&id=/);
 assert.match(shell,/player=\x27/);
 assert.match(team,/id===1446\?\x27lg3s-gb-locker\.html\x27/);
 assert.match(team,/id===591\?\x27lg3s-japan-locker\.html\x27/);
 assert.match(team,/teamId===1446&&params\.get\(\x27fallback\x27\)!==\x271\x27/);
 assert.match(media,/id === 1446 \? 'lg3s-gb-locker\.html'/);
 assert.match(media,/id === 591 \? 'lg3s-japan-locker\.html'/);
 assert.match(gb,/window\.ECM_GB_LOCKER_ORIGIN/);
 assert.match(config,/elitechel-gb-locker/);
});
test('Japan preview retains accessible 2D fallback and source disclosure',()=>{
 for(const id of ['japanScene','rosterGrid','playerSearch','sceneStatus','playerCardLink','jerseyPreviewNumber','toggleInteraction'])
  assert.ok(html.includes('id="'+id+'"'),id+' missing');
 assert.match(html,/team=591&amp;fallback=1/);
 assert.match(html,/not a licensed national uniform/i);
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/type="importmap"/);
});
test('Mobile vertical scrolling is protected when touch orbit is disabled',()=>{
 assert.match(scene,/enableMobileInteraction\(false\)/);
 assert.match(scene,/pointerEvents=active\?'auto':'none'/);
 assert.match(scene,/touchAction=active\?'none':'pan-y'/);
 assert.match(css,/\.scene-surface canvas\{[^}]*touch-action:pan-y/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('No local player data persistence or private Labs integration',()=>{
 assert.doesNotMatch(shell+scene,/localStorage|sessionStorage|\.from\(['"](?:private|elite_labs)|eval\(/i);
 assert.match(shell,/saved public LG3s Season 1 roster/i);
 assert.match(shell,/2026-11-14\.json/);
});
test('All authored JavaScript files parse and CSS blocks balance',()=>{
 new Function(shell);
 new Function(scene.replace(/^import .*?;\n/gm,''));
 new Function(team);new Function(media);
 let depth=0;for(const c of css){if(c==='{')depth++;if(c==='}')depth--;assert.ok(depth>=0,'CSS braces negative');}
 assert.equal(depth,0);
});
