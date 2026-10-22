/* Dedicated VVHL Swolly Stampede browser-source graphics. No Hitmen dependencies. */
(function(){
'use strict';
var CHANNEL='vvhl-swolly-stampede';
if(new URLSearchParams(location.search).get('channel')!==CHANNEL)return;
var logo='assets/brand/swolly-stampede.webp';
var host=document.getElementById('obsRoot');
if(!host)return;
var root=document.createElement('section');
root.id='swollyRoot';root.className='swolly-graphics';
host.appendChild(root);
document.body.classList.add('swolly-channel');
function esc(s){return String(s===undefined||s===null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function text(v,def){return esc(String(v||def||''))}
function mark(css){return '<img class="sw-logo '+(css||'')+'" src="'+logo+'" alt="Swolly Stampede logo">'}
function heading(top,bottom){return '<div class="sw-heading"><span class="sw-kicker">'+text(top,'VVHL · SEASON 12')+'</span><h1>'+text(bottom)+'</h1></div>'}
function lower(p){return '<div class="sw-lower"><div class="sw-num">#'+text(p.playerNumber,'94')+'</div><div class="sw-lower-info"><small>'+text(p.playerRole,'LEFT WING')+' · SWOLLY STAMPEDE</small><strong>'+text(p.playerName,'CARNEY')+'</strong></div>'+mark('sw-lower-mark')+'</div>'}
function top(p){return '<div class="sw-top"><span>VVHL / SEASON 12</span><b>'+text(p.event,'VVHL · SEASON 12')+'</b><span>ELITECHEL MEDIA · LIVE</span></div>'}
function foot(p){return '<div class="sw-footer"><span>SWOLLY STAMPEDE</span><b>'+text(p.message,'BRING THE STAMPEDE')+'</b><span>VVHL · SEASON 12</span></div>'}
function scoreboard(p){return '<div class="sw-scoreline"><div class="sw-teamname">'+mark('sw-score-logo')+'<span>SWOLLY<br>STAMPEDE</span></div><b class="sw-score">'+text(p.homeScore,'0')+'</b><div class="sw-score-mid"><span>'+text(p.period,'1ST')+'</span><strong>:</strong><small>'+text(p.clock,'EA GAME CLOCK')+'</small></div><b class="sw-score">'+text(p.awayScore,'0')+'</b><div class="sw-teamname sw-away"><span>'+text(p.awayName,'OPPONENT')+'</span></div></div>'}
function card(title,desc){return '<div class="sw-minicard"><b>'+text(title)+'</b><span>'+text(desc)+'</span></div>'}
function parseRows(raw,fallback){
 var s=String(raw||fallback||'').split('\n').map(function(r){return r.trim()}).filter(Boolean).slice(0,8);
 return s.map(function(r){return r.split('|').map(function(v){return v.trim()})});
}
function roster(p){
 var rows=parseRows(p.lineup,'LW | CARNEY | #94\nC | MAXIMUS6684 |\nLD | TRMISERY |\nG | JMEN_FISH27 |');
 return '<div class="sw-roster">'+rows.map(function(r){return '<div><span>'+text(r[0],'F')+'</span><strong>'+text(r[1],'PLAYER')+'</strong><b>'+text(r[2])+'</b></div>'}).join('')+'</div>'
}
function games(p){
 var rows=parseRows(p.games,'');
 if(!rows.length)return '<p class="sw-empty">Game times and opponents will appear here when entered in the Studio.</p>';
 return '<div class="sw-games">'+rows.map(function(r,i){return '<div><span>GAME '+(i+1)+'</span><b>'+text(r[0],'TIME TBD')+'</b><strong>'+text(r[1],'OPPONENT TBD')+'</strong></div>'}).join('')+'</div>'
}
function render(row){
 var p=(row&&row.payload)||{};
 var scene=(row&&row.scene)||'starting';
 var valid=['starting','game','intermission','brb','lineup','matchup','final','social','player','schedule','webcam','alerts','transition'];
 if(valid.indexOf(scene)<0)scene='starting';
 document.body.dataset.brand='vvhl';
 document.body.dataset.scene=scene;
 document.body.dataset.preset='swolly-'+scene;
 root.dataset.scene=scene;
 var content='';
 var name=text(p.awayName,'OPPONENT');
 if(scene==='starting'){
   content='<div class="sw-split sw-start">'+mark('sw-hero-logo')+
    '<div class="sw-copy">'+heading('VVHL · SEASON 12','STREAM <em>STARTING SOON</em>')+
    '<p>THE HERD IS GATHERING.</p>'+card('TONIGHT',p.awayName?'VS '+p.awayName:'SWOLLY STAMPEDE HOCKEY')+'</div></div>'+foot(p);
 }else if(scene==='game'){
   content='<div class="sw-game-hud">'+scoreboard(p)+'</div>'+
   '<div class="sw-game-id">'+mark('sw-game-mark')+'<div><b>SWOLLY STAMPEDE</b><span>VVHL · LIVE 4s HOCKEY</span></div></div>';
 }else if(scene==='player'){
   content='<div class="sw-player-tag">'+lower(p)+'</div>';
 }else if(scene==='intermission'){
   content=top(p)+'<div class="sw-split">'+mark('sw-hero-logo')+'<div class="sw-copy">'+
    heading('THE STAMPEDE REPORT','INTERMISSION')+
    '<p>'+text(p.message,'BACK TO THE ICE SHORTLY')+'</p>'+
    '<div class="sw-result-mini">'+text(p.homeName,'SWOLLY STAMPEDE')+' <b>'+text(p.homeScore,'0')+' : '+text(p.awayScore,'0')+'</b> '+name+'</div>'+
    '<div class="sw-stats">'+card('SHOTS',[(p.intShotsHome||'—'),(p.intShotsAway||'—')].join(' / '))+
    card('HITS',[(p.intHitsHome||'—'),(p.intHitsAway||'—')].join(' / '))+
    card('FACEOFFS',[(p.intFaceoffsHome||'—'),(p.intFaceoffsAway||'—')].join(' / '))+'</div></div></div>'+foot(p);
 }else if(scene==='brb'){
   content='<div class="sw-split sw-brb">'+mark('sw-hero-logo')+'<div class="sw-copy">'+heading('SWOLLY STAMPEDE','BE RIGHT <em>BACK</em>')+
    '<p>DON’T GO ANYWHERE. THE HERD RETURNS.</p></div></div>'+foot(p);
 }else if(scene==='lineup'){
   content=top(p)+'<div class="sw-split sw-lineup"><div class="sw-copy">'+heading('SWOLLY STAMPEDE','STARTING <em>LINEUP</em>')+
    '<p>FOUR ON THE ICE · ONE MISSION</p>'+roster(p)+'</div>'+mark('sw-hero-logo')+'</div>'+foot(p);
 }else if(scene==='matchup'){
   content=top(p)+'<div class="sw-versus"><div class="sw-versus-side">'+mark('sw-matchup-logo')+
    '<b>SWOLLY STAMPEDE</b></div><strong>VS</strong><div class="sw-versus-side sw-opp">'+
    '<div class="sw-opponent-monogram">'+text((p.awayName||'OPP').slice(0,3).toUpperCase())+'</div><b>'+name+'</b></div></div>'+
    '<div class="sw-versus-detail">'+text(p.message,'VVHL · GAME NIGHT')+'</div>'+foot(p);
 }else if(scene==='final'){
   content=top(p)+'<div class="sw-split">'+mark('sw-hero-logo')+'<div class="sw-copy">'+heading('VVHL · SEASON 12','FINAL <em>BUZZER</em>')+
    '<div class="sw-final-score"><b>'+text(p.homeScore,'0')+'</b><span>SWOLLY : '+name+'</span><b>'+text(p.awayScore,'0')+'</b></div>'+
    '<p>'+text(p.message,'THANKS FOR WATCHING')+'</p></div></div>'+foot(p);
 }else if(scene==='social'){
   content=top(p)+'<div class="sw-split">'+mark('sw-hero-logo')+'<div class="sw-copy">'+heading('SWOLLY STAMPEDE','STAY <em>CONNECTED</em>')+
    '<p>FOLLOW THE HERD. NEVER MISS A GAME.</p>'+card('FOLLOW / WATCH',p.social||'SOCIAL LINKS COMING SOON')+'</div></div>'+foot(p);
 }else if(scene==='schedule'){
   content=top(p)+'<div class="sw-split sw-schedule"><div class="sw-copy">'+heading('VVHL · SWOLLY STAMPEDE','TONIGHT’S <em>GAMES</em>')+games(p)+'</div>'+mark('sw-hero-logo')+'</div>'+foot(p);
 }else if(scene==='webcam'){
   content='<div class="sw-cam-frame"><div class="sw-cam-top">VVHL · LIVE</div><div class="sw-cam-bottom">'+mark('sw-cam-logo')+' SWOLLY STAMPEDE</div></div>';
 }else if(scene==='alerts'){
   content='<div class="sw-alert">'+mark('sw-alert-logo')+'<div><small>STAMPEDE MOMENT</small><strong>'+text(p.message,'THE HERD IS HERE!')+'</strong></div></div>';
 }else if(scene==='transition'){
   content='<div class="sw-transition">'+mark('sw-hero-logo')+'<h1>THE STAMPEDE <em>IS COMING</em></h1><p>VVHL · SWOLLY STAMPEDE</p></div>';
 }
 root.innerHTML='<div class="sw-scene sw-'+scene+'"><div class="sw-ice-grid"></div><div class="sw-gold-wave"></div>'+content+'</div>';
 var stat=document.getElementById('obsStatus');
 if(stat)stat.textContent='VVHL · SWOLLY STAMPEDE';
}
window.SwollyObsRender={render:render};
render({scene:'starting',payload:{event:'VVHL · Season 12',homeName:'Swolly Stampede'}});
})();