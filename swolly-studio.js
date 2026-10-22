/* VVHL > Swolly Stampede: standalone studio controls over existing RLS table. */
(function(){
'use strict';
var channel='vvhl-swolly-stampede';
var cfg=[['starting','Starting Soon','Opening slate'],['game','Live Game','On-ice scorebug'],['intermission','Intermission','Recap and stats'],['brb','Be Right Back','Break slate'],['lineup','Starting Lineup','4s hockey roster'],['matchup','Matchup','Nation-style versus'],['final','Final','Postgame board'],['social','Social','Follow the herd'],['player','Player Spotlight','Lower third'],['schedule','Tonight’s Games','Game night schedule'],['webcam','Webcam Frame','Transparent camera border'],['alerts','Stampede Alert','Moment graphic'],['transition','Transition','Mammoth takeover']];
var current='starting',working=false,nextScene=null,lastPublished=null,initialized=false;
function id(k){return document.getElementById(k)}
function val(k){return String(id(k)?.value||'').trim()}
function editStatus(s,fail){var el=id('swollyStatus');if(el){el.textContent=s;el.dataset.error=fail?'1':'0'}}
function canAccess(){var state=window.VVHLBackend?.state;return Boolean(state?.user&&window.VVHLManagementGuard?.hasAccess(state))}
function selectTeam(){
 var selector=id('obsTeamSelect');if(!selector)return '';
 var selected=selector.value;
 // State and RLS remain scoped to a valid team that this signed-in manager controls.
 if(lastPublished&&[...selector.options].some(function(o){return o.value===lastPublished.team_id}))return lastPublished.team_id;
 return selected;
}
function payload(){
 return {presetId:'swolly-'+current,event:val('swEvent')||'VVHL · Season 12',homeName:'Swolly Stampede',awayName:val('swOpponent'),
 homeScore:Math.max(0,Number(val('swHomeScore'))||0),awayScore:Math.max(0,Number(val('swAwayScore'))||0),
 period:val('swPeriod')||'1ST',clock:'EA GAME CLOCK',
 message:val('swHeadline'),playerName:val('swPlayerName')||'CARNEY',playerNumber:val('swPlayerNumber')||'94',
 playerRole:val('swPlayerRole')||'LW',lineup:val('swRoster'),games:val('swGames'),social:val('swSocial'),
 streamUrl:val('swStreamUrl'),streamProvider:'auto',streamMuted:false,feedLayout:'full',
 showScoreboard:false,logoBug:'off',bugPosition:'hidden'};
}
function set(k,v){if(id(k))id(k).value=v===undefined||v===null?'':String(v)}
function fill(row){
 if(!row)return;
 lastPublished=row;
 var p=row.payload||{};current=cfg.some(function(x){return x[0]===row.scene})?row.scene:'starting';
 set('swEvent',p.event||'VVHL · Season 12');set('swOpponent',p.awayName||'');
 set('swHomeScore',p.homeScore||0);set('swAwayScore',p.awayScore||0);set('swPeriod',p.period||'1ST');
 set('swHeadline',p.message||'');set('swPlayerName',p.playerName||'CARNEY');
 set('swPlayerNumber',p.playerNumber||'94');set('swPlayerRole',p.playerRole||'LW');
 set('swRoster',p.lineup||'LW | CARNEY | #94\nC | MAXIMUS6684 |\nLD | TRMISERY |\nG | JMEN_FISH27 |');
 set('swGames',p.games||'');set('swSocial',p.social||'');set('swStreamUrl',p.streamUrl||'');
 active();
}
function active(){
 document.querySelectorAll('[data-sw-scene]').forEach(function(b){var on=b.dataset.swScene===current;b.classList.toggle('sw-active',on);b.setAttribute('aria-pressed',on?'true':'false')});
 var name=cfg.find(function(r){return r[0]===current});
 if(id('swollyCurrentScene'))id('swollyCurrentScene').textContent=name?name[1]:'Starting Soon';
}
function urls(){
 var origin=location.origin;
 var overlay=origin+'/obs-overlay.html?channel='+encodeURIComponent(channel);
 var combined=origin+'/obs-stage.html?channel='+encodeURIComponent(channel);
 var feed=combined+'&layer=feed';
 set('swOverlayUrl',overlay);set('swCombinedUrl',combined);set('swFeedUrl',feed);
 id('swOverlayOpen').href=overlay;id('swCombinedOpen').href=combined;id('swFeedOpen').href=feed;
 id('swollyPreview').src='obs-overlay.html?channel='+encodeURIComponent(channel)+'&preview=1';
}
async function load(){
 if(!canAccess()||!window.VVHLBackend?.db)return;
 editStatus('LOADING');
 try{
  var r=await window.VVHLBackend.db.from('obs_broadcast_state').select('*').eq('channel',channel).maybeSingle();
  if(r.error)throw r.error;
  if(r.data){fill(r.data);editStatus('SAVED · '+String(r.data.scene||'').toUpperCase())}
  else{editStatus('READY · PUBLISH YOUR FIRST SCENE')}
 }catch(e){editStatus('LOAD ERROR · '+e.message,true)}
}
async function publish(scene){
 if(!canAccess()){editStatus('SIGN IN AS MANAGEMENT',true);return}
 current=scene||current;active();
 if(working){nextScene=current;return}
 working=true;
 editStatus('PUBLISHING · '+current.toUpperCase());
 var selectedTeam=selectTeam();
 if(!selectedTeam){editStatus('SELECT AN AUTHORIZED TEAM ABOVE',true);working=false;return}
 try{
 var db=window.VVHLBackend?.db;
 var state=window.VVHLBackend?.state;
 var row={channel:channel,team_id:selectedTeam,brand:'vvhl',scene:current,payload:payload(),is_public:true,updated_by:state.user.id,updated_at:new Date().toISOString()};
 var r=await db.from('obs_broadcast_state').upsert(row,{onConflict:'channel'}).select('*').single();
 if(r.error)throw r.error;
 lastPublished=r.data;editStatus('LIVE · '+current.toUpperCase());
 }catch(e){editStatus('PUBLISH FAILED · '+e.message,true)}
 finally{working=false;if(nextScene){var next=nextScene;nextScene=null;publish(next)}}
}
function copy(k){
 var el=id(k);if(!el)return;
 var value=el.value;
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(value).then(function(){editStatus('SOURCE URL COPIED')}).catch(function(){el.select();document.execCommand('copy')});
 else{el.select();document.execCommand('copy');editStatus('SOURCE URL COPIED')}
}
function init(){
 if(initialized||!canAccess()||!id('swollyStudio'))return;
 initialized=true;
 id('swSceneButtons').innerHTML=cfg.map(function(c){return '<button type="button" class="sw-scene-btn" data-sw-scene="'+c[0]+'" aria-pressed="false"><b>'+c[1]+'</b><span>'+c[2]+'</span></button>'}).join('');
 id('swSceneButtons').addEventListener('click',function(e){
  var b=e.target.closest('[data-sw-scene]');if(!b)return;publish(b.dataset.swScene);
 });
 id('swPublish').addEventListener('click',function(){publish(current)});
 id('swReload').addEventListener('click',load);
 [['swCopyOverlay','swOverlayUrl'],['swCopyCombined','swCombinedUrl'],['swCopyFeed','swFeedUrl']].forEach(function(pair){id(pair[0]).addEventListener('click',function(){copy(pair[1])})});
 urls();active();load();
}
window.addEventListener('vvhl-auth-change',init);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();