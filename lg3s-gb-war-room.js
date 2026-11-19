(()=>{'use strict';
const TEAM=1446,SEASON=1;
const $=id=>document.getElementById(id);
const db=()=>window.VVHLBackend?.db;
const state={user:null,member:null,stalls:[],profiles:[],games:[],lines:[],notes:[],plans:[],vod:[],requests:[],allMembers:[],opponentLines:[],opponent:"",view:"headquarters",selectedStall:null,refreshing:false};
const E=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtNum=n=>Number(n||0).toLocaleString("en-CA");
const manager=()=>["owner","gm","agm"].includes(state.member?.role);
const owner=()=>state.member?.role==="owner";
const n=v=>Number(v)||0;
const dateLabel=d=>{try{return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",weekday:"short",month:"short",day:"numeric"}).format(new Date(d))}catch{return d||"TBA"}};
const timeLabel=d=>{try{return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",hour:"numeric",minute:"2-digit"}).format(new Date(d))}catch{return "Time TBA"}};
function msg(text){$("messages").textContent=text||""}
function view(name){
 if(!$("view-"+name))return;
 state.view=name;
 document.querySelectorAll(".view").forEach(x=>x.hidden=x.id!=="view-"+name);
 document.querySelectorAll("#roomNav button").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
 const names={headquarters:"WAR ROOM",locker:"360° LOCKER ROOM",schedule:"THIS WEEK",scouting:"SCOUTING DESK",battle:"BATTLE PLAN",vod:"VOD CONTROL CENTER",stalls:"PLAYER STALLS",access:"TEAM ACCESS"};
 $("viewTitle").textContent=names[name]||"WAR ROOM";
 $("viewSubtitle").textContent={headquarters:"Your dressing room. Your opponents. Your game plan.",locker:"Step into the room, then open your private stall.",schedule:"The real LG3s fixture board for Great Britain.",scouting:"Real box scores, separate from coaching hypotheses.",battle:"Choose your four and prepare for the matchup.",vod:"Your evidence and private game-film references.",stalls:"Main roster, Training Camp and player development.",access:"Verify Discord-linked player accounts before approving."}[name];
 msg("");document.querySelector(".sidebar")?.classList.remove("open");window.scrollTo(0,0);
 if(name==="scouting")renderScouting();
 if(name==="battle")renderBattle();
 if(name==="access")renderAccess();
}
function setGate(which){
 $("authShell").hidden=which==="member";
 $("privateApp").hidden=which!=="member";
 $("pendingBox").hidden=which!=="pending";
}
async function query(table,cols="*"){const r=await db().from(table).select(cols);if(r.error)throw r.error;return r.data||[]}
async function boot(){
 if(!db()||state.refreshing)return;
 state.refreshing=true;
 try{
  const {data:{user},error}=await db().auth.getUser();
  if(error)throw error;
  state.user=user||null;
  if(!user){state.member=null;setGate("guest");return}
  const membership=await db().from("lg3s_gb_members").select("role,lg_user_id,active").eq("user_id",user.id).maybeSingle();
  if(membership.error)throw membership.error;
  state.member=membership.data?.active?membership.data:null;
  if(!state.member){setGate("pending");await loadMyRequest();return}
  setGate("member");$("sideUser").textContent=(user.user_metadata?.full_name||user.user_metadata?.name||"Signed in")+
    " · "+state.member.role.toUpperCase();
  $("roleBadge").textContent=state.member.role.toUpperCase()+" ACCESS";
  $("accessNav").hidden=!owner();
  // A rendering or optional data-feed failure must NOT revoke an already-verified team login.
  // Access is established above from the authenticated Supabase user and RLS-backed membership.
  try{
   await loadTeam();
  }catch(dataError){
   console.error("GB War Room data load:",dataError);
   msg("You are signed in with "+state.member.role.toUpperCase()+" access. Some team panels failed to load. Refresh the page to retry.");
  }
 }catch(err){console.error("GB War Room sign-in:",err);setGate("guest");$("joinMessage").textContent="Could not verify sign-in. Try refreshing or signing in again."}
 finally{state.refreshing=false}
}
async function loadMyRequest(){
 const r=await db().from("lg3s_gb_join_requests").select("claimed_gamertag,status").eq("user_id",state.user.id).maybeSingle();
 if(r.data)$("joinMessage").textContent="Existing request for "+r.data.claimed_gamertag+" · "+r.data.status.toUpperCase();
}
async function loadTeam(){
 const [stalls,profiles,games,lines,notes,plans,vod]=await Promise.all([
 query("lg3s_gb_stalls","id,lg_user_id,gamertag,position,roster_status"),
 query("lg3s_gb_stall_profiles","stall_id,theme,motto,development_focus"),
 db().from("lg3s_public_games").select("lg_game_id,scheduled_at,game_night_date,home_lg_team_id,away_lg_team_id,home_nation,away_nation,home_score,away_score,status_label,is_verified").or("home_lg_team_id.eq.1446,away_lg_team_id.eq.1446").order("scheduled_at",{ascending:true}).limit(150).then(r=>{if(r.error)throw r.error;return r.data||[]}),
 db().from("lg3s_public_player_lines").select("lg_game_id,lg_user_id,gamertag,position,goals,assists,points,shots,saves,shots_against,goals_against,lg_team_id,game_night_date").eq("lg_team_id",1446).order("game_night_date",{ascending:false}).limit(1000).then(r=>{if(r.error)throw r.error;return r.data||[]}),
 query("lg3s_gb_scouting","*"),
 query("lg3s_gb_battle_plans","*"),
 query("lg3s_gb_vod_refs","*")
 ]);
 Object.assign(state,{stalls,profiles,games,lines,notes,plans,vod});
 $("metaRoster").textContent=stalls.filter(x=>x.roster_status==="active").length+" MAIN / "+stalls.filter(x=>x.roster_status==="tc").length+" TC";
 const now=new Date().toISOString().slice(0,10);
 state.upcoming=games.filter(x=>x.game_night_date>=now).slice(0,12);
 $("metaFixtures").textContent=state.upcoming.length+" UPCOMING FIXTURES";
 renderAll();
}
const playerById=id=>state.stalls.find(x=>String(x.lg_user_id)===String(id));
const gamePlayers=id=>state.lines.filter(x=>String(x.lg_game_id)===String(id));
function playerTotals(id){
 const g=state.lines.filter(x=>String(x.lg_user_id)===String(id));
 return {games:new Set(g.map(x=>x.lg_game_id)).size,goals:g.reduce((s,x)=>s+n(x.goals),0),assists:g.reduce((s,x)=>s+n(x.assists),0),shots:g.reduce((s,x)=>s+n(x.shots),0),saves:g.reduce((s,x)=>s+n(x.saves),0)};
}
function coappearances(id){
 if(!id)return[];
 const games=new Set(state.lines.filter(x=>String(x.lg_user_id)===String(id)).map(x=>String(x.lg_game_id)));
 return state.stalls.filter(p=>p.lg_user_id&&String(p.lg_user_id)!==String(id)).map(p=>{
   const withPlayer=new Set(state.lines.filter(x=>String(x.lg_user_id)===String(p.lg_user_id)).map(x=>String(x.lg_game_id)));
   return {...p,shared:[...games].filter(x=>withPlayer.has(x)).length};
 }).filter(p=>p.shared>0).sort((a,b)=>b.shared-a.shared);
}
const K=(title,value)=>'<div><strong>'+E(value)+'</strong><span>'+E(title)+'</span></div>';
const homeOpp=g=>g.home_lg_team_id===TEAM?g.away_nation:g.home_nation;
const card=g=>'<div class="match-card"><div class="match-time"><b>'+E(dateLabel(g.scheduled_at||g.game_night_date))+'</b><span>'+E(timeLabel(g.scheduled_at))+' ET</span></div><div class="match-body"><div class="eyebrow">LG GAME #'+E(g.lg_game_id)+'</div><b>🇬🇧 GBR vs '+E(homeOpp(g))+'</b><small>'+E(g.status_label||"Scheduled")+' · '+(g.is_verified?"Verified result":"Fixture / result unverified")+'</small></div><button data-opponent="'+E(homeOpp(g))+'" title="Scout opponent">↗</button></div>';
function renderSchedule(){
 const arr=state.upcoming||[];
 // The cinematic headquarters uses gbDashboardGames instead of the retired homeMatches / nextOpponent widgets.
 // Keep this renderer compatible with both layouts so a missing optional panel never throws during login.
 const home=$("homeMatches"),schedule=$("scheduleCards"),nextOpponent=$("nextOpponent"),nextDetails=$("nextDetails");
 if(home)home.innerHTML=arr.length?arr.slice(0,3).map(card).join(""):'<p class="evidence-note">No upcoming fixtures currently in the LG3s feed.</p>';
 if(schedule)schedule.innerHTML=arr.length?arr.map(card).join(""):'<p class="evidence-note">No upcoming fixtures currently in the LG3s feed.</p>';
 const next=arr[0];
 if(nextOpponent)nextOpponent.textContent=next?homeOpp(next):"TBA";
 if(nextDetails)nextDetails.textContent=next?dateLabel(next.scheduled_at)+" · "+timeLabel(next.scheduled_at)+" Eastern · LG #"+next.lg_game_id:"No future fixtures loaded";
}
function playerCard(p){
 const stats=playerTotals(p.lg_user_id);
 return '<button class="player-card" data-stall="'+E(p.id)+'"><span class="player-icon">GB</span><span><strong>'+E(p.gamertag)+'</strong><small>'+E(p.position)+' · '+(p.roster_status==="tc"?"TRAINING CAMP":"MAIN ROSTER")+'</small><em>'+stats.games+' recorded games · '+(p.position==="G"?stats.saves+" saves":stats.goals+"G / "+stats.assists+"A")+'</em></span>›</button>';
}
function renderPlayers(){
 const main=state.stalls.filter(p=>p.roster_status==="active"),tc=state.stalls.filter(p=>p.roster_status==="tc");
 $("mainPlayers").innerHTML=main.map(playerCard).join("");
 $("tcPlayers").innerHTML=tc.map(playerCard).join("")||'<p class="evidence-note">No confirmed TC players imported yet. Management can add them below.</p>';
 $("lockerPlayers").innerHTML=state.stalls.map(playerCard).join("");
 $("tcForm").hidden=!manager();
}
function opponentOptions(){
 const seen=new Map();
 for(const g of state.games){
  const name=homeOpp(g),key=String(name||"").toLowerCase();
  if(name&&key!=="great britain"&&!seen.has(key))seen.set(key,name);
 }
 return [...seen.values()].sort();
}
function renderScoutPicker(){
 const picker=$("scoutOpponent"),names=opponentOptions();
 picker.innerHTML=names.map(name=>'<option value="'+E(name)+'">'+E(name)+'</option>').join("");
 if(!state.opponent||!names.includes(state.opponent))state.opponent=names[0]||"";
 picker.value=state.opponent;
}
async function loadOpponentStats(){
 const opp=state.opponent;
 if(!opp)return;
 $("opponentStats").innerHTML='<p class="muted">Loading opponent box scores…</p>';
 const r=await db().from("lg3s_public_player_lines")
   .select("lg_game_id,lg_user_id,gamertag,goals,assists,points,shots,saves,shots_against")
   .eq("nation",opp).order("game_night_date",{ascending:false}).limit(500);
 if(r.error){$("opponentStats").textContent="Opponent stats are temporarily unavailable.";return}
 if(state.opponent!==opp)return;
 state.opponentLines=r.data||[];
 const games=new Set(state.opponentLines.map(x=>x.lg_game_id));
 const goals=state.opponentLines.reduce((s,x)=>s+n(x.goals),0);
 const shots=state.opponentLines.reduce((s,x)=>s+n(x.shots),0);
 $("opponentStats").innerHTML=K("Recorded player-game appearances",state.opponentLines.length)+K("Distinct games in source",games.size)+K("Goals in available lines",goals)+K("Shots in available lines",shots);
 const total=new Map();
 for(const line of state.opponentLines){const id=String(line.lg_user_id);const a=total.get(id)||{name:line.gamertag,points:0,goals:0,app:0};a.points+=n(line.points??n(line.goals)+n(line.assists));a.goals+=n(line.goals);a.app++;total.set(id,a)}
 const top=[...total.values()].sort((a,b)=>b.points-a.points).slice(0,5);
 $("scoutEvidence").innerHTML='<h3>Available player production</h3>'+top.map(p=>'<div class="stall-mate"><span>'+E(p.name)+'</span><b>'+p.points+' pts / '+p.app+' lines</b></div>').join("")+'<p class="evidence-note">Not possession analytics; based only on the available public LG3s box score lines.</p>';
}
function renderScouting(){
 renderScoutPicker();
 const notes=state.notes.filter(x=>x.opponent_name.toLowerCase()===state.opponent.toLowerCase()).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 $("scoutNotes").innerHTML=notes.length?notes.map(x=>'<div class="note-card"><b>'+E(x.category.toUpperCase())+' · '+E(x.evidence_status)+'</b><p>'+E(x.observation)+'</p><p><b>Response:</b> '+E(x.response_plan||"Not yet specified")+'</p><small>'+E(x.created_at?.slice(0,10))+'</small></div>').join(""):'<p class="evidence-note">No scouting observations filed for this opponent yet.</p>';
 $("scoutForm").hidden=!manager();
 loadOpponentStats().catch(e=>console.warn("Opponent stats:",e));
}
const rosterOpts=slot=>{
 const list=state.stalls.filter(p=>slot==="G"?p.position==="G":slot==="D"?["LD","RD"].includes(p.position):!["G","LD","RD"].includes(p.position));
 return '<option value="">SELECT PLAYER</option>'+list.map(p=>'<option value="'+E(p.lg_user_id||"tc-"+p.id)+'">'+E(p.gamertag)+(p.roster_status==="tc"?" · TC":"")+'</option>').join("");
};
function renderLineups(){
 $("lineupSelectors").innerHTML=["F1","F2","D","G"].map(k=>'<label>'+k+'<select name="'+k+'">'+rosterOpts(k)+'</select></label>').join("");
 $("lineupSelectors").addEventListener("change",renderChemistry,{once:true});
}
function renderChemistry(){
 const vals=Object.fromEntries(["F1","F2","D","G"].map(k=>[k,$("battleForm").elements[k]?.value||""]));
 if(!vals.F1||!vals.F2){$("lineChemistry").innerHTML='<p class="evidence-note">Choose two forwards to see their official box-score co-appearances.</p>';return}
 const common=coappearances(vals.F1).find(x=>String(x.lg_user_id)===vals.F2);
 $("lineChemistry").innerHTML=K("Recorded games together",common?.shared||0)+K("Possession chemistry","Not measured")+'<p class="evidence-note">Playing the same game is not evidence of superior line chemistry. Film review can add tactical context later.</p>';
}
function renderBattle(){
 if(!$("lineupSelectors").children.length)renderLineups();
 const plans=state.plans.slice().sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
 $("savedPlans").innerHTML=plans.length?plans.slice(0,8).map(x=>'<div class="note-card"><b>'+E(x.opponent_name)+'</b><small>'+E(x.game_night||"Date not set")+' · '+E(x.status)+'</small></div>').join(""):'<p class="evidence-note">No saved private Battle Plans.</p>';
 for(const input of $("battleForm").elements)input.disabled=!manager();
 $("battleReadOnly").textContent=manager()?"Team management can save drafts. Avoid treating unverified hypotheses as confirmed scouting.":"Read-only: only the team owner, GM and AGM can edit.";
 renderChemistry();
}
function safeVOD(url){
 try{const u=new URL(url);return u.protocol==="https:"&&["twitch.tv","www.twitch.tv","youtube.com","www.youtube.com","youtu.be"].includes(u.hostname)?u.href:null}catch{return null}
}
function renderVod(){
 $("vodForm").hidden=!manager();
 $("vodRefs").innerHTML=state.vod.length?state.vod.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(x=>{
  const link=safeVOD(x.source_url);
  return '<div class="vod-card"><b>LG GAME '+E(x.lg_game_id||"UNASSIGNED")+'</b><small>'+E(x.status)+' · not processed here</small><p>'+E(x.note||"No note")+'</p>'+(link?'<a class="outline-link" href="'+E(link)+'" target="_blank" rel="noopener noreferrer">OPEN RECORDING ↗</a>':"")+'</div>';
 }).join(""):'<p class="evidence-note">No private VOD references saved yet.</p>';
}
async function reloadData(){await loadTeam();view(state.view)}
function renderAll(){renderSchedule();renderPlayers();renderScoutPicker();renderScouting();renderBattle();renderVod()}
function openStall(id){
 const p=state.stalls.find(p=>p.id===id);if(!p)return;
 state.selectedStall=p;$("stallTitle").textContent=p.gamertag;
 $("stallMeta").textContent=(p.roster_status==="tc"?"TRAINING CAMP":"GREAT BRITAIN")+" · "+p.position;
 $("stallNameplate").textContent=p.gamertag.toUpperCase();
 const total=playerTotals(p.lg_user_id);
 $("stallStats").innerHTML=K("Recorded games",total.games)+(p.position==="G"?K("Saves",total.saves):K("Goals",total.goals)+K("Assists",total.assists)+K("Shots",total.shots));
 const mates=coappearances(p.lg_user_id).slice(0,7);
 $("stallChemistry").innerHTML=mates.length?mates.map(m=>'<div class="stall-mate"><span>'+E(m.gamertag)+'</span><b>'+m.shared+' shared games</b></div>').join(""):'<p class="evidence-note">Not enough observed lineup overlap.</p>';
 const pid=new Set(state.lines.filter(x=>String(x.lg_user_id)===String(p.lg_user_id)).map(x=>String(x.lg_game_id)));
 const clips=state.vod.filter(v=>pid.has(String(v.lg_game_id))&&safeVOD(v.source_url));
 $("stallVod").innerHTML=clips.length?clips.map(x=>'<div class="vod-card"><a class="outline-link" target="_blank" rel="noopener noreferrer" href="'+E(safeVOD(x.source_url))+'">GAME #'+E(x.lg_game_id)+' RECORDING ↗</a></div>').join(""):'<p class="evidence-note">No verified matched VOD clips yet. Private recording references will appear here.</p>';
 const custom=state.profiles.find(x=>x.stall_id===p.id)||{};
 const f=$("stallForm");f.elements.theme.value=custom.theme||"gb-blue";f.elements.motto.value=custom.motto||"";f.elements.development_focus.value=custom.development_focus||"";
 const can=manager()||(p.lg_user_id&&String(state.member?.lg_user_id)===String(p.lg_user_id));
 [...f.elements].forEach(x=>x.disabled=!can);
 $("stallReadOnly").textContent=can?"Your stall preferences are private to Great Britain's approved team accounts.":"Only this player and management may customize the stall.";
 $("playerCardLink").href=p.lg_user_id?"player-cards.html?league=lg3s&id="+encodeURIComponent(p.lg_user_id):"lg3s-team.html?team=1446";
 $("stallOverlay").hidden=false;
}
async function saveRow(table,payload){const r=await db().from(table).insert(payload).select().single();if(r.error)throw r.error;return r.data}
async function sendJoin(e){
 e.preventDefault();
 const form=e.target,d=new FormData(form),lg=String(d.get("lg_user_id")||"").trim();
 if(lg&&!/^\d+$/.test(lg))return $("joinMessage").textContent="LG player ID must be numeric";
 const row={user_id:state.user.id,claimed_gamertag:String(d.get("gamertag")||"").trim(),claimed_lg_user_id:lg?Number(lg):null,requested_roster_status:d.get("roster_status")};
 const {error}=await db().from("lg3s_gb_join_requests").insert(row);
 $("joinMessage").textContent=error?(error.code==="23505"?"A request already exists. Contact management to update it.":error.message):"Request sent. Great Britain management will verify your account.";
}
async function submitScouting(e){
 e.preventDefault();if(!manager())return;
 const d=new FormData(e.target),data={opponent_name:state.opponent,category:String(d.get("category")),observation:String(d.get("observation")||"").trim(),response_plan:String(d.get("response_plan")||"").trim(),created_by:state.user.id,evidence_status:"manual_unverified"};
 if(data.observation.length<2)return msg("Enter an actual observed tendency.");
 try{await saveRow("lg3s_gb_scouting",data);e.target.reset();msg("Private scouting note saved as unverified.");await reloadData()}catch(err){msg(err.message)}
}
async function submitBattle(e){
 e.preventDefault();if(!manager())return;
 const d=new FormData(e.target);
 const lineup=Object.fromEntries(["F1","F2","D","G"].map(k=>[k,String(d.get(k)||"")]));
 const selected=Object.values(lineup).filter(Boolean);
 if(new Set(selected).size!==selected.length)return msg("A player cannot occupy two lineup slots.");
 if(selected.some(v=>!state.stalls.some(p=>String(p.lg_user_id||"tc-"+p.id)===v)))return msg("Choose Great Britain roster or TC players only.");
 const systems=Object.fromEntries(["offense","defense","transition","faceoffs","keys","adjustments"].map(k=>[k,String(d.get(k)||"")]));
 const opponent=String(d.get("opponent_name")||"").trim();
 if(opponent.length<2)return msg("Add the confirmed opponent.");
 try{await saveRow("lg3s_gb_battle_plans",{opponent_name:opponent,game_night:d.get("game_night")||null,lineup,systems,status:"draft",updated_by:state.user.id});msg("Private Battle Plan draft saved.");await reloadData()}catch(err){msg(err.message)}
}
async function submitVod(e){
 e.preventDefault();if(!manager())return;
 const d=new FormData(e.target),url=safeVOD(String(d.get("source_url")||""));
 if(!url)return msg("Use an HTTPS Twitch or YouTube recording URL.");
 const raw=String(d.get("lg_game_id")||"").trim();
 if(raw&&!/^\d+$/.test(raw))return msg("LG game ID must be numeric.");
 try{await saveRow("lg3s_gb_vod_refs",{source_url:url,lg_game_id:raw?Number(raw):null,note:String(d.get("note")||""),created_by:state.user.id,status:"reference_only"});e.target.reset();msg("Private VOD reference saved; no AI processing has started.");await reloadData()}catch(err){msg(err.message)}
}
async function submitTC(e){
 e.preventDefault();if(!manager())return;
 const d=new FormData(e.target),raw=String(d.get("lg_user_id")||"").trim();
 if(raw&&!/^\d+$/.test(raw))return msg("LG user ID must be numeric");
 try{await saveRow("lg3s_gb_stalls",{gamertag:String(d.get("gamertag")||"").trim(),position:d.get("position"),lg_user_id:raw?Number(raw):null,roster_status:"tc",source_kind:"team_management"});e.target.reset();msg("TC player and custom stall added.");await reloadData()}catch(err){msg("TC addition not saved: "+err.message)}
}
async function saveStall(e){
 e.preventDefault();const p=state.selectedStall;if(!p)return;
 const can=manager()||(p.lg_user_id&&String(state.member?.lg_user_id)===String(p.lg_user_id));
 if(!can)return msg("You can't edit another player's stall.");
 const d=new FormData(e.target);
 const {error}=await db().from("lg3s_gb_stall_profiles").upsert({stall_id:p.id,theme:String(d.get("theme")),motto:String(d.get("motto")||""),development_focus:String(d.get("development_focus")||""),updated_by:state.user.id,updated_at:new Date().toISOString()},{onConflict:"stall_id"});
 msg(error?error.message:"Custom stall saved.");if(!error){await loadTeam();openStall(p.id)}
}
async function renderAccess(){
 if(!owner())return;
 const [requests,members]=await Promise.all([query("lg3s_gb_join_requests","user_id,claimed_gamertag,claimed_lg_user_id,requested_roster_status,status,created_at"),query("lg3s_gb_members","user_id,role,lg_user_id,active")]);
 state.requests=requests;state.allMembers=members;
 const pending=requests.filter(r=>r.status==="pending");
 $("joinRequests").innerHTML='<h3>ACCOUNT LINK REQUESTS · '+pending.length+'</h3>'+ (pending.length?pending.map(r=>'<article class="request-card" data-request="'+E(r.user_id)+'"><b>'+E(r.claimed_gamertag)+'</b><p>Claimed LG ID: '+E(r.claimed_lg_user_id||"not supplied")+' · '+E(r.requested_roster_status)+' · account '+E(r.user_id.slice(0,8))+'…</p><label>APPROVED ROLE<select class="approve-role"><option value="player">PLAYER</option><option value="tc">TC</option><option value="gm">GM · BigK only</option><option value="agm">AGM · ItsaMeAquino only</option></select></label><label><input class="verified-checkbox" type="checkbox"> I have independently verified this Discord account and the claimed LeagueGaming identity</label><button class="gold approve-button" data-approve="'+E(r.user_id)+'">APPROVE TEAM ACCESS</button></article>').join(""):'<p class="evidence-note">No pending requests.</p>');
 $("membersList").innerHTML='<h3>APPROVED TEAM MEMBERS</h3>'+members.map(m=>'<div class="member-card"><b>'+E(m.role.toUpperCase())+'</b><small>Player ID '+E(m.lg_user_id||"not linked")+' · '+(m.active?"Active":"Inactive")+'</small></div>').join("");
}
async function approve(id,button){
 if(!owner())return;
 const req=state.requests.find(r=>r.user_id===id),parent=button.closest(".request-card");
 if(!req||!parent.querySelector(".verified-checkbox").checked)return msg("Confirm the Discord and LeagueGaming identities before approval.");
 const role=parent.querySelector(".approve-role").value;
 if(role==="gm"&&req.claimed_gamertag.toLowerCase()!=="bigk")return msg("GM assignment reserved for BigK after verification.");
 if(role==="agm"&&req.claimed_gamertag.toLowerCase()!=="itsamea quino".replace(" ",""))return msg("AGM assignment reserved for ItsaMeAquino after verification.");
 const linked=state.stalls.find(p=>p.lg_user_id&&String(p.lg_user_id)===String(req.claimed_lg_user_id));
 if(!linked&&req.claimed_lg_user_id)return msg("Add/confirm the claimed player's GB or TC stall first.");
 if(role==="agm"&&(!linked||linked.gamertag.toLowerCase()!=="itsamea quino".replace(" ","")))return msg("AGM must be linked to the verified ItsaMeAquino stall.");
 if(role==="gm"&&!linked)return msg("For GM, add a verified BigK stall and LG player ID before approval.");
 if(linked&&linked.gamertag.toLowerCase()!==req.claimed_gamertag.toLowerCase())return msg("The claimed gamertag doesn't match the selected LG roster identity.");
 try{
  const {error}=await db().from("lg3s_gb_members").insert({user_id:req.user_id,role,lg_user_id:linked?.lg_user_id||null,approved_by:state.user.id,active:true});
  if(error)throw error;
  await db().from("lg3s_gb_join_requests").update({status:"approved",updated_at:new Date().toISOString()}).eq("user_id",id);
  msg("Account approved. Ask the player to refresh their War Room.");await renderAccess()
 }catch(err){msg("Approval not saved: "+err.message)}
}
function attach(){
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>view(b.dataset.go)));
 $("roomNav").addEventListener("click",e=>{const b=e.target.closest("button[data-view]");if(b)view(b.dataset.view)});
 $("mobileMenu").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
 $("signOut").onclick=async()=>{await db().auth.signOut();location.reload()};
 $("joinForm").addEventListener("submit",sendJoin);
 $("scoutForm").addEventListener("submit",submitScouting);
 $("battleForm").addEventListener("submit",submitBattle);
 $("vodForm").addEventListener("submit",submitVod);
 $("tcForm").addEventListener("submit",submitTC);
 $("stallForm").addEventListener("submit",saveStall);
 $("scoutOpponent").addEventListener("change",e=>{state.opponent=e.target.value;renderScouting()});
 $("lineupSelectors").addEventListener("change",renderChemistry);
 $("closeStall").onclick=()=>{$("stallOverlay").hidden=true;state.selectedStall=null};
 $("stallOverlay").addEventListener("click",e=>{if(e.target===$("stallOverlay"))$("closeStall").click()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("stallOverlay").hidden)$("closeStall").click()});
 document.addEventListener("click",e=>{
  const p=e.target.closest("[data-stall]");if(p)return openStall(p.dataset.stall);
  const o=e.target.closest("[data-opponent]");if(o){view("scouting");state.opponent=o.dataset.opponent;renderScouting();return}
  const a=e.target.closest("[data-approve]");if(a)return approve(a.dataset.approve,a);
 });
 window.addEventListener("vvhl-auth-change",()=>boot());
 setTimeout(()=>boot(),120);
}
attach();
})();
