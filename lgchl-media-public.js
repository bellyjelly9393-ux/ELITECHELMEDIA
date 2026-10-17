/* Public LGCHL media projections only. No account session or privileged credentials. */
(() => {
 'use strict';
 const D=window.WMDesk;if(!D)return;
 const {$,esc,read}=D;
 const isNumber=n=>n!==null&&n!==''&&Number.isFinite(Number(n));
 const stamp=s=>s&&Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(s))+' ET':'import time unavailable';
 const logo=id=>Number.isSafeInteger(Number(id))&&Number(id)>0?'assets/lgchl/s55/team'+Number(id)+'.png':'assets/wildman/home/lgchl-logo.webp';
 function sourceLink(raw,label='LG source'){
  try{const u=new URL(raw);if(u.protocol==='https:'&&/(^|\.)leaguegaming\.com$/i.test(u.hostname))return '<a href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';}catch{}
  return esc(label);
 }
 const pending=message=>'<p class="empty">'+esc(message)+'</p>';
 async function loadHistory(){
  const columns='player_id,gamertag,position,lg_team_id,gp,points,plus_minus,ppg,source_url,history_source_url,imported_at,history_imported_at,source_captured_at';
  try{
   if(!window.LGCHL_PUBLIC_MEDIA_CONFIG?.history)throw Error('History feed is pending approval');
   const [pointer,breakouts,movers]=await Promise.all([
    read('lg_public_history_current',{select:'import_id',singleton:'eq.true'}),
    read('lgchl_public_breakout_watch',{select:columns+',goals,assists,prev_gp,prev_points,prev_ppg,improvement',order:'improvement.desc,gamertag.asc',limit:'8'}),
    read('lgchl_public_ahl_movement',{select:columns+',from_league,from_season,from_gp,from_points,from_ppg,from_plus_minus',order:'points.desc,gamertag.asc',limit:'8'})
   ]);
   if(!pointer[0]?.import_id)throw Error('No approved history import');
   const rows=[...breakouts,...movers],at=rows.map(r=>r.imported_at).filter(Boolean).sort().pop();
   return {mode:'live',breakouts:breakouts.map(r=>({...r,note:''})),
    movers:movers.map(r=>({...r,note:''})),
    breakout_rule:'Biggest rise in points per game, LGCHL S54 to S55. Minimum 6 GP in S55 and 10 GP in S54.',
    current_source:'LG Stats Client public season statistics, imported '+stamp(at),history_source:'One-way public history import'};
  }catch{
   // Preserve the supplied, clearly dated launch content until the approved history feed exists.
   try{
    const response=await fetch('data/lgchl/history-s55.json',{cache:'no-cache'});
    if(!response.ok)throw Error('Snapshot unavailable');
    return {...await response.json(),mode:'snapshot'};
   }catch{return null;}
  }
 }
 // Cards show the numbers only; sourcing stays out of the public copy.
 function historyFoot(){return '';}
 async function renderRecent(teams){
  if(!window.LGCHL_PUBLIC_MEDIA_CONFIG?.boxScores){
   ['lgTrendSec','lgPlayersWeekSec'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
   return;
  }
  const columns='gamertag,lg_team_id,gp,goals,assists,points,last_game_at,imported_at,fetched_at,source_urls';
  const results=await Promise.allSettled([
   read('lgchl_public_trending',{select:columns+',first_game_at',order:'points.desc,goals.desc,gamertag.asc',limit:'6'}),
   read('lgchl_public_weekly_players',{select:columns+',week',order:'points.desc,goals.desc,gamertag.asc',limit:'6'}),
   read('lgchl_public_box_coverage',{select:'final_games,imported_games,imported_at'})
  ]);
  const valid=p=>p&&isNumber(p.gp)&&Number(p.gp)>0&&['goals','assists','points'].every(k=>isNumber(p[k]))&&p.imported_at;
  function cards(rows,weekly){
   return rows.map(p=>{
    const team=teams.get(Number(p.lg_team_id));
    const sources=(Array.isArray(p.source_urls)?p.source_urls:[]).filter(s=>typeof s==='string');
    return '<article class="card lg-card lg-form-card"><div class="lg-card-head"><img src="'+logo(p.lg_team_id)+'" alt=""><div><b>'+esc(p.gamertag)+'</b><small>'+esc(team?.name||'Team not supplied')+'</small></div></div>'+
     '<div class="lg-jump"><b class="num">'+Number(p.points)+'</b><span>points · '+(weekly?'Week '+Number(p.week):'last 5 games')+'</span></div>'+
     '<p class="lg-line num">'+Number(p.goals)+' G · '+Number(p.assists)+' A · '+Number(p.gp)+' GP</p>'+
     (sources[0]?'<div class="lg-card-foot">'+sourceLink(sources[0],'Box score')+'</div>':'')+'</article>';
   }).join('');
  }
  const trend=results[0],week=results[1];
  $('lgTrendingRecords').innerHTML=trend.status==='fulfilled'
   ?cards(trend.value.filter(valid).filter(p=>Number(p.gp)===5),false)||pending('No players have five games in yet.')
   :pending('Trending players are on the way.');
  const weekly=week.status==='fulfilled'?week.value.filter(valid):[];
  $('lgWeekPlayers').innerHTML=week.status==='fulfilled'
   ?cards(weekly,true)||pending('No game lines in for the latest week yet.')
   :pending('Players of the Week are on the way.');
  $('lgWeekPlayersNote').textContent=weekly.length?'Week '+Number(weekly[0].week)+' · points leaders so far.':'Highest points in the latest game week.';
  $('lgBoxCoverage').textContent='';
 }
 window.LGCHLPublicDesk={loadHistory,historyFoot,renderRecent,sourceLink,stamp};
})();
