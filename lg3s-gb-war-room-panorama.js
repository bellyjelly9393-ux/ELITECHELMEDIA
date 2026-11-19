/* Panoramic GB War Room dashboard presentation.
   Strictly read-only: no new VOD jobs, writes, admin grants or model calls. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const numeric=x=>Number.isFinite(Number(x))?Number(x):0;
const TEAM=1446;
let loading=false,lastSignature="";
const monthDay=x=>{if(!x)return"TBA";try{return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",month:"short",day:"numeric"}).format(new Date(x))}catch{return"TBA"}};
const time=x=>{if(!x)return"Time TBA";try{return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",hour:"numeric",minute:"2-digit"}).format(new Date(x))}catch{return"Time TBA"}};
const flag=name=>{
 const flags={"Canada":"🇨🇦","United States":"🇺🇸","USA":"🇺🇸","Sweden":"🇸🇪","Finland":"🇫🇮","Poland":"🇵🇱","Germany":"🇩🇪","Japan":"🇯🇵","Italy":"🇮🇹","Switzerland":"🇨🇭","Latvia":"🇱🇻","Slovakia":"🇸🇰","Kazakhstan":"🇰🇿","Great Britain":"🇬🇧"};
 return flags[name]||"🏒"
};
function protectedVisible(){return $("privateApp")&&!$("privateApp").hidden&&$("gbDashboardChemistry")}
function activityRows(notes,plans,vods){
 const list=[
  ...notes.map(r=>({date:r.created_at,label:"Scouting report filed",detail:r.opponent_name,icon:"⌕"})),
  ...plans.map(r=>({date:r.updated_at,label:"Battle Plan saved",detail:r.opponent_name,icon:"✣"})),
  ...vods.map(r=>({date:r.created_at,label:"VOD reference added",detail:r.lg_game_id?"Game #"+r.lg_game_id:"Unassigned game",icon:"▷"}))
 ].filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
 const out=$("gbDashboardActivity");
 if(!list.length){out.innerHTML='<p class="gb-empty">No private scouting, Battle Plan or VOD updates have been recorded yet.</p>';return}
 out.innerHTML=list.map(r=>'<div class="gb-activity-entry"><span class="gb-activity-icon" aria-hidden="true">'+esc(r.icon)+'</span><span><b>'+esc(r.label)+'</b><small>'+esc(r.detail||"Great Britain")+' · '+esc(monthDay(r.date))+'</small></span></div>').join("");
}
function chemistryRows(lines){
 const gameMap=new Map(),seen=new Map();
 for(const line of lines){if(!line.lg_game_id||!line.lg_user_id)continue;
  const id=String(line.lg_game_id),key=String(line.lg_user_id);const players=gameMap.get(id)||new Map();
  players.set(key,line.gamertag||"LG "+key);gameMap.set(id,players);
 }
 for(const players of gameMap.values()){
  const members=[...players.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
   const key=members[i][0]+"/"+members[j][0];
   const old=seen.get(key)||{first:members[i][1],second:members[j][1],games:0};
   old.games++;seen.set(key,old);
  }
 }
 const top=[...seen.values()].sort((a,b)=>b.games-a.games).slice(0,5);
 const target=$("gbDashboardChemistry");
 if(!top.length){target.innerHTML='<p class="gb-empty">Lineup overlap will appear when verified game lines are available.</p>';return}
 const max=top[0].games;
 target.innerHTML=top.map(p=>'<div class="gb-chem-row" title="'+esc(p.first+" + "+p.second)+'"><span class="gb-chem-id">'+esc(p.first.length>9?p.first.slice(0,8)+"…":p.first)+'</span><div class="gb-chem-track"><div class="gb-chem-bar" style="width:'+Math.max(6,Math.round(100*p.games/max))+'%"></div></div><span class="gb-chem-value">'+esc(p.games)+'</span></div>').join("")+'<div class="gb-chem-explainer">Shared official game appearances, not a chemistry percentage. Tap Battle Plan for lineup decisions.</div>';
}
function gameRows(games){
 const now=new Date().toISOString().slice(0,10);
 const upcoming=games.filter(g=>String(g.game_night_date||"")>=now)
 .sort((a,b)=>String(a.scheduled_at||a.game_night_date).localeCompare(String(b.scheduled_at||b.game_night_date))).slice(0,3);
 const target=$("gbDashboardGames");
 if(!upcoming.length){target.innerHTML='<p class="gb-empty">No future Great Britain fixtures in the official LG3s feed. View the schedule for recorded games.</p>';return}
 target.innerHTML=upcoming.map(g=>{
  const opponent=g.home_lg_team_id===TEAM?g.away_nation:g.home_nation;
  const when=g.scheduled_at||g.game_night_date;
  const gameDay=monthDay(when);
  const home=g.home_lg_team_id===TEAM?"HOME":"AWAY";
  return '<div class="gb-game-tile"><span class="gb-opp-flag">'+esc(flag(opponent))+'</span><div class="gb-game-info"><strong>vs '+esc(opponent||"TBA")+'</strong><small>'+esc(home)+' · LG #'+esc(g.lg_game_id)+'</small></div><div class="gb-game-datetime"><strong>'+esc(gameDay)+'</strong><span>'+esc(time(g.scheduled_at))+' ET</span></div></div>'
 }).join("");
}
async function hydrate(){
 if(loading||!protectedVisible())return;
 const db=window.VVHLBackend?.db;
 if(!db)return;
 loading=true;
 try{
  const check=await db.auth.getUser();
  if(!check.data?.user)return;
  const member=await db.from("lg3s_gb_members").select("role").eq("user_id",check.data.user.id).eq("active",true).maybeSingle();
  if(member.error||!member.data||!protectedVisible())return;
  const [games,lines,notes,plans,vods]=await Promise.all([
   db.from("lg3s_public_games").select("lg_game_id,scheduled_at,game_night_date,home_lg_team_id,away_lg_team_id,home_nation,away_nation").or("home_lg_team_id.eq.1446,away_lg_team_id.eq.1446").order("game_night_date",{ascending:true}).limit(150),
   db.from("lg3s_public_player_lines").select("lg_game_id,lg_user_id,gamertag").eq("lg_team_id",1446).limit(1000),
   db.from("lg3s_gb_scouting").select("opponent_name,created_at").order("created_at",{ascending:false}).limit(5),
   db.from("lg3s_gb_battle_plans").select("opponent_name,updated_at").order("updated_at",{ascending:false}).limit(5),
   db.from("lg3s_gb_vod_refs").select("lg_game_id,created_at").order("created_at",{ascending:false}).limit(5)
  ]);
  if(!protectedVisible())return;
  if(!games.error)gameRows(games.data||[]);else $("gbDashboardGames").innerHTML='<p class="gb-empty">The schedule feed is temporarily unavailable.</p>';
  if(!lines.error)chemistryRows(lines.data||[]);else $("gbDashboardChemistry").innerHTML='<p class="gb-empty">Lineup evidence is temporarily unavailable.</p>';
  if(!notes.error&&!plans.error&&!vods.error)activityRows(notes.data||[],plans.data||[],vods.data||[]);
  else $("gbDashboardActivity").innerHTML='<p class="gb-empty">Activity is temporarily unavailable.</p>';
 }catch(e){console.warn("Great Britain cinematic dashboard:",e)}
 finally{loading=false}
}
function initialize(){
 const node=$("privateApp");if(!node)return;
 // The actual authorization is enforced by the existing War Room and Supabase RLS.
 const observer=new MutationObserver(()=>{
  if(protectedVisible()){const roster=$("metaRoster")?.textContent||"";
   if(roster!==lastSignature&&roster!=="ROSTER LOADING"){lastSignature=roster;hydrate()}
  }else{lastSignature=""}
 });
 observer.observe(node,{attributes:true,subtree:true,childList:true,characterData:true,attributeFilter:["hidden"]});
 window.addEventListener("vvhl-auth-change",()=>setTimeout(hydrate,160));
 if(protectedVisible())hydrate();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})();