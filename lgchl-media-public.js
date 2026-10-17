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
   return {mode:'live',breakouts:breakouts.map(r=>({...r,note:'Recorded LGCHL season comparison; no scouting conclusion is inferred.'})),
    movers:movers.map(r=>({...r,note:'Recorded AHL-to-LGCHL participation; no reason for the move is inferred.'})),
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
 function historyFoot(hist,row){
  if(hist?.mode!=='live')return '<div class="lg-provenance"><b>Dated snapshot · '+esc(stamp(hist?.generated_at))+'</b><span>Live history import pending. '+esc(hist?.current_source||'Source unavailable')+' · '+esc(hist?.history_source||'')+'</span></div>';
  return '<div class="lg-provenance">'+sourceLink(row.source_url,'Current season')+' · '+sourceLink(row.history_source_url,'Previous season')+
   '<span>Imported '+esc(stamp(row.imported_at))+' · history imported '+esc(stamp(row.history_imported_at))+'</span>'+
   '<span>'+(row.source_captured_at?'Source captured '+esc(stamp(row.source_captured_at)):'Original source capture time was not supplied.')+'</span></div>';
 }
 async function renderRecent(teams){
  if(!window.LGCHL_PUBLIC_MEDIA_CONFIG?.boxScores){
   $('lgTrendingRecords').innerHTML=pending('The public box-score feed is awaiting approval and source validation.');
   $('lgWeekPlayers').innerHTML=pending('Players of the Week will populate from the approved public box-score feed.');
   $('lgBoxCoverage').textContent='No box-score trends are published until the public feed is approved and validated.';
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
     '<div class="lg-jump"><b class="num">'+Number(p.points)+'</b><span>points · '+(weekly?'Week '+Number(p.week):'last 5 imported appearances')+'</span></div>'+
     '<p class="lg-line num">'+Number(p.goals)+' G · '+Number(p.assists)+' A · '+Number(p.gp)+' GP</p>'+
     '<div class="lg-provenance">'+(sources[0]?sourceLink(sources[0],'Latest LG box score'):'LG public box-score import')+
     '<span>Imported '+esc(stamp(p.imported_at))+' · fetched '+esc(stamp(p.fetched_at))+'</span>'+
     '<span>Latest recorded game: '+esc(stamp(p.last_game_at))+'</span>'+
     (sources.length>1?'<details><summary>Game sources</summary>'+sources.map((s,i)=>sourceLink(s,'Game '+(i+1))).join(' · ')+'</details>':'')+'</div></article>';
   }).join('');
  }
  const trend=results[0],week=results[1];
  $('lgTrendingRecords').innerHTML=trend.status==='fulfilled'
   ?cards(trend.value.filter(valid).filter(p=>Number(p.gp)===5),false)||pending('No qualifying five-game samples have been imported yet.')
   :pending('The public box-score feed is awaiting approval or source validation.');
  const weekly=week.status==='fulfilled'?week.value.filter(valid):[];
  $('lgWeekPlayers').innerHTML=week.status==='fulfilled'
   ?cards(weekly,true)||pending('No player game lines have been imported for the latest recorded week.')
   :pending('Players of the Week will populate from the approved public box-score feed.');
  $('lgWeekPlayersNote').textContent=weekly.length?'Week '+Number(weekly[0].week)+' · points leaders in recorded finals so far. This is a statistics board, not an editorial award.':'Highest points in the latest recorded game week; every total links to its game sources.';
  const coverage=results[2].status==='fulfilled'?results[2].value[0]:null;
  $('lgBoxCoverage').textContent=coverage&&isNumber(coverage.imported_games)&&isNumber(coverage.final_games)
   ?Number(coverage.imported_games)+' of '+Number(coverage.final_games)+' LGCHL finals imported. Only imported appearances are included. Latest import: '+stamp(coverage.imported_at)+'.'
   :'Coverage is unavailable until the public box-score migration and importer are approved. No trends are estimated.';
 }
 window.LGCHLPublicDesk={loadHistory,historyFoot,renderRecent,sourceLink,stamp};
})();
