(() => {
  const TEAM_NAME = 'Calgary Hitmen';
  const SEASON = 'Season 55';
  const db = () => window.VVHLBackend?.db;
  const auth = () => window.VVHLBackend?.state || {};
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number(v) || 0;
  const S = { team:null, sessions:[], games:[], schedule:[], lockers:[], reports:[], lineups:[], loading:false, feed:null };

  // Scoreboard + jumbotron live in hitmen-broadcast.js (shared with the team locker).
  const HB = () => window.HitmenBroadcast;
  const seasonRecord = rows => HB()?.seasonRecord(rows) || {w:0,l:0,otl:0,gp:0,pts:0,gf:0,ga:0,diff:0,streak:''};
  // Official record from the public feed (LG standings line) when it loaded; else counted from rows.
  const officialRecord = () => { const r=S.feed?.ticker?.record; if(!r||r.gp==null) return null;
    return {w:r.w,l:r.l,otl:r.otl,gp:r.gp,pts:r.pts,gf:r.gf,ga:r.ga,diff:r.diff,streak:S.feed.ticker.streak?.label||''}; };
  function renderBroadcast(){ HB()?.render(S.feed?.schedule||S.schedule,{record:officialRecord()}); }

  function setStatus(text,tone=''){
    const el=$('hitmenStatus'); if(!el)return;
    el.textContent=text; el.className=`hq-status ${tone}`.trim();
  }
  function userCanManageHitmen(){
    const state=auth(); if(!state.user||!S.team)return false;
    if(String(state.profile?.role||'').toLowerCase()==='admin') return true;
    return (state.memberships||[]).some(m=>m.team_id===S.team.id && m.active!==false && ['owner','gm','agm','scout'].includes(String(m.role||'').toLowerCase()));
  }
  function enforceHitmenAccess(){
    const ok=userCanManageHitmen();
    document.querySelectorAll('[data-management-content]').forEach(el=>el.hidden=!ok);
    const locked=$('managementLockedMessage');
    if(locked){
      locked.hidden=ok;
      if(!ok&&auth().user) locked.innerHTML='<b>Calgary workspace access not assigned.</b><p>This private LGCHL workspace requires the site admin account or an Owner/GM/AGM/Scout membership on Calgary Hitmen.</p>';
    }
    return ok;
  }
  async function loadTeam(){
    const {data,error}=await db().from('teams').select('id,name,abbreviation,league_id,active,is_public,workspace_kind').eq('name',TEAM_NAME).maybeSingle();
    if(error) throw error;
    S.team=data;
    if(!S.team) throw new Error('Calgary Hitmen workspace is not available to this account.');
    return enforceHitmenAccess();
  }


  async function loadAll(){
    if(S.loading||!db()||!auth().user)return;
    S.loading=true;
    try{
      const allowed=await loadTeam();
      if(!allowed){setStatus('Calgary Hitmen workspace access is restricted.','error');return;}
      const [sessions,lockers,reports,lineups,schedule]=await Promise.all([
        db().from('team_competitive_sessions').select('*').eq('team_id',S.team.id).order('created_at',{ascending:false}),
        db().from('team_player_lockers').select('id,roster_class,gamertag,position,management_role').eq('team_id',S.team.id).eq('season',55),
        db().from('hitmen_player_reports').select('id').eq('team_id',S.team.id).eq('season',55),
        db().from('lineups').select('id,status,is_active,updated_at').eq('team_id',S.team.id).eq('league','LGCHL'),
        db().from('hitmen_schedule_games').select('id,week,scheduled_at,opponent_name,calgary_side,status,calgary_score,opponent_score,overtime').eq('team_id',S.team.id).eq('season',55).order('scheduled_at')
      ]);
      if(sessions.error||lockers.error||reports.error||lineups.error) throw (sessions.error||lockers.error||reports.error||lineups.error);
      S.sessions=sessions.data||[]; S.lockers=(lockers.data||[]).filter(x=>x.roster_class!=='historical'); // archived past players are not counted
      S.reports=reports.data||[]; S.lineups=lineups.data||[];
      if(schedule.error) console.warn('hitmen_schedule_games unavailable',schedule.error);
      S.schedule=schedule.error?[]:(schedule.data||[]);
      const ids=S.sessions.map(x=>x.id);
      if(ids.length){
        const games=await db().from('team_competitive_games').select('*').in('session_id',ids).order('game_number');
        if(games.error) throw games.error;
        S.games=games.data||[];
      } else S.games=[];
      render();
    }catch(e){console.error(e);setStatus(e.message||'Could not load Calgary workspace.','error');}
    finally{S.loading=false;}
  }

  function renderKpis(){
    if($('hitmenReportCount')) $('hitmenReportCount').textContent=S.reports.length;
    if($('hitmenRosterCount')) $('hitmenRosterCount').textContent=S.lockers.filter(x=>!['tc','training_camp'].includes(x.roster_class)).length;
    if($('hitmenTcCount')) $('hitmenTcCount').textContent=S.lockers.filter(x=>['tc','training_camp'].includes(x.roster_class)).length;
    if($('hitmenLineupCount')) $('hitmenLineupCount').textContent=S.lineups.length;
    const rec=officialRecord()||seasonRecord(S.schedule);
    if($('hitmenRecord')) $('hitmenRecord').textContent=rec.gp?`${rec.w}-${rec.l}-${rec.otl}`:'\u2014';
  }
  function render(){renderKpis();renderBroadcast();renderSeason();}

  // ---------- Public LGCHL feed: true record, full schedule, WHL standings, league scores ----------
  // /api/live-ticker (record, streak, next game) and /api/lgchl-scores?view=season (every game with
  // LG links, standings, teams) read the public Supabase tables filled by lgchl-league-sync.
  // No secrets; if the feed fails the War Room falls back to hitmen_schedule_games as before.
  const CGY_LG=412, ET='America/New_York', MT='America/Edmonton';
  // LG spells two opponents differently from hitmen-broadcast.js's crest map.
  const NAME_ALIAS={'Chicoutimi Sagueneens':'Chicoutimi Saguenéens','Tri City Americans':'Tri-City Americans'};
  const tf=(d,o)=>new Intl.DateTimeFormat('en-US',{timeZone:ET,...o}).format(d);
  const etKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:ET,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const dayL=d=>tf(d,{weekday:'short',month:'short',day:'numeric'}).replace(',','').toUpperCase();
  const tm=(d,tz)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit'}).format(d);
  const crest=(t,size)=>t?.logo?`<img class="wr-crest" src="${esc(t.logo)}" width="${size}" height="${size}" alt="" decoding="async">`:`<span class="wr-crest wr-crest-x" style="width:${size}px;height:${size}px">${esc(String(t?.abbr||'').slice(0,3))}</span>`;
  async function getFeed(url){const r=await fetch(url,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(url+' '+r.status);const b=await r.json();if(!b?.ok)throw new Error(url+' payload');return b;}
  async function loadFeed(){
    try{
      const [ticker,season]=await Promise.all([getFeed('/api/live-ticker'),getFeed('/api/lgchl-scores?view=season')]);
      const teams=season.teams||{};
      const mine=(season.games||[]).filter(g=>g.away===CGY_LG||g.home===CGY_LG).map(g=>{
        const home=g.home===CGY_LG, opp=teams[home?g.away:g.home]||{};
        return {id:g.id,week:g.week,at:g.at,url:g.url,state:g.state,home,opp,gf:home?g.home_score:g.away_score,ga:home?g.away_score:g.home_score};
      });
      // rows in the hitmen_schedule_games shape for the shared scoreboard + jumbotron
      const schedule=mine.map(g=>({id:g.id,week:g.week,scheduled_at:g.at,opponent_name:NAME_ALIAS[g.opp.name]||g.opp.name,calgary_side:g.home?'right':'left',
        status:g.state==='final'?'final':'scheduled',calgary_score:g.gf,opponent_score:g.ga,overtime:false,source_url:g.url}));
      S.feed={ticker,season,teams,mine,schedule,at:Date.now()};
    }catch(e){console.warn('[war-room] public LGCHL feed unavailable; using hitmen_schedule_games',e);S.feed=null;}
    if(S.team&&!S.loading){render();return;} // private data loaded: full re-render
    // before (or without) the private load: only the public-feed panels
    renderBroadcast(); renderSeason();
    const rec=officialRecord(); if(rec&&$('hitmenRecord')) $('hitmenRecord').textContent=`${rec.w}-${rec.l}-${rec.otl}`;
  }

  function scheduleHTML(F){
    const t=F.ticker, nextId=t.live?.id||t.next?.id;
    const rec=t.record||{};
    const byWeek=new Map(); F.mine.forEach(g=>{if(!byWeek.has(g.week))byWeek.set(g.week,[]);byWeek.get(g.week).push(g);});
    const row=g=>{const at=new Date(g.at),fin=g.state==='final'&&g.gf!=null,w=fin&&g.gf>g.ga,
      score=fin?`<span class="wrs-sc ${w?'w':'l'}"><b>${w?'W':'L'}</b><span class="${w?'hi':'lo'}">${g.gf}</span><i>–</i><span class="${w?'lo':'hi'}">${g.ga}</span></span>`
        :g.state==='live'?'<span class="wrs-sc"><b>Live</b></span>':g.state==='pending'?'<span class="wrs-sc"><b>Awaiting</b></span>'
        :`<span class="wrs-sc wrs-time">${esc(tm(at,ET))} ET<small>${esc(tm(at,MT))} MT</small></span>`;
      return `<li class="wrs-g${g.id===nextId?' next':''}${fin?' fin':''}" ${g.id===nextId?'id="wrsNext"':''}><span class="wrs-d">${esc(dayL(at))}</span><span class="wrs-ha">${g.home?'vs':'@'}</span>${crest(g.opp,22)}<span class="wrs-opp"><b>${esc(g.opp.abbr||'')}</b><span>${esc(g.opp.nick||g.opp.name||'')}</span></span>${g.id===nextId&&g.state!=='live'?'<span class="wr-chip">Next</span>':''}${score}<a class="wrs-lg" href="${esc(g.url)}" target="_blank" rel="noopener" aria-label="LG game page">LG ↗</a></li>`;};
    const next=t.live||t.next, nAt=next?new Date(next.at):null;
    return `<section class="wr-panel wrs-sched"><div class="wrs-hd"><div><span class="wr-k">Hitmen schedule · S55 · ${F.mine.length} games</span>
      <h3>${esc(rec.label||'')} <small>${rec.pts??''} PTS · GF ${rec.gf??''} · GA ${rec.ga??''}${t.streak?` · ${esc(t.streak.label)}`:''}${t.last5?` · L5 ${esc(t.last5)}`:''}</small></h3></div>
      ${next?`<div class="wrs-next"><span class="wr-k">${t.live?'Live now':'Next game'}</span><b>${next.home?'vs':'@'} ${esc(next.opponent?.abbr||'')} · ${esc(dayL(nAt))}</b><span>${esc(tm(nAt,ET))} ET · ${esc(tm(nAt,MT))} MT</span></div>`:''}</div>
      <div class="wrs-list" id="wrsList">${[...byWeek.entries()].map(([wk,gs])=>`<div class="wrs-wk"><span class="wr-k">Week ${esc(wk??'')}</span><ol>${gs.map(row).join('')}</ol></div>`).join('')}</div>
      <p class="wr-note">Results and links from LeagueGaming (lgchl_games). Record is the official LG standings line${rec.division?` · ${esc(rec.division)}, ${rec.division_rank}${['th','st','nd','rd'][rec.division_rank]||'th'}`:''}.</p></section>`;
  }
  function standingsHTML(F){
    const rows=(F.season.standings||[]).filter(r=>r.league==='WHL');
    const conf=c=>rows.filter(r=>r.conference===c).sort((a,b)=>a.conference_rank-b.conference_rank);
    const table=c=>`<span class="wr-k wrs-sub">WHL ${c}</span><table class="wr-st"><thead><tr><th>#</th><th>Team</th><th>GP</th><th>W-L-OTL</th><th>PTS</th><th>GD</th></tr></thead><tbody>${conf(c).map(r=>`<tr class="${r.lg_team_id===CGY_LG?'cg':''}"><td>${r.conference_rank}</td><td>${crest({logo:r.logo_path,abbr:r.abbr},18)}<span>${esc(String(r.nickname||r.name).toUpperCase())}</span></td><td>${r.gp}</td><td>${r.w}-${r.l}-${r.otl}</td><td>${r.pts}</td><td>${r.gd>0?'+':''}${r.gd}</td></tr>`).join('')}</tbody></table>`;
    const at=rows[0]?.standings_at?new Date(rows[0].standings_at):null;
    return `<section class="wr-panel wrs-stand"><span class="wr-k">WHL standings · by conference</span>${table('Eastern')}${table('Western')}<p class="wr-note">LG standings${at?` as of ${esc(tf(at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))} ET`:''}.</p></section>`;
  }
  function scoresHTML(F){
    const T=F.teams, all=(F.season.games||[]).filter(g=>g.at&&g.away!==CGY_LG&&g.home!==CGY_LG&&(g.league==='WHL'||g.big));
    const now=Date.now(), today=etKey(new Date(now));
    const finals=(F.season.games||[]).filter(g=>g.state==='final'&&etKey(new Date(g.at))<today);
    const last=finals.length?etKey(new Date(finals[finals.length-1].at)):null;
    const todays=all.filter(g=>etKey(new Date(g.at))===today);
    const fut=todays.length?null:(F.season.games||[]).find(g=>Date.parse(g.at)>now);
    const nextDay=fut?etKey(new Date(fut.at)):null;
    const night=(key,label)=>{const gs=all.filter(g=>etKey(new Date(g.at))===key);if(!gs.length)return '';
      const groups=['WHL','OHL','QMJHL'].map(l=>[l,gs.filter(g=>g.league===l)]).filter(([,x])=>x.length);
      return `<div class="wrs-night"><span class="wr-k">${esc(label)} · ${esc(dayL(new Date(gs[0].at)))}</span>${groups.map(([l,x])=>`<span class="wr-k wrs-sub">${l==='WHL'?'WHL':l+' big games'}</span><ul>${x.map(g=>{const a=T[g.away]||{},h=T[g.home]||{},fin=g.state==='final';const aw=fin&&g.away_score>g.home_score;
        return `<li><a href="${esc(g.url)}" target="_blank" rel="noopener">${crest(a,18)}<b class="${fin?(aw?'hi':'lo'):''}">${esc(a.abbr||'')}${fin?` ${g.away_score}`:''}</b><i>${fin?'':'@'}</i>${crest(h,18)}<b class="${fin?(aw?'lo':'hi'):''}">${esc(h.abbr||'')}${fin?` ${g.home_score}`:''}</b><span>${fin?'F':g.state==='live'?'Live':g.state==='pending'?'Awaiting':esc(tm(new Date(g.at),ET))}</span></a></li>`;}).join('')}</ul>`).join('')}</div>`;};
    // one game night: tonight's slate if there is one, else the latest finished night (+ the next night's date)
    const body=todays.length?night(today,'Tonight'):last?night(last,'Last game night'):nextDay?night(nextDay,'Next game night'):'';
    return `<section class="wr-panel wrs-scores"><span class="wr-k">League scores · WHL + OHL/QMJHL big games</span><div class="wrs-scroll">${body||'<div class="wr-empty-row">No league games yet.</div>'}</div><p class="wr-note">Calgary games are in the schedule. Big game = top-4 clash, leader chase or division race (lgchl_games_board).</p></section>`;
  }
  let scrolledToNext=false;
  function renderSeason(){
    const host=$('wrSeason'); if(!host) return;
    const F=S.feed;
    if(!F){host.innerHTML='<div class="wr-panel wr-empty-row">The LGCHL schedule feed is unavailable right now.</div>';return;}
    try{host.innerHTML=`<div class="wrs-grid">${scheduleHTML(F)}<div class="wrs-side">${standingsHTML(F)}${scoresHTML(F)}</div></div>`;}
    catch(e){console.error('[war-room] season panel',e);host.innerHTML='<div class="wr-panel wr-empty-row">This panel could not load.</div>';return;}
    const list=$('wrsList'),nx=$('wrsNext');
    if(list&&nx&&!scrolledToNext&&!host.closest('[hidden]')){list.scrollTop=Math.max(0,nx.offsetTop-list.offsetTop-80);scrolledToNext=true;}
  }

  loadFeed(); setInterval(loadFeed,5*60e3);
  window.addEventListener('vvhl-auth-change',()=>loadAll());
  if(auth().user)loadAll();
})();