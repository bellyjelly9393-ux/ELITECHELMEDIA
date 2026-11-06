/* Elitechel Media LG3s public league desk. Static roster/editorial snapshot + read-only verified LG results
   from Supabase public views (lg3s_public_*; verified rows only). No writes. Falls back to the static snapshot. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = id => 'assets/lg3s/team' + Number(id) + '.svg';
  const teamUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league_page&page=team_page&teamid=' + Number(id) + '&leagueid=154&seasonid=1';
  const userUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid=' + Number(id) + '&leagueid=154&seasonid=1';
  const gameUrl = id => 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + Number(id);
  const salary = n => n == null ? 'No contract' : '$' + (n / 1e6).toFixed(2).replace(/0+$/,'').replace(/\.$/,'') + 'M';
  const shortTime = t => ({'20:00':'8:00 PM','20:35':'8:35 PM','21:10':'9:10 PM'})[t] || esc(t);
  const teamMark = (t, size = 48) => '<img src="' + icon(t.id) + '" width="' + size + '" height="' + size + '" loading="lazy" alt="' + esc(t.name) + ' team crest">';
  const LIVE = Object.freeze({ base: 'https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/', key: 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP' });
  /* Approved-recap view (migration 20261024160000) is not applied yet; flip once it exists so the page doesn't 404. */
  const RECAPS_LIVE = true;
  const live = { ok: false, games: new Map(), standings: [], official: [], skaters: [], goalies: [], lines: [], recaps: new Map() };
  async function view(name, q) {
    const r = await fetch(LIVE.base + name + '?' + q, { headers: { apikey: LIVE.key, Authorization: 'Bearer ' + LIVE.key }, cache: 'no-store' });
    if (!r.ok) throw Error(name + ' ' + r.status);
    return r.json();
  }
  async function loadLive() {
    const [g, s] = await Promise.all([view('lg3s_public_games', 'select=*&order=scheduled_at'), view('lg3s_public_standings', 'select=*')]);
    const opt = (n, q) => view(n, q).catch(e => { if (!/recaps 404/.test(String(e))) console.warn('LG3s optional view', e); return []; });
    const [o, sk, gl, ln, recaps] = await Promise.all([opt('lg3s_public_official_standings', 'select=*'),
      opt('lg3s_public_skater_leaders', 'select=*&order=p.desc,g.desc&limit=250'), opt('lg3s_public_goalie_leaders', 'select=*&order=sv_pct.desc.nullslast&limit=60'),
      opt('lg3s_public_player_lines', 'select=*&order=lg_game_id&limit=5000'),
      RECAPS_LIVE ? opt('lg3s_public_recaps', 'select=id,lg_game_id,game_night_date,title,body_md') : Promise.resolve([])]);
    /* Editor-approved/published previews only (view filters status). */
    (await opt('lg3s_public_previews', 'select=id,lg_game_id,title,body_md')).forEach(d => drafts.set(Number(d.lg_game_id), d));
    g.forEach(x => live.games.set(Number(x.lg_game_id), x));
    const recapMap = new Map();
    recaps.forEach(r => { if (r.lg_game_id != null) recapMap.set(Number(r.lg_game_id), r); });
    /* LG3S points (confirmed against LG's own table): regulation W 2, OTW 2, OTL 1, regulation L 0. Our w excludes OTW. */
    s.forEach(r => { const n = ['w','otw','otl'].map(k => r[k]); if (n.every(x => x != null)) r.pts = 2 * (Number(r.w) + Number(r.otw)) + Number(r.otl); });
    Object.assign(live, { ok: true, standings: s, official: o, skaters: sk, goalies: gl, lines: ln, recaps: recapMap });
  }
  const etTime = iso => iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : '';
  const playerLink = (id, name) => '<a class="th-player-name" href="#player/' + Number(id) + '">' + esc(name) + '</a>';
  const nationLink = t => '<a class="th-team-link" href="#nation/' + Number(t.id) + '">' + teamMark(t, 32) + esc(t.name) + '</a>';
  const btn = $('menuBtn'), nav = $('nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', e => { if(e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }});
    document.addEventListener('keydown', e => { if(e.key === 'Escape'){nav.classList.remove('open');btn.setAttribute('aria-expanded','false');}});
  }
  let data, tm, chosenDay='', weekDays=[], weekShift=0, drafts=new Map(), boardMode='official', playerLimit=40;
  function team(id){ return tm.get(Number(id)); }
  function teamOr(id, name){ return team(id) || { id: Number(id), name: name || 'Team' }; }
  function isoAdd(iso, n){ const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y, m-1, d+n)).toISOString().slice(0,10); }
  function isoWeekday(iso){ const [y,m,d]=iso.split('-').map(Number); return new Date(Date.UTC(y, m-1, d)).getUTCDay(); }
  function torontoToday(){ return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  function nightKey(v){ return String(v||'').slice(0,10); }
  function nightTitle(iso){
    const [y,m,d]=iso.split('-').map(Number), dt=new Date(Date.UTC(y,m-1,d,12));
    const weekday=dt.toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}).toUpperCase();
    const md=dt.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).toUpperCase();
    return weekday+' · '+md;
  }
  function collectNights(){
    const set=new Set();
    if(live.ok) live.games.forEach(g=>{ const k=nightKey(g.game_night_date); if(k) set.add(k); });
    else (data.games||[]).forEach(g=>{ if(g.date) set.add(g.date); });
    return [...set].sort();
  }
  function chooseWeek(){
    const nights=collectNights(), today=torontoToday();
    const anchor=[...nights].reverse().find(d=>d<=today)||nights[0];
    if(!anchor){ weekDays=[]; chosenDay=''; return; }
    const back={3:0,4:1,5:2,6:3,0:4,1:5,2:6}[isoWeekday(anchor)];
    const wed=isoAdd(anchor,-back+7*weekShift);
    weekDays=[0,1,2].map(i=>isoAdd(wed,i));
    chosenDay=[...weekDays].reverse().find(d=>d<=today)||weekDays[0];
  }
  function hasWeek(shift){const n=collectNights(),s0=weekShift;weekShift=shift;const w=weekDays,c=chosenDay;chooseWeek();const ok=weekDays.some(d=>n.includes(d));weekShift=s0;weekDays=w;chosenDay=c;return ok;}
  function draftSnippet(md){const first=String(md).split('\n\n').slice(1,3).join(' ');return esc(first.replace(/\*\*|_/g,'')).slice(0,330);}
  function etClock(iso){ return new Date(iso).toLocaleTimeString('en-US',{timeZone:'America/Toronto',hour:'numeric',minute:'2-digit'}); }
  function gamesFor(iso){
    if(live.ok) return [...live.games.values()].filter(g=>nightKey(g.game_night_date)===iso).sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at))||Number(a.lg_game_id)-Number(b.lg_game_id));
    return (data.games||[]).filter(g=>g.date===iso).map(g=>({ lg_game_id:g.id, away_lg_team_id:g.away, home_lg_team_id:g.home, away_nation:'', home_nation:'', scheduled_at:null, is_verified:false, status:'scheduled', game_night_date:g.date, _static:g }));
  }

  function renderNations() {
    $('thNations').innerHTML = data.teams.map(t => '<a href="#nation/' + Number(t.id) + '" class="th-nation-chip" title="' + esc(t.name) + ' nation page">' + teamMark(t,34) + '<span>' + esc(t.name) + '</span></a>').join('');
  }
  const natBg=(n,size)=>{const A=window.LG3S_NATION_ART;const u=A&&A.css(n,size||'card');return u&&u!=='none'?' style="--nat:'+esc(u)+';--nc:'+A.color(n)+';--nc2:'+A.color(n,1)+'"':'';};
  const natCls=n=>window.LG3S_NATION_ART&&window.LG3S_NATION_ART.has(n)?' has-nat':'';
  function matchupHtml(row,a,h,size,meta){
    const A=window.LG3S_NATION_ART;
    const CTBLI={921552:1,921562:1};
    const fin=live.ok&&!row._static&&row.is_verified&&row.away_score!=null&&row.home_score!=null?{away:row.away_score,home:row.home_score,note:row.is_forfeit?'FORFEIT: ILLEGAL PLAYER':'FINAL'+(row.decided_in&&row.decided_in!=='REG'?'/'+row.decided_in:''),fine:row.is_forfeit&&CTBLI[row.lg_game_id]?'the ctbli special':''}:null;
    if(!A||!A.matchup) return '';
    return A.matchup({away:{name:a.name,mark:teamMark(a,size==='hero'?96:56),label:'AWAY'},home:{name:h.name,mark:teamMark(h,size==='hero'?96:56),label:'HOME'},final:fin,meta,size});
  }
  function gameCard(row){
    const snap=row._static||(data.games||[]).find(g=>Number(g.id)===Number(row.lg_game_id));
    const a=teamOr(row.away_lg_team_id, row.away_nation), h=teamOr(row.home_lg_team_id, row.home_nation);
    const p=snap&&snap.pick?team(snap.pick):null;
    const marquee=snap&&/MARQUEE|HEADLINER|STAR DUEL|STYLE CLASH/.test(snap.tag||'');
    const classes='th-game th-game-v2'+(marquee?' th-game-feature':'');
    const clock=row._static?shortTime(row._static.time):etClock(row.scheduled_at);
    const tag=snap&&snap.tag?snap.tag:clock+' ET';
    const dr=drafts.get(Number(row.lg_game_id));
    const preview=dr&&!row.is_verified?'<div class="th-game-foot"><span>THE MATCHUP · <b>PREVIEW</b></span><p>'+draftSnippet(dr.body_md)+'…</p></div>':snap&&snap.preview?'<div class="th-game-foot"><span>THE MATCHUP</span><p>'+esc(snap.preview)+'</p></div>':'';
    const verdict=p?'<div class="th-game-verdict"><span>ECM PICK · <b>'+esc(p.name)+'</b></span><span class="th-pick-label">EDITORIAL PREDICTION</span></div>':'';
    const recap=row.is_verified&&live.recaps.get(Number(row.lg_game_id));
    const recapLink='<a class="th-recap-link" href="#game/'+Number(row.lg_game_id)+'">'+(preview&&dr?'Read preview':'Match detail')+'</a>'+(recap?'<a class="th-recap-link" href="#recap/'+Number(row.lg_game_id)+'">Approved recap</a>':'');
    const scoreText=row.is_verified&&row.away_score!=null&&row.home_score!=null?(' final '+Number(row.away_score)+' to '+Number(row.home_score)):'';
    return '<div class="th-game-slot"><a class="'+classes+'" href="#game/'+Number(row.lg_game_id)+'" aria-label="'+esc(a.name)+' at '+esc(h.name)+', '+esc(clock)+' Eastern'+scoreText+'">' +
      '<img class="th-game-wm" src="'+icon(h.id)+'" loading="lazy" alt="" aria-hidden="true">' +
      '<div class="th-game-top"><span class="th-game-day">'+esc(tag)+'</span><strong>GAME '+esc(String(row.lg_game_id).slice(-3))+'</strong><span class="th-action">'+(recap?'RECAP ›':dr&&!row.is_verified?'PREVIEW ›':'GAME PAGE ›')+'</span></div>' +
      matchupHtml(row,a,h,'card',clock+' ET') +
      preview+scoreBlock(row,a,h)+verdict+'</a>'+recapLink+'</div>';
  }
  function scoreBlock(row, a, h) {
    if (!live.ok || row._static) return '';
    if (!row.is_verified || row.away_score==null || row.home_score==null) return '<div class="th-live-score is-pending"><span>' + (row.status === 'pending_verification' ? 'FINAL POSTED · VERIFYING' : 'RESULT PENDING') + '</span><small>Scores appear once LG data passes verification</small></div>';
    const ah = row.away_score > row.home_score;
    return '<div class="th-live-score"><b class="' + (ah ? 'is-win' : '') + '">' + esc(a.name) + ' ' + Number(row.away_score) + '</b><span>' + (row.is_forfeit ? 'Forfeit: illegal player' + ({921552:1,921562:1}[row.lg_game_id] ? '<em class="lg3m-fine">the ctbli special</em>' : '') : 'FINAL' + (row.decided_in && row.decided_in !== 'REG' ? '/' + esc(row.decided_in) : '')) + '</span><b class="' + (ah ? '' : 'is-win') + '">' + Number(row.home_score) + ' ' + esc(h.name) + '</b>' +
      '<small>OFFICIAL LG DATA · VERIFIED ' + esc(etTime(row.verified_at)) + (row.was_corrected ? ' · CORRECTED' : '') + '</small></div>';
  }
  function renderNightTabs(){
    const box=$('thNightTabs'); if(!box) return;
    const nav=(sh,lbl)=>hasWeek(sh)?'<button type="button" class="th-week-nav" data-week="'+sh+'">'+lbl+'</button>':'';
    box.innerHTML=nav(weekShift-1,'‹ PREV WEEK')+weekDays.map(iso=>{
      const finals=gamesFor(iso).filter(g=>g.is_verified).length;
      return '<button type="button" role="tab" data-date="'+iso+'" aria-pressed="'+String(iso===chosenDay)+'">'+nightTitle(iso).split(' · ')[0]+' <span>'+finals+' FINAL'+(finals===1?'':'S')+'</span></button>';
    }).join('')+nav(weekShift+1,'NEXT WEEK ›');
  }
  function renderGames(){
    renderNightTabs();
    const games=chosenDay?gamesFor(chosenDay):[];
    const blocks=new Map;
    for(const g of games){ const key=g._static?shortTime(g._static.time):etClock(g.scheduled_at); if(!blocks.has(key)) blocks.set(key,[]); blocks.get(key).push(g); }
    $('thGames').innerHTML=games.length?[...blocks.entries()].map(([time,arr])=>'<div class="th-wave"><header class="th-wave-header"><span class="th-wave-time">'+esc(time)+' <small>ET</small></span><span>'+esc(nightTitle(chosenDay))+'</span><span>'+arr.length+' MATCHUP'+(arr.length===1?'':'S')+'</span></header><div class="th-games">'+arr.map(gameCard).join('')+'</div></div>').join(''):'<p class="th-caption">No games on this night.</p>';
    const finals=games.filter(g=>g.is_verified).length;
    $('thSelectedNight').textContent=chosenDay?nightTitle(chosenDay):'THIS WEEK';
    $('thNightStat').textContent=chosenDay?(finals+' VERIFIED FINAL'+(finals===1?'':'S')+' · '+games.length+' GAME'+(games.length===1?'':'S')):'VERIFIED FINALS';
  }
  function standingsTable(group){
    const teams=data.teams.filter(t=>t.group===group);
    if(boardMode==='forecast'){
      const project=new Map(data.projection.records.map(p=>[p.id,p]));
      teams.sort((a,b)=>project.get(b.id).w-project.get(a.id).w||a.name.localeCompare(b.name));
      return '<div class="th-standing-group"><header class="th-standing-title"><strong>GROUP ' + group + '</strong><span>ECM PREDICTION · AFTER NIGHT ONE</span></header><div class="th-table-scroll"><table class="th-table"><thead><tr><th>TEAM</th><th>W</th><th>L</th><th>PROJECTED RECORD</th></tr></thead><tbody>'+teams.map(t=>{
        const p=project.get(t.id);
        return '<tr><td><a class="th-team-link" href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer">'+teamMark(t,32)+esc(t.name)+'</a></td><td class="num">'+p.w+'</td><td class="num">'+p.l+'</td><td class="th-record">'+p.w+'–'+p.l+'</td></tr>';
      }).join('')+'</tbody></table></div></div>';
    }
    if(live.ok&&live.standings.length===12){
      const rows=live.standings.filter(r=>{const t=team(r.lg_team_id);return t&&t.group===group;}).sort((a,b)=>(b.pts??-1)-(a.pts??-1)||b.w-a.w||b.gd-a.gd||b.gf-a.gf||a.nation.localeCompare(b.nation));
      const v=x=>x==null?'—':Number(x);
      return '<div class="lg3g lg3g-'+group.toLowerCase()+'"><header class="lg3g-head"><h3 class="sr-only">Group '+group+'</h3></header><table class="lg3g-t"><caption class="sr-only">Group '+group+' verified standings</caption><thead><tr><th scope="col">#</th><th scope="col" class="lg3g-tm">TEAM</th><th scope="col">GP</th><th scope="col">W</th><th scope="col">L</th><th scope="col">OTW</th><th scope="col">OTL</th><th scope="col">PTS</th></tr></thead><tbody>'+rows.map((r,i)=>{const t=team(r.lg_team_id);
        return '<tr><td><span class="lg3g-rk lg3g-rk'+(i+1)+'">'+(i+1)+'</span></td><td class="lg3g-tm"><a href="#nation/'+Number(t.id)+'">'+teamMark(t,30)+'<span>'+esc(t.name)+'</span></a></td>'+['gp','w','l','otw','otl'].map(k=>'<td>'+(k==='w'&&r.w!=null&&r.otw!=null?Number(r.w)+Number(r.otw):v(r[k]))+'</td>').join('')+'<td class="lg3g-pts">'+v(r.pts)+'</td></tr>';}).join('')+'</tbody></table></div>';
    }
    return '<div class="th-standing-group"><header class="th-standing-title"><strong>GROUP '+group+'</strong><span>OFFICIAL PRESEASON STANDINGS</span></header><div class="th-table-scroll"><table class="th-table"><thead><tr><th>TEAM</th><th>GP</th><th>W</th><th>L</th><th>OTW</th><th>OTL</th><th>PTS</th><th>GF</th><th>GA</th><th>GD</th></tr></thead><tbody>'+teams.map(t=>
    '<tr><td><a class="th-team-link" href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer">'+teamMark(t,32)+esc(t.name)+'</a></td>'+['gp','w','l','otw','otl','pts','gf','ga','gd'].map(k=>'<td class="num">'+Number(t[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></div>';
  }
  function renderStandings(){
    $('thStandings').innerHTML=standingsTable('A')+standingsTable('B');$('thStandings').classList.toggle('lg3g-on',boardMode!=='forecast'&&live.ok&&live.standings.length===12);
    $('thStandingsNote').textContent=boardMode==='forecast'?
    'ECM forecast: straight-up predictions for the 18 Wednesday games (three per nation). This is not an official record, a betting market, or a simulation of goal scores. Teams tied on projected wins are not ranked by a fabricated tiebreaker.':
    (live.ok?standingsNote():'Official LeagueGaming Season 1 standings, captured October 21, 2026 before posted opening results. Live results are temporarily unavailable; this snapshot does not update automatically.');
    $('thStandingsAsOf').textContent=boardMode==='forecast'?'EDITORIAL · NOT OFFICIAL':live.ok?'VERIFIED · '+lastVerified():'OFFICIAL SNAPSHOT · OCT 21';
    document.querySelectorAll('.th-board-mode').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.boardMode===boardMode)));
  }
  function lastVerified(){let m=null;live.games.forEach(g=>{if(g.verified_at&&(!m||g.verified_at>m))m=g.verified_at;});return m?etTime(m).toUpperCase():'—';}
  function standingsNote(){
    const vg=[...live.games.values()].filter(g=>g.is_verified&&g.away_score!=null&&g.home_score!=null);
    const n=vg.length, ff=vg.filter(g=>g.is_forfeit).length;
    const off=new Map(live.official.map(r=>[r.lg_team_id,r]));
    const diff=live.standings.filter(r=>{const o=off.get(r.lg_team_id);return o&&(o.gp!==r.gp||o.w!==r.w+r.otw||o.l!==r.l||o.otl!==r.otl||o.gf!==r.gf||o.ga!==r.ga);});
    const cap=live.official.length?etTime(live.official.reduce((m,r)=>r.captured_at>m?r.captured_at:m,live.official[0].captured_at)):'';
    return 'Built from '+n+' verified LeagueGaming finals'+(ff?' ('+(n-ff)+' with full box scores, '+ff+' forfeit'+(ff===1?'':'s')+' counted 1-0 as LG records them)':'')+'. '+
      (cap?(diff.length?'LG\'s last captured table ('+cap+') differs for '+diff.length+' team'+(diff.length===1?'':'s')+'; results confirmed since that capture are included here.':'Matches LeagueGaming\'s official table captured '+cap+'.'):'')+
      ' Points: 2 per win (regulation or OT/SO), 1 per OT/SO loss, 0 per regulation loss, matching LeagueGaming\'s table. Ties: points, then regulation wins, then goal difference, then goals for.';
  }
  function renderLeaders(){
    const box=$('thLeaders'); if(!box)return;
    if(!live.ok||!live.skaters.length){box.innerHTML='<p class="th-caption">Verified leaderboards appear after the first verified finals.</p>';return;}
    const sk=live.skaters.slice(0,15).map((p,i)=>{const t=team(p.lg_team_id);return '<tr><td class="th-num-rank">'+(i+1)+'</td><td>'+playerLink(p.lg_user_id,p.gamertag)+'</td><td>'+(t?nationLink(t):'')+'</td>'+['gp','g','a','p','plus_minus'].map(k=>'<td class="num">'+Number(p[k])+'</td>').join('')+'</tr>';}).join('');
    const gl=live.goalies.filter(g=>g.sa>0).slice(0,10).map((g,i)=>'<tr><td class="th-num-rank">'+(i+1)+'</td><td>'+playerLink(g.lg_user_id,g.gamertag)+'</td><td>'+esc((g.nations_played_for||[]).join(' · '))+'</td>'+['gp','sa','ga','sv'].map(k=>'<td class="num">'+Number(g[k])+'</td>').join('')+'<td class="num">'+(g.sv_pct==null?'—':Number(g.sv_pct).toFixed(3).replace(/^0/,''))+'</td></tr>').join('');
    box.innerHTML='<div class="th-standing-group"><header class="th-standing-title"><strong>SKATERS</strong><span>POINTS · VERIFIED GAMES</span></header><div class="th-table-scroll"><table class="th-table"><thead><tr><th>#</th><th>PLAYER</th><th>NATION</th><th>GP</th><th>G</th><th>A</th><th>P</th><th>+/-</th></tr></thead><tbody>'+sk+'</tbody></table></div></div>'+
      '<div class="th-standing-group"><header class="th-standing-title"><strong>GOALIES</strong><span>SAVE % · CREDITED PER GAME</span></header><div class="th-table-scroll"><table class="th-table"><thead><tr><th>#</th><th>GOALIE</th><th>PLAYED FOR</th><th>GP</th><th>SA</th><th>GA</th><th>SV</th><th>SV%</th></tr></thead><tbody>'+gl+'</tbody></table></div></div>';
  }
  function openDetail(html){const d=$('thDetail');if(!d)return;$('thDetailBody').innerHTML=html;if(!d.open)d.showModal();}
  function nationPage(id){
    const t=team(id);if(!t)return;
    const st=live.standings.find(r=>r.lg_team_id===t.id);
    const liveG=live.ok?[...live.games.values()].filter(x=>x.away_lg_team_id===t.id||x.home_lg_team_id===t.id).sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at))).filter((x,i,arr)=>x.status!=='scheduled'||arr.filter(y=>y.status==='scheduled').indexOf(x)<3).map(x=>({id:Number(x.lg_game_id),away:x.away_lg_team_id,home:x.home_lg_team_id,date:nightKey(x.game_night_date),_et:etClock(x.scheduled_at)+' ET'})):null;
    const NA=window.LG3S_NATION_ART,bnr=n=>NA?NA.css(n,'banner'):'none',nc=(n,i)=>NA?NA.color(n,i):(i?'#c9d3dc':'#9aa7b3');
    const games=(liveG||data.games.filter(g=>g.away===t.id||g.home===t.id)).map(g=>{const x=live.games.get(g.id),opp=teamOr(g.away===t.id?g.home:g.away),home=g.home===t.id;
      let r=null,f=null,a=null,state='upcoming';if(x&&x.is_verified&&x.home_score!=null){f=home?x.home_score:x.away_score;a=home?x.away_score:x.home_score;r=f>a?'W':'L';state='final';}else if(x&&x.status==='pending_verification')state='verifying';
      const win=r==='W',when=g._et?g._et:shortTime(g.time)+' ET';
      const tiles=state==='final'?statFig(r,'RESULT')+statFig(Number(f)+'-'+Number(a),'SCORE'):statFig(state==='verifying'?'…':esc(when.replace(/ ET$/,'')),state==='verifying'?'VERIFYING':'UPCOMING');
      return '<div class="lg3r'+(win?' is-win':'')+(state!=='final'?' is-up':'')+'" style="--ob:'+esc(bnr(opp.name))+';--ofb:'+esc(NA?NA.css(opp.name,'card'):'none')+';--oc:'+nc(opp.name)+';--oc2:'+nc(opp.name,1)+'">'+
        '<span class="lg3r-id"><strong>'+(home?'VS ':'@ ')+esc(opp.name).toUpperCase()+'</strong><small><img src="'+icon(opp.id)+'" width="14" height="15" alt="">'+esc(g.date)+' · '+esc(when)+'</small></span>'+
        '<span class="lg3r-art" aria-hidden="true"></span><span class="lg3r-tiles">'+tiles+'<a class="lg3p-fig lg3r-link" href="#game/'+Number(g.id)+'" aria-label="Game detail, '+(home?'vs ':'at ')+esc(opp.name)+'"><b>›</b><small>DETAIL</small></a></span>'+(win?'<em class="lg3r-tab">WIN</em>':'')+'</div>';}).join('')||'<p class="th-caption">No games scheduled.</p>';
    const tot=new Map();live.lines.filter(l=>l.lg_team_id===t.id&&l.player_kind==='skater').forEach(l=>{const p=tot.get(l.lg_user_id)||{id:l.lg_user_id,n:l.gamertag,gp:0,g:0,a:0,p:0};p.gp++;p.g+=l.goals;p.a+=l.assists;p.p+=l.points;tot.set(l.lg_user_id,p);});
    const skl=[...tot.values()].sort((a,b)=>b.p-a.p||b.g-a.g);
    const sk=skl.map((p,i)=>playerRow({name:playerLink(p.id,p.n),nation:t.name,star:i===0&&p.p>0,tag:i===0&&p.p>0?'TEAM LEADER':'',stats:[[p.gp,'GP'],[p.g,'G'],[p.a,'A'],[p.p,'PTS']]})).join('')||'<p class="th-caption">No verified games yet.</p>';
    const roster=data.players.filter(p=>p.t===t.id).map(p=>esc(p.n)).join(' · ');
    const of=live.official.find(r=>r.lg_team_id===t.id);
    /* Record comes from verified lg3s_games (same rows listed below). PTS: computed view, else LG official only when its GP equals ours. */
    const pts=st?(st.pts!=null?Number(st.pts):of&&Number(of.gp)===Number(st.gp)?Number(of.pts):'—'):'—';
    const rec=st?Number(st.w+st.otw)+'-'+Number(st.l)+'-'+pts+' PTS'+(st.otw+st.otl?' · '+Number(st.otw)+' OTW / '+Number(st.otl)+' OTL':'')+' · GF '+Number(st.gf)+' / GA '+Number(st.ga):'No verified results yet';
    openDetail('<header class="lg3h" style="--hb:'+esc(bnr(t.name))+';--hf:'+esc(NA?NA.css(t.name,'hero'):'none')+';--c1:'+nc(t.name)+';--c2:'+nc(t.name,1)+'"><span class="lg3h-art" aria-hidden="true"></span><span class="lg3h-streak" aria-hidden="true"></span>'+
      '<span class="lg3h-crest">'+teamMark(t,84)+'</span><div class="lg3h-txt"><p class="lg3h-eye">GROUP '+esc(t.group||'—')+' · NATION PAGE</p><h3 class="lg3h-name" data-n="'+esc(t.name).toUpperCase()+'">'+esc(t.name).toUpperCase()+'</h3><p class="lg3h-rec">'+rec+'</p></div></header>'+
      '<div class="lg3s-bar"><i aria-hidden="true"></i>RESULTS &amp; SCHEDULE</div><div class="lg3r-list">'+games+'</div><h4>SKATERS · VERIFIED GAMES</h4><div class="lg3p-list">'+sk+'</div>'+
      '<h4>ROSTER (OCT 21 SNAPSHOT)</h4><p class="th-caption">'+roster+'</p><p class="th-caption"><a href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer">Official LG team page ↗</a></p>');
  }
  function playerCard(uid){
    const ls=live.lines.filter(l=>l.lg_user_id===uid);const rp=data.players.find(p=>p.id===uid);
    const name=(ls[ls.length-1]||{}).gamertag||(rp&&rp.n)||('LG user '+uid);
    const sk=ls.filter(l=>l.player_kind==='skater'),gl=ls.filter(l=>l.player_kind==='goalie');
    const sum=(a,k)=>a.reduce((n,x)=>n+(Number(x[k])||0),0);
    const rows=ls.map(l=>{const t=team(l.lg_team_id),g=live.games.get(l.lg_game_id);return '<tr><td>'+esc(String(l.game_night_date).slice(5))+' · '+(t?esc(t.name):'')+'<br><b>'+(l.player_kind==='goalie'?'G · '+l.saves+' SV / '+l.shots_against+' SA':esc(l.position||'')+' · '+l.goals+'G '+l.assists+'A '+l.points+'P')+'</b></td><td class="num"><a href="#game/'+Number(l.lg_game_id)+'">'+(g?Number(g.away_score)+'–'+Number(g.home_score):'LG')+' ↗</a></td></tr>';}).join('')||'<tr><td colspan="2">No verified games yet.</td></tr>';
    const nations=[...new Set(ls.map(l=>l.nation))].join(' · ')||(rp&&team(rp.t)?team(rp.t).name:'');
    openDetail('<header class="th-detail-head"><div><p class="eyebrow">PLAYER CARD · '+esc(nations)+'</p><h3>'+esc(name)+'</h3><p>'+(sk.length?sk.length+' GP · '+sum(sk,'goals')+'G '+sum(sk,'assists')+'A '+sum(sk,'points')+'P':'')+(gl.length?(sk.length?' · ':'')+gl.length+' GP in goal · '+sum(gl,'saves')+' SV / '+sum(gl,'shots_against')+' SA':'')+(rp&&rp.v?' · Bid '+salary(rp.v):'')+'</p></div></header>'+
      '<h4>GAME LOG · VERIFIED</h4><div class="th-table-scroll"><table class="th-table"><tbody>'+rows+'</tbody></table></div><p class="th-caption"><a href="'+userUrl(uid)+'" target="_blank" rel="noopener noreferrer">Official LG profile ↗</a> · Lines are credited to the nation shown in each game\'s LG box score.</p>');
  }
  function statFig(v,l){return '<span class="lg3p-fig"><b>'+v+'</b><small>'+l+'</small></span>';}
  function playerRow(o){const A=window.LG3S_NATION_ART,n=o.nation||'',bg=A&&A.has(n)?A.css(n,'card'):'none';
    return '<div class="lg3p-row'+(o.star?' is-star':'')+'" style="--pa:'+esc(bg)+';--pc:'+(A?A.color(n):'#9aa7b3')+';--pc2:'+(A?A.color(n,1):'#c9d3dc')+'"><span class="lg3p-id">'+o.name+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'</span><span class="lg3p-stats">'+o.stats.map(x=>statFig(x[0],x[1])).join('')+'</span>'+(o.tag?'<em class="lg3p-tag">'+esc(o.tag)+'</em>':'')+'</div>';}
  function gameRow(id){const x=live.games.get(Number(id));if(x)return x;const g=(data.games||[]).find(z=>Number(z.id)===Number(id));return g?{lg_game_id:g.id,away_lg_team_id:g.away,home_lg_team_id:g.home,_static:g}:null;}
  function heroFor(row){const a=teamOr(row.away_lg_team_id,row.away_nation),h=teamOr(row.home_lg_team_id,row.home_nation);const when=row._static?(row._static.date+' · '+shortTime(row._static.time)+' ET'):(nightTitle(nightKey(row.game_night_date||row.scheduled_at))+' · '+etClock(row.scheduled_at)+' ET');return matchupHtml(row,a,h,'hero','GAME '+String(row.lg_game_id).slice(-3)+' · '+when);}
  function gamePage(id){
    const row=gameRow(id);if(!row)return;
    const ls=live.lines.filter(l=>Number(l.lg_game_id)===Number(id));
    const topP=Math.max(0,...ls.filter(l=>l.player_kind==='skater').map(l=>l.points));
    const tbl=tid=>{const t=team(tid);const r=ls.filter(l=>l.lg_team_id===tid).map(l=>{const g=l.player_kind==='goalie';
      const tag=g?(l.shots_against>0&&l.saves===l.shots_against?'SHUTOUT':''):(l.goals>=3?'HAT TRICK':(topP>0&&l.points===topP?'GAME HIGH':''));
      const svp=l.shots_against>0?(l.saves/l.shots_against).toFixed(3).replace(/^0/,''):'—';
      return playerRow({name:playerLink(l.lg_user_id,l.gamertag),sub:g?'GOALIE':(l.position||''),nation:t?t.name:'',star:!!tag,tag,stats:g?[[l.saves,'SV'],[l.shots_against,'SA'],[svp,'SV%']]:[[l.goals,'G'],[l.assists,'A'],[l.points,'PTS']]});}).join('');
      return r?'<h4>'+esc(t?t.name:'').toUpperCase()+' · VERIFIED BOX SCORE</h4><div class="lg3p-list">'+r+'</div>':'';};
    const status=row.is_verified?'Official LG data · verified '+esc(etTime(row.verified_at)):(row.status==='pending_verification'?'Final posted · verifying':'Result pending');
    const dr=drafts.get(Number(id));const drHtml=dr&&!row.is_verified?'<h4>MATCHUP PREVIEW · ECM</h4><div class="th-recap-body">'+esc(dr.body_md).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|\n)_(.+?)_(?=\n|$)/g,'$1<i>$2</i>').split(/\n{2,}/).map(x=>'<p>'+x+'</p>').join('')+'</div>':'';
    const mdP=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|\n)_(.+?)_(?=\n|$)/g,'$1<i>$2</i>').split(/\n{2,}/).map(x=>'<p>'+x.replace(/\n/g,'<br>')+'</p>').join('');
    const rc=row.is_verified?live.recaps.get(Number(id)):null;
    const ff=row.is_verified&&row.is_forfeit?'<h4>FORFEIT</h4><div class="th-recap-body"><p><b>Forfeit: illegal player.</b>'+({921552:1,921562:1}[Number(id)]?' <em class="lg3m-fine">the ctbli special</em>':'')+'</p><p>LeagueGaming records this game as a '+Number(row.away_score)+'-'+Number(row.home_score)+' forfeit result, and the standings count it that way.</p></div>':'';
    const rcHtml=rc?'<h4>APPROVED RECAP · ECM</h4><div class="th-recap-body"><p><b>'+esc(rc.title)+'</b></p>'+mdP(rc.body_md)+'</div>':(row.is_verified&&!ff?'<p class="th-caption">ECM recap is in review.</p>':'');
    openDetail(heroFor(row)+'<p class="th-caption">'+status+'</p>'+ff+rcHtml+drHtml+(row.is_verified?tbl(row.away_lg_team_id)+tbl(row.home_lg_team_id):'')+'<p class="th-caption th-source"><a href="'+gameUrl(id)+'" target="_blank" rel="noopener noreferrer">Source: LeagueGaming ↗</a></p>');
  }
  function recapPage(id){
    const recap=live.recaps.get(Number(id)), game=live.games.get(Number(id));
    if(!recap||!game||!game.is_verified) return;
    const body=esc(recap.body_md).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split(/\n{2,}/).map(x=>'<p>'+x.replace(/\n/g,'<br>')+'</p>').join('');
    openDetail(heroFor(game)+'<header class="th-detail-head"><div><p class="eyebrow">APPROVED RECAP · '+esc(nightTitle(nightKey(game.game_night_date)))+'</p><h3>'+esc(recap.title)+'</h3></div></header><div class="th-recap-body">'+body+'</div><p class="th-caption"><a href="'+gameUrl(id)+'" target="_blank" rel="noopener noreferrer">Official LG game centre ↗</a></p>');
  }
  /* Published power rankings write-ups (view: approved/published, not superseded). */
  async function rankingsPage(id){
    let r=null;try{r=(await view('lg3s_public_power_rankings','select=id,week,title,body_md&id=eq.'+Number(id)))[0];}catch(e){console.warn('LG3s rankings',e);}
    if(!r)return;
    const body=esc(r.body_md).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split(/\n{2,}/).map(x=>'<p>'+x.replace(/\n/g,'<br>')+'</p>').join('');
    openDetail('<header class="th-detail-head"><div><p class="eyebrow">TRIO POWER RANKINGS · WEEK '+Number(r.week)+'</p><h3>'+esc(r.title)+'</h3></div></header><div class="th-recap-body">'+body+'</div>');
  }
  async function wireRankings(){
    let r=[];try{r=await view('lg3s_public_power_rankings','select=id,week,title&order=week.desc,id.desc&limit=1');}catch(e){return;}
    if(!r[0])return;const href='#rankings/'+Number(r[0].id);
    const card=document.querySelector('.lg3x-card[data-feature="trio_power_rankings"]');
    if(card){const soon=card.querySelector('.lg3x-soon');const a=document.createElement('a');a.className='lg3x-soon lg3x-live';a.href=href;a.textContent='READ WEEK '+Number(r[0].week)+' →';if(soon)soon.replaceWith(a);else card.appendChild(a);}
    const ph=document.querySelector('#power .lg3-ph-link');if(ph){const a=document.createElement('a');a.className='lg3-ph-link';a.href=href;a.textContent='WRITE-UP →';ph.before(a);}
  }
  /* Published Threes Desk segments: Daily Three + Duo Index (view: status='published', not superseded). */
  let threes=[];
  const THREE_SLOT={performer:'PERFORMER OF THE NIGHT',stat:'THE NUMBER',storyline:'THE STORYLINE'};
  const gdFmt=v=>{const n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2):'—';};
  const threeDate=r=>r&&(r.game_night_date||(r.output_json&&r.output_json.date))?nightTitle(nightKey(r.game_night_date||r.output_json.date)):'';
  function threesPage(id){
    const r=threes.find(x=>Number(x.id)===Number(id));if(!r||!r.output_json)return;const o=r.output_json;
    if(r.feature==='daily_three'){
      const nights=threes.filter(x=>x.feature==='daily_three').sort((a,b)=>String(a.game_night_date||'').localeCompare(String(b.game_night_date||''))||a.id-b.id);
      const i=nights.findIndex(x=>x.id===r.id),prev=nights[i-1],next=nights[i+1];
      const nav=(prev||next)?'<p class="lg3d-nav">'+(prev?'<a href="#threes/'+Number(prev.id)+'">← '+esc(threeDate(prev))+'</a>':'<span></span>')+(next?'<a href="#threes/'+Number(next.id)+'">'+esc(threeDate(next))+' →</a>':'')+'</p>':'';
      const items=(o.items||[]).map(it=>{
        const big=it.slot==='performer'?it.stat_line:it.slot==='stat'?it.stat_value:'';
        const who=it.slot==='performer'?[it.player,it.team].filter(Boolean).join(' · '):it.slot==='stat'?(it.subject||''):(it.teams||[]).join(' · ');
        return '<article class="lg3d-item is-'+esc(it.slot)+'"><p class="eyebrow">'+esc(THREE_SLOT[it.slot]||it.slot)+'</p><h4>'+esc(it.headline)+'</h4>'+(big?'<p class="lg3d-big">'+esc(big)+'</p>':'')+'<p>'+esc(it.blurb)+'</p>'+(who?'<p class="th-caption">'+esc(who)+'</p>':'')+'</article>';}).join('');
      openDetail('<header class="th-detail-head"><div><p class="eyebrow">DAILY THREE · '+esc(threeDate(r))+'</p><h3>'+esc(o.tagline||r.title)+'</h3></div></header><div class="lg3d-list">'+items+'</div>'+nav);
      return;
    }
    if(r.feature==='roster_wire'){
      const mv=(o.moves||[]).slice().sort((a,b)=>(b.is_big_move?1:0)-(a.is_big_move?1:0)||(a.type==='released'?1:0)-(b.type==='released'?1:0));
      const path=m=>m.type==='released'?'Released by '+(m.from_team||'—'):[m.from_team,m.to_team].filter(Boolean).join(' → ');
      const items=mv.map(m=>'<article class="lg3d-item'+(m.is_big_move?' is-big':'')+'"><p class="eyebrow">'+esc(String(m.type||'').toUpperCase())+(m.impact?' · '+esc(String(m.impact).toUpperCase()):'')+'</p><h4>'+esc(m.ticker)+'</h4><p class="lg3w-route">'+esc((m.players||[]).join(', '))+' · '+esc(path(m))+'</p><p>'+esc(m.hot_take)+'</p>'+(m.winner&&m.winner!=='TBD'?'<p class="th-caption">Early winner: '+esc(m.winner)+'</p>':'')+'</article>').join('');
      openDetail('<header class="th-detail-head"><div><p class="eyebrow">ROSTER WIRE · '+esc(String(o.updated_label||'').toUpperCase())+'</p><h3>'+(mv.length?Number(mv.length)+' roster moves since the last check':'A quiet wire')+'</h3><p>Compared with the previous roster check. Moves happened somewhere between the two checks.</p></div></header>'+(mv.length?'<div class="lg3d-list">'+items+'</div>':'<p>'+esc(o.quiet_note)+'</p>'));
      return;
    }
    if(r.feature==='pick3_preview'){
      const ps=o.players||[],teams=[...new Set(ps.map(p=>p.team))].sort();
      const rows=ps.map(p=>'<div class="lg3k-row" data-team="'+esc(p.team)+'" data-value="'+(p.is_value_pick?1:0)+'">'+playerRow({name:esc(p.player),sub:String(p.team||'').toUpperCase(),nation:p.team||'',star:!!p.is_value_pick,tag:p.is_value_pick?'VALUE PICK':'',stats:[['$'+Number(p.price),'PRICE']]})+(p.note?'<p class="th-caption lg3d-why">'+esc(p.note)+'</p>':'')+'</div>').join('');
      openDetail('<header class="th-detail-head"><div><p class="eyebrow">PICK YOUR 3 · '+esc(String(o.week_label||'').toUpperCase())+' PRICES</p><h3>Three skaters. $30. One per team.</h3><p>'+esc(o.intro)+'</p><p class="th-caption">Scoring: goal 3 · assist 2 · shot on goal 0.5 · hit 0.25 · team win 1 · hat trick +3. Prices run $4 to $15.</p></div></header>'+
        '<p class="lg3k-filter"><label>Show <select id="lg3kF"><option value="">All '+Number(ps.length)+' skaters</option><option value="__value">Value picks</option>'+teams.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select></label></p><div class="lg3p-list lg3k-list">'+rows+'</div>');
      const f=$('lg3kF');if(f)f.addEventListener('change',()=>{const v=f.value;document.querySelectorAll('#thDetailBody .lg3k-row').forEach(el=>{el.hidden=!!v&&(v==='__value'?el.dataset.value!=='1':el.dataset.team!==v);});});
      return;
    }
    const rows=(o.top_duos||[]).map(d=>playerRow({name:esc((d.players||[]).join(' & ')),sub:'#'+Number(d.rank)+' · '+String(d.team||'').toUpperCase()+(d.nickname?' · '+d.nickname:''),nation:d.team||'',star:Number(d.rank)===1,tag:Number(d.rank)===1?'TOP DUO':'',
      stats:[[esc(d.record_together),'W-L'],[esc(gdFmt(d.goal_diff_per_game)),'GD/GP'],[esc(d.points_per_game),'P/GP']]})+(d.breakdown?'<p class="th-caption lg3d-why">'+esc(d.breakdown)+'</p>':'')).join('');
    const side=(lab,x)=>x&&x.players&&x.players.length?'<article class="lg3d-item"><p class="eyebrow">'+lab+'</p><h4>'+esc(x.players.join(' & '))+(x.team?' · '+esc(x.team):'')+'</h4><p>'+esc(x.note)+'</p></article>':'';
    openDetail('<header class="th-detail-head"><div><p class="eyebrow">DUO INDEX · '+esc(o.week_label||('WEEK '+Number(r.week))).toUpperCase()+'</p><h3>The pairs that drive results</h3><p>Season to date · minimum 4 games together · verified box scores only</p></div></header><div class="lg3p-list">'+rows+'</div><div class="lg3d-list">'+side('ODD COUPLE',o.odd_couple)+side('NEEDS COUNSELING',o.needs_counseling)+'</div>');
  }
  async function wireThrees(){
    try{threes=await view('lg3s_public_threes','select=id,feature,period_key,game_night_date,week,title,output_json&order=id.desc&limit=40');}catch(e){console.warn('LG3s threes',e);return;}
    const pick=f=>threes.filter(x=>x.feature===f&&x.output_json).sort((a,b)=>String(b.game_night_date||'').localeCompare(String(a.game_night_date||''))||(Number(b.week)||0)-(Number(a.week)||0)||b.id-a.id)[0];
    const wire=(f,r,label,teaser)=>{const card=document.querySelector('.lg3x-card[data-feature="'+f+'"]');if(!card||!r)return;
      if(teaser){const p=card.querySelector('p');if(p)p.textContent=teaser;}
      const soon=card.querySelector('.lg3x-soon');const a=document.createElement('a');a.className='lg3x-soon lg3x-live';a.href='#threes/'+Number(r.id);a.textContent=label;if(soon)soon.replaceWith(a);else card.appendChild(a);};
    const d3=pick('daily_three'),duo=pick('duo_index');
    if(d3)wire('daily_three',d3,'READ '+threeDate(d3)+' →',d3.output_json.tagline);
    const top=duo&&(duo.output_json.top_duos||[])[0];
    if(duo)wire('duo_index',duo,'READ WEEK '+Number(duo.week)+' →',top?'No. 1: '+(top.players||[]).join(' & ')+' ('+top.team+'), '+top.record_together+' together.':'');
    const rw=pick('roster_wire');
    if(rw){const m=rw.output_json.moves||[],big=m.find(x=>x.is_big_move)||m[0];wire('roster_wire',rw,'READ '+String(rw.output_json.updated_label||'').toUpperCase()+' →',m.length?m.length+' moves on the wire. '+(big?big.ticker+'.':''):rw.output_json.quiet_note);}
    if(/^#threes\//.test(location.hash))route();
  }
  /* ===== Leaderboards (verified box-score lines only) ===== */
  const LB_SK=[['p','POINTS','PTS'],['g','GOALS','G'],['a','ASSISTS','A'],['pm','PLUS / MINUS','+/-'],['sog','SHOTS','SOG'],['hit','HITS','HIT'],['tk','TAKEAWAYS','TK'],['blk','BLOCKS','BLK'],['int','INTERCEPTIONS','INT']];
  const LB_GL=[['w','WINS','W'],['svp','SAVE %','SV%',1],['gaa','GOALS AGAINST PER GAME','GA/GP',1,1],['sv','SAVES','SV'],['so','SHUTOUTS','SO']];
  const LB_MIN=3;let lbCat='p',lbView='board',lbIdx='sk',lbSort={k:'p',d:-1},lbCache=null;
  function lbData(){
    if(lbCache)return lbCache;const P=new Map(),G=new Set();
    live.lines.forEach(l=>{const gid=Number(l.lg_game_id);G.add(gid);let p=P.get(l.lg_user_id);
      if(!p){p={id:l.lg_user_id,n:l.gamertag,tc:{},pc:{},sk:{gp:0,g:0,a:0,p:0,pm:0,sog:0,hit:0,tk:0,blk:0,int:0,toi:0},gl:{gp:0,w:0,sa:0,ga:0,sv:0,so:0},log:[]};P.set(l.lg_user_id,p);}
      p.n=l.gamertag;p.tc[l.lg_team_id]=(p.tc[l.lg_team_id]||0)+1;const ps=l.player_kind==='goalie'?'G':(l.position||'');p.pc[ps]=(p.pc[ps]||0)+1;
      const x=live.games.get(gid);let res='';if(x&&x.is_verified){const home=x.home_lg_team_id===l.lg_team_id,f=+(home?x.home_score:x.away_score),a=+(home?x.away_score:x.home_score);res=(f>a?'W':'L')+' '+f+'–'+a;}
      if(l.player_kind==='goalie'){const q=p.gl;q.gp++;q.sa+=+l.shots_against||0;q.ga+=+l.goals_against||0;q.sv+=+l.saves||0;if(res[0]==='W')q.w++;if(+l.goals_against===0&&+l.shots_against>0)q.so++;}
      else{const q=p.sk;q.gp++;q.g+=+l.goals||0;q.a+=+l.assists||0;q.p+=+l.points||0;q.pm+=+l.plus_minus||0;q.sog+=+l.shots||0;q.hit+=+l.hits||0;q.tk+=+l.takeaways||0;q.blk+=+l.blocks||0;q.int+=+l.interceptions||0;q.toi+=+l.toi_seconds||0;}
      p.log.push({l,x,res});});
    const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0];
    const all=[...P.values()].map(p=>{p.tid=Number(top(p.tc)[0]);p.team=team(p.tid);p.pos=top(p.pc)[0];p.gl.svp=p.gl.sa?p.gl.sv/p.gl.sa:null;p.gl.gaa=p.gl.gp?p.gl.ga/p.gl.gp:null;return p;});
    return lbCache={all,n:G.size};
  }
  function lbList(cat){const d=lbData(),gc=LB_GL.find(c=>c[0]===cat),def=gc||LB_SK.find(c=>c[0]===cat);
    const pool=d.all.filter(p=>gc?p.gl.gp>0&&(!gc[3]||p.gl.gp>=LB_MIN):p.sk.gp>0).map(p=>({p,v:gc?p.gl[cat]:p.sk[cat],gp:gc?p.gl.gp:p.sk.gp})).filter(r=>r.v!=null);
    const asc=gc&&gc[4];pool.sort((a,b)=>(asc?a.v-b.v:b.v-a.v)||a.gp-b.gp||a.p.n.localeCompare(b.p.n));
    pool.forEach((r,i)=>{r.rank=i&&pool[i-1].v===r.v?pool[i-1].rank:i+1;});return {def,gc:!!gc,rows:pool};}
  function lbFmt(cat,v){if(v==null)return '—';if(cat==='svp')return v.toFixed(3).replace(/^0/,'');if(cat==='gaa')return v.toFixed(2);if(cat==='pm')return (v>0?'+':'')+v;return String(v);}
  function lbVars(t){const A=window.LG3S_NATION_ART,n=t?t.name:'';return '--pa:'+esc(A&&A.has(n)?A.css(n,'hero'):'none')+';--pc:'+(A?A.color(n):'#9aa7b3')+';--pc2:'+(A?A.color(n,1):'#c9d3dc');}
  function renderLB(){
    const box=$('lbBody');if(!box)return;const d=lbData();
    $('lbNote').innerHTML=live.ok?'Based on <b>'+d.n+'</b> verified box scores · coverage is partial (only games with a verified LG box score count) · SV% and GA/GP require '+LB_MIN+'+ GP · GA/GP = goals against per game':'Live data unavailable — leaderboards appear once verified box scores load.';
    $('lbChips').innerHTML='<span class="lb-grp">SKATERS</span>'+LB_SK.map(c=>'<button type="button" data-cat="'+c[0]+'" aria-pressed="'+(lbView==='board'&&lbCat===c[0])+'">'+c[2]+'</button>').join('')+'<span class="lb-grp">GOALIES</span>'+LB_GL.map(c=>'<button type="button" data-cat="'+c[0]+'" aria-pressed="'+(lbView==='board'&&lbCat===c[0])+'">'+c[2]+'</button>').join('')+'<button type="button" class="lb-full" data-cat="index" aria-pressed="'+(lbView==='index')+'">FULL INDEX</button>';
    if(!live.ok||!d.all.length){box.innerHTML='';return;}
    if(lbView==='index'){box.innerHTML=lbIndex();return;}
    const L=lbList(lbCat),r=L.rows.slice(0,10),lab=L.def[2];
    const sub=x=>(x.p.team?esc(x.p.team.name).toUpperCase():'')+' · '+esc(x.p.pos)+' · '+x.gp+' GP';
    const hero=r[0]?'<a class="lb-hero" href="#player/'+x0(r[0])+'" style="'+lbVars(r[0].p.team)+'"><span class="lb-rank1">#1</span>'+(r[0].p.team?teamMark(r[0].p.team,64):'')+'<span class="lb-hn"><small>'+esc(L.def[1])+' LEADER</small><strong>'+esc(r[0].p.n)+'</strong><em>'+sub(r[0])+'</em></span><span class="lb-hv"><b>'+lbFmt(lbCat,r[0].v)+'</b><small>'+lab+'</small></span></a>':'<p class="th-caption">No qualified players yet.</p>';
    const med=r.slice(1,3).map(x=>'<a class="lb-med is-'+(x.rank===2?'silver':x.rank===1?'gold':'bronze')+'" href="#player/'+x0(x)+'" style="'+lbVars(x.p.team)+'"><span class="lb-rk">#'+x.rank+'</span>'+(x.p.team?teamMark(x.p.team,40):'')+'<span class="lb-hn"><strong>'+esc(x.p.n)+'</strong><em>'+sub(x)+'</em></span><span class="lb-hv"><b>'+lbFmt(lbCat,x.v)+'</b><small>'+lab+'</small></span></a>').join('');
    const rest=r.slice(3).map(x=>playerRow({name:'<i class="lb-rk">'+x.rank+'</i>'+(x.p.team?teamMark(x.p.team,28):'')+playerLink(x.p.id,x.p.n),sub:(x.p.team?x.p.team.name.toUpperCase():'')+' · '+x.p.pos,nation:x.p.team?x.p.team.name:'',stats:[[x.gp,'GP'],[lbFmt(lbCat,x.v),lab]]})).join('');
    box.innerHTML='<div class="lb-board"><div class="lb-top">'+hero+'<div class="lb-meds">'+med+'</div></div><div class="lg3p-list lb-rest">'+rest+'</div></div>';
  }
  function x0(x){return Number(x.p.id);}
  function lbIndex(){
    const d=lbData(),sk=lbIdx==='sk';
    const cols=sk?[['n','PLAYER'],['nat','NATION'],['pos','POS'],['gp','GP'],...LB_SK.map(c=>[c[0],c[2]])]:[['n','GOALIE'],['nat','NATION'],['gp','GP'],...LB_GL.map(c=>[c[0],c[2]]),['sa','SA'],['ga','GA']];
    const rows=d.all.filter(p=>sk?p.sk.gp>0:p.gl.gp>0).map(p=>{const s=sk?p.sk:p.gl;return {p,get:k=>k==='n'?p.n.toLowerCase():k==='nat'?(p.team?p.team.name:''):k==='pos'?p.pos:s[k]};});
    const k=lbSort.k,dd=lbSort.d;rows.sort((a,b)=>{const x=a.get(k),y=b.get(k);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return (typeof x==='string'?x.localeCompare(y):x-y)*dd||a.p.n.localeCompare(b.p.n);});
    const cell=(r,c)=>c==='n'?playerLink(r.p.id,r.p.n):c==='nat'?(r.p.team?nationLink(r.p.team):''):c==='pos'?esc(r.p.pos):lbFmt(c,r.get(c));
    return '<div class="lb-idx-tabs"><button type="button" data-idx="sk" aria-pressed="'+sk+'">SKATERS</button><button type="button" data-idx="gl" aria-pressed="'+!sk+'">GOALIES</button><span>'+rows.length+' players · tap a column to sort</span></div><div class="th-table-scroll lb-idx"><table class="th-table"><thead><tr><th>#</th>'+cols.map(c=>'<th scope="col"><button type="button" data-sort="'+c[0]+'"'+(k===c[0]?' class="is-on" aria-sort="'+(dd<0?'descending':'ascending')+'"':'')+'>'+c[1]+(k===c[0]?(dd<0?' ▼':' ▲'):'')+'</button></th>').join('')+'</tr></thead><tbody>'+rows.map((r,i)=>'<tr><td class="th-num-rank">'+(i+1)+'</td>'+cols.map(c=>'<td'+(['n','nat','pos'].includes(c[0])?'':' class="num"')+'>'+cell(r,c[0])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function lbWire(){const c=$('lbChips'),b=$('lbBody');if(!c)return;
    c.addEventListener('click',e=>{const x=e.target.closest('button[data-cat]');if(!x)return;if(x.dataset.cat==='index'){lbView='index';}else{lbView='board';lbCat=x.dataset.cat;}renderLB();});
    b.addEventListener('click',e=>{const s=e.target.closest('button[data-sort]');if(s){const k=s.dataset.sort;lbSort=lbSort.k===k?{k,d:-lbSort.d}:{k,d:['n','nat','pos','gaa'].includes(k)?1:-1};renderLB();return;}const t=e.target.closest('button[data-idx]');if(t){lbIdx=t.dataset.idx;lbSort={k:lbIdx==='sk'?'p':'w',d:-1};renderLB();}});}
  function playerPage(uid){
    const d=lbData(),p=d.all.find(z=>z.id===uid);if(!p)return playerCard(uid);
    const t=p.team,s=p.sk,g=p.gl,isG=g.gp>0&&g.gp>=s.gp,mmss=v=>Math.floor(v/60)+':'+String(Math.round(v%60)).padStart(2,'0'),per=(v,n)=>n?(v/n).toFixed(2):'—';
    const strip=(isG?[[g.gp,'GP'],[g.w,'W'],[lbFmt('svp',g.svp),'SV%'],[lbFmt('gaa',g.gaa),'GA/GP'],[g.sv,'SV'],[g.so,'SO']]:[[s.gp,'GP'],[s.g,'G'],[s.a,'A'],[s.p,'PTS'],[lbFmt('pm',s.pm),'+/-'],[s.sog,'SOG'],[s.hit,'HIT']]).map(x=>statFig(x[0],x[1])).join('');
    const badges=[...(s.gp?LB_SK:[]),...(g.gp?LB_GL:[])].map(c=>{const L=lbList(c[0]),r=L.rows.find(z=>z.p.id===uid);if(!r)return c[3]&&g.gp?'<span class="lb-badge is-nq"><b>NQ</b><small>'+c[2]+'</small></span>':'';const m=r.rank===1?'gold':r.rank===2?'silver':r.rank===3?'bronze':'';return '<span class="lb-badge'+(m?' is-'+m:'')+'" title="'+esc(c[1])+'"><b>#'+r.rank+'</b><small>'+c[2]+' · '+lbFmt(c[0],r.v)+'</small></span>';}).join('');
    const avg=isG?[[per(g.sv,g.gp),'SV / GP'],[per(g.sa,g.gp),'SA / GP'],[lbFmt('gaa',g.gaa),'GA / GP']]:[[per(s.p,s.gp),'PTS / GP'],[per(s.g,s.gp),'G / GP'],[per(s.a,s.gp),'A / GP'],[per(s.sog,s.gp),'SOG / GP'],[per(s.hit,s.gp),'HIT / GP'],[s.gp&&s.toi?mmss(s.toi/s.gp):'—','TOI / GP']];
    const log=p.log.slice().sort((a,b)=>String(b.x&&b.x.scheduled_at).localeCompare(String(a.x&&a.x.scheduled_at))).map(e=>{const l=e.l,x=e.x,mine=team(l.lg_team_id),opp=x?team(x.home_lg_team_id===l.lg_team_id?x.away_lg_team_id:x.home_lg_team_id):null,home=x&&x.home_lg_team_id===l.lg_team_id;
      const when=x&&x.scheduled_at?new Date(x.scheduled_at).toLocaleDateString('en-US',{timeZone:'America/Toronto',month:'short',day:'numeric'}).toUpperCase()+' · '+etClock(x.scheduled_at)+' ET':esc(String(l.game_night_date));
      const st=l.player_kind==='goalie'?[[l.saves,'SV'],[l.shots_against,'SA'],[l.shots_against>0?(l.saves/l.shots_against).toFixed(3).replace(/^0/,''):'—','SV%']]:[[l.goals,'G'],[l.assists,'A'],[l.points,'PTS'],[lbFmt('pm',+l.plus_minus||0),'+/-']];
      return playerRow({name:'<a href="#game/'+Number(l.lg_game_id)+'">'+(home?'VS ':'@ ')+esc(opp?opp.name:'TBD').toUpperCase()+'</a>',sub:when+(mine&&t&&mine.id!==t.id?' · FOR '+mine.name.toUpperCase():''),nation:opp?opp.name:'',star:e.res[0]==='W',tag:e.res,stats:st});}).join('');
    openDetail('<header class="lb-phero'+natCls(t?t.name:'')+'" style="'+lbVars(t)+'">'+(t?teamMark(t,88):'')+'<div><p class="eyebrow">'+(t?esc(t.name).toUpperCase()+' · ':'')+esc(isG?'GOALIE':p.pos)+' · LG3S SEASON 1</p><h3>'+esc(p.n)+'</h3><div class="lb-strip">'+strip+'</div></div></header>'+
      '<h4>CATEGORY RANKS</h4><div class="lb-badges">'+badges+'</div><p class="th-caption">Ranks among '+d.n+' verified box scores. NQ = under '+LB_MIN+' GP for rate stats.</p>'+
      '<h4>PER-GAME AVERAGES</h4><div class="lb-avg">'+avg.map(x=>statFig(x[0],x[1])).join('')+'</div>'+
      '<h4>GAME LOG · VERIFIED</h4><div class="lg3p-list">'+log+'</div><p class="th-caption"><a href="'+userUrl(uid)+'" target="_blank" rel="noopener noreferrer">Official LG profile ↗</a> · Lines are credited to the nation shown in each game\'s LG box score.</p>');
  }
  function route(){const m=/^#(nation|player|recap|game|rankings|threes)\/(\d+)$/.exec(location.hash);if(!m)return;const id=Number(m[2]);if(m[1]==='threes')threesPage(id);else if(m[1]==='game')gamePage(id);else if(m[1]==='nation')nationPage(id);else if(m[1]==='player')playerPage(id);else if(m[1]==='rankings')rankingsPage(id);else gamePage(id);}
  function renderPlayers(){
    const search=$('thPlayerSearch').value.trim().toLocaleLowerCase(),tid=$('thPlayerTeam').value,status=$('thPlayerStatus').value,pos=$('thPlayerPosition').value,sort=$('thPlayerSort').value;
    let players=data.players.filter(p=>(status==='all'||p.s===status)&&(tid==='all'||String(p.t)===tid)&&(pos==='all'||p.p===pos)&&(!search||p.n.toLocaleLowerCase().includes(search)||team(p.t).name.toLocaleLowerCase().includes(search)));
    players.sort(sort==='name'?(a,b)=>a.n.localeCompare(b.n):sort==='team'?(a,b)=>team(a.t).name.localeCompare(team(b.t).name)||a.n.localeCompare(b.n):(a,b)=>(b.v??-1)-(a.v??-1)||a.n.localeCompare(b.n));
    const shown=players.slice(0,playerLimit);
    $('thPlayerRows').innerHTML=shown.length?shown.map((p,i)=>{
      const t=team(p.t);
      return '<tr><td class="th-num-rank">'+(i+1)+'</td><td>'+playerLink(p.id,p.n)+' <a href="'+userUrl(p.id)+'" target="_blank" rel="noopener noreferrer" aria-label="LG profile">↗</a>'+(p.r?'<small class="th-role">'+esc(p.r)+'</small>':'')+'</td><td><a class="th-team-link" href="'+teamUrl(t.id)+'" target="_blank" rel="noopener noreferrer">'+teamMark(t,30)+esc(t.name)+'</a></td><td>'+esc(p.p)+'</td><td><span class="th-status '+(p.s==='TC'?'is-tc':'')+'">'+(p.s==='TC'?'Training camp':'Active')+'</span></td><td class="num">'+salary(p.v)+'</td></tr>';
    }).join(''):'<tr><td colspan="6">No roster members match these filters.</td></tr>';
    $('thPlayerCount').textContent='SHOWING '+shown.length+' OF '+players.length+' MATCHING PLAYERS · '+data.players.length+' REGISTERED ACROSS THE LEAGUE · OCT 21 SNAPSHOT';
    $('thPlayersMore').hidden=shown.length>=players.length;
  }
  async function start(){
    const response=await fetch('lg3s-season1-data.json?v=20261021-2',{cache:'no-store'});
    if(!response.ok)throw Error('Snapshot unavailable');
    data=await response.json();
    if(!Array.isArray(data.teams)||data.teams.length!==12||data.games.length!==30||data.players.length<200)throw Error('Incomplete league snapshot');
    tm=new Map(data.teams.map(t=>[t.id,t]));
    try{await loadLive();}catch(e){console.warn('LG3s verified results unavailable; showing static snapshot.',e);}
    if(new URLSearchParams(location.search).has('legacy'))document.querySelectorAll('[data-lg3s-legacy]').forEach(e=>e.hidden=false);
    chooseWeek();
    renderNations();renderGames();renderStandings();renderLeaders();renderLB();lbWire();
    window.addEventListener('hashchange',route);route();wireRankings();wireThrees();
    const dc=$('thDetailClose');if(dc)dc.addEventListener('click',()=>$('thDetail').close());const dd=$('thDetail');if(dd)dd.addEventListener('close',()=>{if(location.hash)history.replaceState(null,'',location.pathname+location.search);});
    $('thPlayerTeam').innerHTML='<option value="all">All twelve nations</option>'+data.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join('');
    renderPlayers();
    const nightTabs=$('thNightTabs'); if(nightTabs) nightTabs.addEventListener('click',e=>{const w=e.target.closest('button[data-week]'); if(w){weekShift=Number(w.dataset.week);chooseWeek();renderGames();return;} const b=e.target.closest('button[data-date]'); if(!b) return; chosenDay=b.dataset.date; renderGames();});
    document.querySelectorAll('.th-board-mode').forEach(b=>b.addEventListener('click',()=>{boardMode=b.dataset.boardMode;renderStandings();}));
    ['thPlayerSearch','thPlayerTeam','thPlayerStatus','thPlayerPosition','thPlayerSort'].forEach(id=>$(id).addEventListener(id==='thPlayerSearch'?'input':'change',()=>{playerLimit=40;renderPlayers();}));
    $('thPlayersMore').addEventListener('click',()=>{playerLimit+=40;renderPlayers();});
  }
  start().catch(err=>{
    console.error('LG3s public media snapshot:',err);
    if($('thGames'))$('thGames').innerHTML='<p class="th-caption">The saved fixture board is temporarily unavailable. Check <a href="https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=standing&leagueid=154&seasonid=1" target="_blank" rel="noopener noreferrer">official LeagueGaming</a> for the latest schedule.</p>';
    if($('thStandings'))$('thStandings').innerHTML='<p class="th-caption">Official group snapshot unavailable.</p>';
    if($('thPlayerRows'))$('thPlayerRows').innerHTML='<tr><td colspan="6">Roster snapshot unavailable right now.</td></tr>';
  });
})();
