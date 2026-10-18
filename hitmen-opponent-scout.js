(() => {
  const TEAM='b0bcbdda-da9d-419d-8f61-b34937966d49',SEASON=55;
  const E=id=>document.getElementById(id), DB=()=>window.VVHLBackend?.db, ST=()=>window.VVHLBackend?.state||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  /* private pregame clips: [clip](storage:hitmen-vod-clips/...) -> 'Play clip' toggle (hitmen-clips.js); stripped if the helper is missing */
  /* Team clips: every private clip saved for this opponent (signed-in Hitmen members; hitmen-clips.js) */
  const teamClipsBtn=()=>window.HitmenClips&&opponent?(data.reports.forEach(r=>window.HitmenClips.remember(opponent,r.report)),window.HitmenClips.teamButton(opponent)):'';
  const clipHtml=h=>window.HitmenClips?window.HitmenClips.tags(h,{compact:true}):String(h??'').replace(/\s*\[clip\]\(storage:[^)\s]*\)/g,'');
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const qs=new URLSearchParams(location.search), opponent=qs.get('opponent')||'';
  const POS={LW:1,C:2,RW:3,LD:4,RD:5,G:6};
  const inside=new Set([4,6,7,8,10,11,12,14]);
  let data={roster:[],stats:[],history:[],games:[],eaGames:[],reports:[],scouts:[]},players=[],selected=null,filter='current',metric='shots',blazeLogs=new Map();
  const chel=new Map(); // ChelStats lookups by compact gamertag: {state:'loading'|'ok'|'none', profile}

  function canWrite(){
    if(String(ST().profile?.role||'').toLowerCase()==='admin')return true;
    return (ST().memberships||[]).some(m=>m.team_id===TEAM&&m.active!==false&&['owner','gm','agm'].includes(String(m.role||'').toLowerCase()));
  }
  function fmt(v,d=0){const n=num(v);return n==null?'—':n.toFixed(d)}
  // Every number says where it came from: LG = official league games (feeds scouting reports); PUB = EA club/career totals that include pub games (profile only).
  const SRC={lg:'LG games',club:'EA club · incl. pubs',pub:'Pubs + all EA modes'};
  function stat(label,value,scope=''){const k=SRC[scope]?scope:/^(league|LG)/i.test(scope)?'lg':'';return '<div class="hs-stat'+(k?' src-'+(k==='lg'?'lg':'pub'):'')+'"><small>'+esc(label)+'</small><b>'+esc(value==null?'—':value)+'</b>'+(scope?'<em>'+esc(SRC[k]||scope)+'</em>':'')+'</div>'}
  const badge=k=>'<span class="hs-src hs-src-'+(k==='lg'?'lg':'pub')+'">'+(k==='lg'?'LG GAMES':k==='club'?'EA CLUB · INCL. PUBS':'PUBS · ALL EA MODES')+'</span>';
  function latest(rows,source){
    const m=new Map();
    rows.filter(r=>!source||r.source===source).forEach(r=>{const k=norm(r.gamertag);if(!k)return;const p=m.get(k);if(!p||Date.parse(r.source_updated_at||0)>=Date.parse(p.source_updated_at||0))m.set(k,r)});
    return m;
  }
  function zoneRows(raw={}){
    return Array.from({length:16},(_,i)=>({id:i+1,shots:Number(raw['ShotsLocationOnIce'+(i+1)]||0),goals:Number(raw['GoalsLocationOnIce'+(i+1)]||0)}));
  }
  function zoneRowsFromSnapshot(s){
    return Array.from({length:16},(_,i)=>({id:i+1,shots:Number(s?.zone_shots?.[String(i+1)]||0),goals:Number(s?.zone_goals?.[String(i+1)]||0)}));
  }
  function netRows(raw={}){
    return Array.from({length:5},(_,i)=>({id:i+1,shots:Number(raw['ShotsLocationOnNet'+(i+1)]||0),goals:Number(raw['GoalsLocationOnNet'+(i+1)]||0)}));
  }
  const eaGp=p=>num(p.ea?.games_played??p.ea?.raw_stats?.skgp??p.ea?.raw_stats?.gamesplayed)||null;
  function sumNet(list){
    const by=new Map();
    list.forEach(p=>netRows(p.ea?.raw_stats||{}).forEach(z=>{const x=by.get(z.id)||{id:z.id,shots:0,goals:0};x.shots+=z.shots;x.goals+=z.goals;by.set(z.id,x)}));
    return [...by.values()];
  }
  const slaState={base:'shots',mode:'totals'};
  const POSNAME={center:'C',leftWing:'LW',rightWing:'RW',defenseMen:'D',goalie:'G'};
  // A disconnect restart stores several EA files for one official game; count the LG game once.
  const gpOf=p=>new Set((p.games||[]).map(r=>r.g.lg_game_id||r.g.source_game_id)).size;
  function sumPlayers(list){
    const by=new Map();
    list.forEach(p=>zoneRows(p.ea?.raw_stats||{}).forEach(z=>{const x=by.get(z.id)||{id:z.id,shots:0,goals:0};x.shots+=z.shots;x.goals+=z.goals;by.set(z.id,x)}));
    return [...by.values()];
  }
  function profile(rows){
    const model=window.WildmanShotZones?.sumRows(rows);if(!model)return null;
    const ranked=[...model.zones].filter(z=>z.shots>0).sort((a,b)=>b.shots-a.shots);
    const intShots=model.zones.filter(z=>inside.has(z.id)).reduce((n,z)=>n+z.shots,0);
    const intGoals=model.zones.filter(z=>inside.has(z.id)).reduce((n,z)=>n+z.goals,0);
    return {model,ranked,insideShare:model.totalShots?100*intShots/model.totalShots:0,insideGoals:intGoals};
  }
  function autoPlayerScout(p){
    if(p.position==='G'){
      const lg=p.lg||{},ea=p.ea||{};
      return [
        ['Goalie profile','LG: '+fmt(lg.goalie_save_pct,3)+' SV%, '+fmt(lg.goalie_gaa,2)+' GAA over '+fmt(lg.games_played)+' GP. EA club sample: '+fmt(ea.goalie_save_pct,3)+' SV%, '+fmt(ea.goalie_gaa,2)+' GAA.'],
        ['Evidence scope','League totals are used for LG performance. EA values are broader club totals and should be treated as supporting context, not league-only evidence.']
      ];
    }
    const rows=zoneRows(p.ea?.raw_stats||{}),pr=profile(rows),lg=p.lg||{},ea=p.ea||{},raw=ea.raw_stats||{};
    const out=[];
    if(pr?.model.totalShots){
      const a=pr.ranked[0],b=pr.ranked[1],style=pr.insideShare>=55?'interior-heavy':pr.insideShare<=40?'perimeter-heavy':'balanced';
      out.push(['Shot identity',(a? a.name+' is the primary mapped area at '+a.shotShare.toFixed(1)+'% of EA zone shots':'No dominant area')+(b?' with '+b.name+' second at '+b.shotShare.toFixed(1)+'%. ':'. ')+'Overall profile is '+style+' ('+pr.insideShare.toFixed(1)+'% from interior/slot zones).']);
      const fin=[...pr.model.zones].filter(z=>z.goals>0).sort((x,y)=>y.goals-x.goals)[0];
      if(fin)out.push(['Finishing area',fin.name+' has the most mapped goals ('+fin.goals+') with '+fin.efficiency.toFixed(1)+'% conversion in the current EA club sample.']);
    }
    const gp=Number(lg.games_played||0),g=Number(lg.goals||0),a=Number(lg.assists||0),pts=g+a;
    if(gp)out.push(['LG production',pts+' points in '+gp+' LG games ('+(pts/gp).toFixed(2)+' P/GP). '+(a>g*1.4?'The season production leans playmaking/distribution.':g>a?'The season production leans finishing/scoring.':'Goals and assists are relatively balanced.')]);
    const gl=gameLogSummary(p);
    if(gl&&gl.gp)out.push(['Verified game logs',gl.gp+' LG-verified EA game'+(gl.gp===1?'':'s')+': '+(gl.shots/gl.gp).toFixed(1)+' shots on net and '+(gl.att/gl.gp).toFixed(1)+' attempts a game'+(gl.shPct!=null?', '+gl.shPct.toFixed(1)+'% shooting':'')+', '+gl.ta+' takeaways and '+gl.ga+' giveaways. These are official league games only.']);
    const ga=Number(ea.giveaways||raw.skgiveaways||0),ta=Number(ea.takeaways||raw.sktakeaways||0),pass=ea.passing_pct??raw.skpasspct;
    if(ga||ta||pass!=null)out.push(['Puck-management context','EA club totals: '+fmt(pass,1)+'% passing, '+ta+' takeaways, '+ga+' giveaways. Use this as tendency context, not LG-only performance.']);
    out.push(['Defensive instruction',pr?.ranked?.[0]?'Protect '+pr.ranked[0].name+' first, then force attempts toward lower-volume zones. Match the statistical read against VOD before treating it as a hard tactical tendency.':'No reliable zone volume is available yet; use LG production and film evidence instead.']);
    return out;
  }
  function makePlayers(){
    const lg=latest(data.stats,'lg_chl'),ea=latest(data.stats,'ea_nhl27'),hist=new Map(),roster=new Map(),scouts=new Map();
    data.history.forEach(h=>{const k=norm(h.gamertag);if(!hist.has(k))hist.set(k,[]);hist.get(k).push(h)});
    data.roster.forEach(r=>roster.set(norm(r.gamertag),r));
    data.scouts.forEach(r=>scouts.set(norm(r.gamertag),r));
    // LG-verified EA match files: this club's side only (player_stats.team), one row per player per official game.
    const logs=new Map();blazeLogs=new Map();
    [...data.eaGames].sort((a,b)=>Date.parse(b.played_at||0)-Date.parse(a.played_at||0)).forEach(g=>{
      Object.entries(g.player_stats?.team||{}).forEach(([b,x])=>{const k=norm(x?.playername);if(!k)return;if(!logs.has(k))logs.set(k,[]);logs.get(k).push({g,x,b});if(!blazeLogs.has(b))blazeLogs.set(b,[]);blazeLogs.get(b).push({g,x,b})});
    });
    // EA and LG spell the same tag differently (josh1401. / Josh_1401, papastener14 / papa-stener14): compare letters and digits only.
    const fold=v=>String(v||'').replace(/[Il|]/g,'l').toLowerCase().replace(/[^a-z0-9]/g,''),logByFold=new Map();
    logs.forEach((v,k)=>{const f=fold(k);logByFold.set(f,logByFold.has(f)?null:v)});
    const keys=new Set([...lg.keys(),...ea.keys(),...hist.keys(),...roster.keys()]);
    const known=new Map();keys.forEach(k=>{const f=fold(k);known.set(f,known.has(f)?null:k)});
    logs.forEach((v,k)=>{if(keys.has(k)||known.get(fold(k)))return;keys.add(k)});
    players=[...keys].map(k=>{
      const rr=roster.get(k),L=lg.get(k),A=ea.get(k),H=(hist.get(k)||[]).sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at));
      return {key:k,name:rr?.gamertag||L?.gamertag||A?.gamertag||H.at(-1)?.gamertag||k,position:rr?.position||L?.position||A?.position||H.at(-1)?.position||'',current:!!rr?.active,roster:rr,lg:L,ea:A,history:H,scout:scouts.get(k),games:logs.get(k)||logByFold.get(fold(k))||[]};
    }).map(p=>{
      if(p.roster||p.lg||p.ea||p.history.length||!p.games.length)return p;
      // Played in an official game file but is not on the saved roster or EA member list (guest, sub or departed player).
      const cnt={};p.games.forEach(r=>{const q=POSNAME[r.x?.position]||'';if(q)cnt[q]=(cnt[q]||0)+1});
      return {...p,name:p.games[0].x.playername||p.name,position:Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0]||'',gameFilesOnly:true};
    }).sort((a,b)=>(a.current===b.current?0:a.current?-1:1)||(POS[a.position]||9)-(POS[b.position]||9)||String(a.name).localeCompare(String(b.name)));
  }
  function renderKpis(){
    E('hsOpponent').innerHTML=esc(opponent.toUpperCase())+'<br><span>SCOUTING LAB.</span>';
    E('hsScope').textContent='Persistent Season 55 file: current roster, departed players, EA shooting-zone history, official LG games and Calgary scouting notes.';
    E('hsBack').href='hitmen-opponents.html?opponent='+encodeURIComponent(opponent);
    E('hsCurrentCount').textContent=players.filter(p=>p.current).length;
    E('hsTrackedCount').textContent=players.length;
    E('hsSnapshotCount').textContent=data.history.length;
    E('hsGameCount').textContent=data.games.length;
    E('hsEaGameCount').textContent=data.eaGames.length;
  }
  function renderTeam(){
    const current=players.filter(p=>p.current&&p.position!=='G'&&p.ea),rows=sumPlayers(current),pr=profile(rows);
    if(pr?.model.totalShots)window.WildmanShotZones.mountAnalysis(E('hsTeamHeat'),{ice:rows,net:sumNet(current),gp:null,state:{base:'shots',mode:'totals'}});else E('hsTeamHeat').innerHTML='<div class="hs-empty">No current EA zone data yet.</div>';
    const topScorers=[...players].filter(p=>p.current&&p.lg).sort((a,b)=>Number(b.lg.points||0)-Number(a.lg.points||0)).slice(0,3);
    const items=[];
    if(pr?.ranked?.length){
      items.push(['Primary shooting areas',pr.ranked.slice(0,3).map(z=>z.name+' '+z.shotShare.toFixed(1)+'%').join(' · ')]);
      items.push(['Team shot shape',pr.insideShare.toFixed(1)+'% of mapped EA zone shots come from interior/slot zones across the current skaters.']);
    }
    if(topScorers.length)items.push(['LG scoring leaders',topScorers.map(p=>p.name+' '+(p.lg.points??(Number(p.lg.goals||0)+Number(p.lg.assists||0)))+' PTS').join(' · ')]);
    items.push(['Scope control','The heat map is based on current EA club totals for the skaters on this LG roster. Official LG game files remain separate, so club games are not mislabeled as league-only evidence.']);
    E('hsTeamScout').innerHTML=items.map(x=>'<div class="hs-scout-item"><b>'+esc(x[0])+'</b><p>'+esc(x[1])+'</p></div>').join('');
  }
  function renderPlayers(){
    const q=norm(E('hsSearch').value),list=players.filter(p=>(filter==='all'||p.current)&&(!q||norm(p.name).includes(q)));
    E('hsPlayers').innerHTML=list.length?list.map(p=>{
      const pts=p.lg?.points??((p.lg?.goals!=null||p.lg?.assists!=null)?Number(p.lg?.goals||0)+Number(p.lg?.assists||0):'—');
      return '<button class="hs-player-button '+(selected?.key===p.key?'active':'')+'" data-player="'+esc(p.key)+'"><span class="pos">'+esc(p.position||'—')+'</span><span><strong>'+esc(p.name)+'</strong><small>'+(p.current?'CURRENT':p.gameFilesOnly?'GAME FILES ONLY':'HISTORICAL')+' · '+(p.games.length?gpOf(p)+' verified game'+(gpOf(p)===1?'':'s'):(p.history.length)+' shot snapshots')+'</small></span><span class="pts">'+esc(pts)+'</span></button>';
    }).join(''):'<div class="hs-empty">No matching players.</div>';
    E('hsPlayers').querySelectorAll('[data-player]').forEach(b=>b.addEventListener('click',()=>selectPlayer(b.dataset.player)));
  }
  function renderHeat(p){
    if(p.position==='G'){E('hsPlayerHeat').innerHTML='<div class="hs-empty">Goalies do not use the skater shooting-zone map.</div>';E('hsZoneBreakdown').innerHTML='';return}
    const rows=zoneRows(p.ea?.raw_stats||{}),pr=profile(rows);
    if(!pr?.model.totalShots){E('hsPlayerHeat').innerHTML='<div class="hs-empty">'+(p.games?.length?'No rink-zone map for this player. EA only publishes shot locations for club members'+(p.games.some(r=>String(r.x?.isGuest)==='1')?', and he plays for this club as a guest':' and has none stored for him')+'. His shot volume from '+gpOf(p)+' LG-verified EA game'+(gpOf(p)===1?'':'s')+' is in the game log below.':'No EA shooting-location totals stored for this player yet.')+'</div>';E('hsZoneBreakdown').innerHTML='';return}
    window.WildmanShotZones.mountAnalysis(E('hsPlayerHeat'),{ice:rows,net:netRows(p.ea?.raw_stats||{}),gp:eaGp(p),state:slaState});
    const max=Math.max(1,...pr.ranked.map(z=>z.shots));
    E('hsZoneBreakdown').innerHTML=pr.ranked.slice(0,6).map(z=>'<div class="hs-zone-row"><b>'+esc(z.name)+'</b><span>'+z.shots+' shots · '+z.goals+' goals · '+z.efficiency.toFixed(1)+'% · '+z.shotShare.toFixed(1)+'% share</span><div class="hs-zone-bar"><i style="width:'+Math.max(2,100*z.shots/max)+'%"></i></div></div>').join('');
  }
  function renderHistory(p){
    const rows=p.history,tracker=gameTracker(p);
    if(!rows.length){E('hsHistory').innerHTML=tracker||'<div class="hs-empty">No historical EA shot snapshots yet.</div>';return}
    const show=rows.slice(-10);
    E('hsHistory').innerHTML='<table class="hs-history"><thead><tr><th>Captured</th><th>EA GP</th><th>G</th><th>SOG</th><th>ATT</th><th>Δ SOG</th><th>Δ ATT</th><th>Largest new zone</th></tr></thead><tbody>'+show.map((s,i)=>{
      const globalIndex=rows.indexOf(s),prev=globalIndex>0?rows[globalIndex-1]:null;
      const ds=prev?Number(s.shots_on_net||0)-Number(prev.shots_on_net||0):null,da=prev?Number(s.shot_attempts||0)-Number(prev.shot_attempts||0):null;
      let zone='Baseline';
      if(prev){
        const cur=zoneRowsFromSnapshot(s),old=zoneRowsFromSnapshot(prev);
        const deltas=cur.map(z=>({id:z.id,d:z.shots-(old.find(o=>o.id===z.id)?.shots||0)})).sort((a,b)=>b.d-a.d);
        const best=deltas[0];if(best&&best.d>0)zone=(window.WildmanShotZones.byId[best.id]?.name||('Zone '+best.id))+' +'+best.d;else zone='No new mapped shots';
      }
      return '<tr><td>'+esc(new Date(s.captured_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</td><td>'+esc(s.games_played??'—')+'</td><td>'+esc(s.goals??'—')+'</td><td>'+esc(s.shots_on_net??'—')+'</td><td>'+esc(s.shot_attempts??'—')+'</td><td class="'+(ds>0?'delta-plus':'')+'">'+esc(ds==null?'—':(ds>=0?'+':'')+ds)+'</td><td class="'+(da>0?'delta-plus':'')+'">'+esc(da==null?'—':(da>=0?'+':'')+da)+'</td><td>'+esc(zone)+'</td></tr>'
    }).join('')+'</tbody></table>'+tracker;
  }
  function gameLogSummary(p){
    const L=p.games||[];if(!L.length)return null;
    const t=k=>L.reduce((n,r)=>n+Number(r.x?.[k]||0),0),gp=gpOf(p);
    const shots=t('skshots'),att=t('skshotattempts'),goals=t('skgoals');
    return {gp,goals,assists:t('skassists'),shots,att,hits:t('skhits'),ta:t('sktakeaways'),ga:t('skgiveaways'),pos:t('skpossession'),
      saves:t('glsaves'),gshots:t('glshots'),shPct:shots?100*goals/shots:null,onNet:att?100*shots/att:null};
  }
  function gameTracker(p){
    // Running totals, oldest official game first: one row per LG game (restart files combined).
    const by=new Map();
    [...(p.games||[])].reverse().forEach(({g,x})=>{const k=g.lg_game_id||g.source_game_id,r=by.get(k)||{g,goals:0,shots:0,att:0};
      r.goals+=Number(x.skgoals||0);r.shots+=Number(x.skshots||0);r.att+=Number(x.skshotattempts||0);by.set(k,r)});
    const list=[...by.values()];if(!list.length||p.position==='G')return'';
    let G=0,S=0,A=0;
    const body=list.map((r,i)=>{G+=r.goals;S+=r.shots;A+=r.att;const d=new Date(r.g.reconciliation?.lg_game_at||r.g.played_at);
      return '<tr><td>'+esc(d.toLocaleDateString([],{month:'short',day:'numeric'}))+'</td><td>'+(i+1)+'</td><td>'+G+'</td><td>'+S+'</td><td>'+A+'</td><td class="'+(r.shots?'delta-plus':'')+'">+'+r.shots+'</td><td class="'+(r.att?'delta-plus':'')+'">+'+r.att+'</td><td>'+esc(r.g.reconciliation?.other_team||'—')+'</td></tr>'}).reverse().join('');
    return '<div class="eyebrow hs-tracker-k">PER-GAME TRACKER · LG-VERIFIED EA FILES '+badge('lg')+'</div><div class="hs-log-wrap"><table class="hs-history hs-gamelog"><thead><tr><th>Game</th><th>GP</th><th>G</th><th>SOG</th><th>ATT</th><th>Δ SOG</th><th>Δ ATT</th><th>Vs</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  function renderGameLog(p){
    const L=p.games||[],box=E('hsGameLog');if(!box)return;
    if(!L.length){box.innerHTML='<div class="hs-empty">No LG-verified EA game files include this player yet. They appear once he plays an official game that matches an EA match file.</div>';return}
    const s=gameLogSummary(p),G=p.position==='G'||L.every(r=>r.x?.position==='goalie'),per=v=>(v/s.gp).toFixed(1);
    const head=G
      ?stat('LG GAMES',s.gp,'lg')+stat('SAVES',s.saves,'lg')+stat('SHOTS AGAINST',s.gshots,'lg')+stat('SV%',s.gshots?(s.saves/s.gshots).toFixed(3):'—','lg')
      :stat('LG GAMES',s.gp,'lg')+stat('G-A',s.goals+'-'+s.assists,'lg')+stat('SOG / GM',per(s.shots),'lg')+stat('ATT / GM',per(s.att),'lg')+stat('SH%',s.shPct==null?'—':s.shPct.toFixed(1),'lg')+stat('ON NET%',s.onNet==null?'—':s.onNet.toFixed(1),'lg')+stat('HITS / GM',per(s.hits),'lg')+stat('TA / GA',s.ta+' / '+s.ga,'lg')+stat('POSS / GM',Math.round(s.pos/s.gp)+'s','lg');
    const rows=L.slice(0,15).map(({g,x})=>{
      const rc=g.reconciliation||{},d=new Date(rc.lg_game_at||g.played_at),res=(g.result||'')+(rc.restart_parts?' (restart '+rc.restart_part+'/'+rc.restart_parts+')':'');
      const lg=g.lg_game_id?'<a href="https://www.leaguegaming.com/forums/index.php?leaguegaming/league&amp;action=league&amp;page=game&amp;gameid='+encodeURIComponent(g.lg_game_id)+'" target="_blank" rel="noopener noreferrer">'+esc(d.toLocaleDateString([],{month:'short',day:'numeric'}))+'</a>':esc(d.toLocaleDateString());
      return G
        ?'<tr><td>'+lg+'</td><td>'+esc(rc.other_team||'—')+'</td><td>'+esc(res)+'</td><td>'+esc(x.glsaves??'—')+'</td><td>'+esc(x.glshots??'—')+'</td><td>'+esc(x.glsavepct??'—')+'</td><td>'+esc(x.glga??'—')+'</td></tr>'
        :'<tr><td>'+lg+'</td><td>'+esc(rc.other_team||'—')+'</td><td>'+esc(res)+'</td><td>'+esc(POSNAME[x.position]||x.position||'—')+'</td><td>'+esc(x.skgoals??0)+'</td><td>'+esc(x.skassists??0)+'</td><td>'+esc(x.skshots??0)+'</td><td>'+esc(x.skshotattempts??0)+'</td><td>'+esc(x.skhits??0)+'</td><td>'+esc(x.sktakeaways??0)+'</td><td>'+esc(x.skgiveaways??0)+'</td><td>'+esc(x.skpasspct??'—')+'</td></tr>';
    }).join('');
    box.innerHTML='<div class="hs-stat-grid hs-log-kpis">'+head+'</div><div class="hs-log-wrap"><table class="hs-history hs-gamelog"><thead><tr>'+(G?'<th>Game</th><th>Vs</th><th>Result</th><th>SV</th><th>SA</th><th>SV%</th><th>GA</th>':'<th>Game</th><th>Vs</th><th>Result</th><th>Pos</th><th>G</th><th>A</th><th>SOG</th><th>ATT</th><th>Hits</th><th>TA</th><th>GA</th><th>Pass%</th>')+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+(L.length>15?'<p class="hs-log-note">Showing the latest 15 of '+L.length+' EA game files.</p>':'');
  }
  function reportMentions(p){
    const key=String(p.name||'').toLowerCase(),out=[];
    data.reports.forEach(r=>{
      const text=String(r.report||'');
      text.split(/\n{2,}|\n/).forEach(line=>{if(line.toLowerCase().includes(key)&&line.trim().length>8)out.push({date:r.created_at,text:line.trim()})});
      const scout=r.evidence_summary?.line_scout||{};
      Object.values(scout).forEach(v=>{if(typeof v==='string'&&v.toLowerCase().includes(key))out.push({date:r.created_at,text:v})});
    });
    return out.slice(0,4);
  }
  function fillScout(p){
    const s=p.scout||{};
    E('hsScoutSummary').value=s.summary||'';E('hsScoutStrengths').value=s.strengths||'';E('hsScoutConcerns').value=s.concerns||'';
    E('hsScoutTendencies').value=s.tendencies||'';E('hsScoutPlan').value=s.matchup_plan||'';E('hsScoutConfidence').value=s.confidence||'';
    const writable=canWrite();['hsScoutSummary','hsScoutStrengths','hsScoutConcerns','hsScoutTendencies','hsScoutPlan','hsScoutConfidence','hsSaveScout'].forEach(id=>E(id).disabled=!writable);
    E('hsSaveStatus').textContent=writable?'':'View only';
  }
  /* ---------- ChelStats: EA account ID links LG names to EA match files; career profile for players with no files ---------- */
  const ckey=v=>String(v||'').replace(/[Il|]/g,'l').toLowerCase().replace(/[^a-z0-9]/g,'');
  function linkByBlaze(p,prof){
    const id=prof?.blazeId,L=id&&blazeLogs.get(String(id));if(!L||!L.length)return false;
    const before=gpOf(p);p.games=L;p.eaName=L[0].x?.playername||null;p.blazeId=String(id);
    // The same person may already be listed under his EA name as a game-files-only player.
    const dup=players.findIndex(o=>o!==p&&o.gameFilesOnly&&o.games.some(r=>String(r.b)===String(id)));if(dup>=0)players.splice(dup,1);
    return gpOf(p)!==before||dup>=0;
  }
  async function chelLookup(p,quiet){
    if(p.gameFilesOnly&&!p.roster)return; // EA-name-only players are already keyed by their EA files
    const name=p.roster?.gamertag||p.name,k=ckey(name);if(!k)return;
    let c=chel.get(k);
    if(!c){
      c={state:'loading'};chel.set(k,c);
      try{const r=await fetch('/api/chelstats-player?profile=1&username='+encodeURIComponent(name),{signal:AbortSignal.timeout(20000)});
        if(r.ok){const b=await r.json();c.state='ok';c.profile=b.profile;c.scope=b.scope}else c.state='none'}
      catch(_){c.state='none'}
    }else if(c.state==='loading')return;
    const changed=c.state==='ok'&&linkByBlaze(p,c.profile);
    if(changed)renderPlayers();
    if(!quiet&&selected===p){if(changed){renderHeat(p);renderGameLog(p);renderHistory(p);E('hsPlayerMeta').textContent=metaLine(p)}renderChel(p)}
  }
  async function prefetchChel(){
    // Current players with no verified game files first: these are the ones a name match missed.
    const queue=players.filter(p=>p.current&&!p.games.length);let i=0;
    const worker=async()=>{while(i<queue.length){const p=queue[i++];await chelLookup(p,selected!==p);}};
    await Promise.all([worker(),worker(),worker()]);
  }
  function renderChel(p){
    const box=E('hsChelstats');if(!box)return;
    const c=chel.get(ckey(p.roster?.gamertag||p.name));
    if(p.gameFilesOnly&&!p.roster){box.innerHTML='';return}
    if(!c||c.state==='loading'){box.innerHTML='<div class="hs-empty">Looking up '+esc(p.name)+' on ChelStats…</div>';return}
    if(c.state!=='ok'){box.innerHTML='<div class="hs-empty">ChelStats has no EA account under “'+esc(p.roster?.gamertag||p.name)+'”. His EA gamertag is probably different from his LG name.</div>';return}
    const f=c.profile,fx=(v,d=1)=>v==null?'—':Number(v).toFixed(d),G=p.position==='G';
    const link=p.blazeId?'Linked to '+gpOf(p)+' LG-verified EA game'+(gpOf(p)===1?'':'s')+(p.eaName&&ckey(p.eaName)!==ckey(p.name)?' as “'+esc(p.eaName)+'”':'')+'.':'No LG-verified EA game files under this EA account yet.';
    const stats=G?stat('EA GP',f.positionGames?.G??f.gamesPlayed,'pub')+stat('SV%',fx(f.savePct,3),'pub')+stat('GAA',fx(f.gaa,2),'pub')+(f.goalieRatings?stat('RATING',f.goalieRatings.overall,'pub'):'')
      :stat('EA GP',f.gamesPlayed,'pub')+stat('SHOTS / GM',fx(f.shotsPerGame,2),'pub')+stat('SH%',fx(f.shootingPct),'pub')+stat('ON NET%',fx(f.shotsOnNetPct),'pub')+stat('G / GM',fx(f.goalsPerGame,2),'pub')+stat('A / GM',fx(f.assistsPerGame,2),'pub')+stat('PASS%',fx(f.passPct),'pub')+stat('HITS / GM',fx(f.hitsPerGame,2),'pub')+stat('TA / GA',fx(f.takeawaysPerGame,2)+' / '+fx(f.giveawaysPerGame,2),'pub')+(f.faceoffPct?stat('FO%',fx(f.faceoffPct),'pub'):'')+(f.ratings?stat('RATING',f.ratings.overall+' ('+f.ratings.offense+' OFF / '+f.ratings.defense+' DEF)','pub'):'');
    const pos=f.positionGames?Object.entries(f.positionGames).filter(([k,v])=>v&&k!=='G').map(([k,v])=>k+' '+v).join(' · '):'';
    box.innerHTML='<p class="hs-chel-id"><b>EA gamertag:</b> '+esc(f.username)+(f.chelName?' · in-game name '+esc(f.chelName):'')+(f.playstyle&&!G?' · '+esc(f.playstyle):'')+(pos?' · games by position: '+esc(pos):'')+'<br>'+link+'</p><div class="hs-stat-grid hs-log-kpis">'+stats+'</div><p class="hs-log-note">Career totals across all EA modes'+(f.mainMode?' (mostly '+esc(f.mainMode)+')':'')+', not LG-only. Use them for tendencies, not league performance.</p>';
  }
  const metaLine=p=>(p.roster?.management_role||p.roster?.roster_role||'Tracked player')+(p.roster?.salary!=null?' · $'+Number(p.roster.salary).toLocaleString():'')+' · '+(p.games.length?gpOf(p)+' LG-verified EA games':p.history.length+' saved EA shot snapshots');
  function selectPlayer(key){
    selected=players.find(p=>p.key===key);if(!selected)return;
    E('hsEmpty').hidden=true;E('hsPlayerDetail').hidden=false;
    const p=selected,lg=p.lg||{},ea=p.ea||{},raw=ea.raw_stats||{};
    E('hsPlayerStatus').textContent=p.current?'CURRENT ROSTER':p.gameFilesOnly?'PLAYED IN VERIFIED GAMES':'HISTORICAL PLAYER';
    E('hsPlayerName').textContent=p.name;E('hsPlayerPos').textContent=p.position||'—';
    E('hsPlayerMeta').textContent=metaLine(p);
    const lgPts=lg.points??((lg.goals!=null||lg.assists!=null)?Number(lg.goals||0)+Number(lg.assists||0):null);
    E('hsPlayerStats').innerHTML=stat('LG GP',lg.games_played,'lg')+stat('LG G',lg.goals,'lg')+stat('LG A',lg.assists,'lg')+stat('LG PTS',lgPts,'lg')+
      (p.position==='G'?stat('LG SV%',fmt(lg.goalie_save_pct,3),'lg')+stat('LG GAA',fmt(lg.goalie_gaa,2),'lg')+stat('EA SV%',fmt(ea.goalie_save_pct,3),'club'):
      stat('EA SHOTS',ea.shots,'club')+stat('EA ATT',raw.skshotattempts??'—','club')+stat('PASS%',fmt(ea.passing_pct??raw.skpasspct,1),'club'))+
      stat('HITS',lg.hits,'lg')+stat('TA',lg.takeaways,'lg')+stat('GA',lg.giveaways,'lg');
    renderHeat(p);renderGameLog(p);renderHistory(p);renderChel(p);chelLookup(p);
    const SRCOF={'Shot identity':'club','Finishing area':'club','Puck-management context':'club','LG production':'lg','Verified game logs':'lg','Goalie profile':'club','Evidence scope':'club','Defensive instruction':'club'};
    E('hsAutoScout').innerHTML=autoPlayerScout(p).map(x=>'<div class="hs-scout-item"><b>'+esc(x[0])+' '+badge(SRCOF[x[0]]||'club')+'</b><p>'+esc(x[1])+'</p></div>').join('');
    const mentions=reportMentions(p);E('hsReportMentions').innerHTML=teamClipsBtn()+(mentions.length?'<div class="eyebrow">EXISTING REPORT MENTIONS</div>'+mentions.map(m=>'<div class="hs-mention"><b>'+esc(new Date(m.date).toLocaleDateString())+'</b> · '+clipHtml(esc(m.text))+'</div>').join(''):'');
    fillScout(p);renderPlayers();
  }
  async function saveScout(){
    if(!selected||!canWrite())return;
    const b=E('hsSaveScout');b.disabled=true;E('hsSaveStatus').textContent='Saving…';
    const row={team_id:TEAM,season:SEASON,opponent_name:opponent,gamertag:selected.name,summary:E('hsScoutSummary').value.trim(),strengths:E('hsScoutStrengths').value.trim(),concerns:E('hsScoutConcerns').value.trim(),tendencies:E('hsScoutTendencies').value.trim(),matchup_plan:E('hsScoutPlan').value.trim(),confidence:E('hsScoutConfidence').value?Number(E('hsScoutConfidence').value):null,updated_by:ST().user?.id,updated_at:new Date().toISOString()};
    try{
      let res;
      if(selected.scout?.id)res=await DB().from('hitmen_opponent_player_scout_reports').update(row).eq('id',selected.scout.id).select().single();
      else res=await DB().from('hitmen_opponent_player_scout_reports').insert({...row,created_by:ST().user?.id}).select().single();
      if(res.error)throw res.error;selected.scout=res.data;E('hsSaveStatus').textContent='Saved '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    }catch(e){E('hsSaveStatus').textContent='Save failed: '+(e.message||e)}
    finally{b.disabled=!canWrite()}
  }
  async function load(){
    if(!opponent||!DB()||!ST().user)return;
    try{
      const q=await Promise.all([
        DB().from('hitmen_opponent_roster_players').select('*').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent),
        DB().from('hitmen_opponent_player_stats').select('*').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent),
        DB().from('hitmen_opponent_player_shot_history').select('*').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent).order('captured_at',{ascending:true}),
        DB().from('hitmen_opponent_lg_games').select('*').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent).order('played_at',{ascending:true}),
        DB().from('hitmen_opponent_ea_games').select('source_game_id,lg_game_id,played_at,verified_official,result,goals_for,goals_against,player_stats,reconciliation:raw_payload->reconciliation').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent).eq('verified_official',true),
        DB().from('hitmen_opponent_pregame_reports').select('id,created_at,report,evidence_summary').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent).order('created_at',{ascending:false}).limit(12),
        DB().from('hitmen_opponent_player_scout_reports').select('*').eq('team_id',TEAM).eq('season',SEASON).eq('opponent_name',opponent)
      ]);
      const er=q.find(x=>x.error);if(er)throw er.error;
      [data.roster,data.stats,data.history,data.games,data.eaGames,data.reports,data.scouts]=q.map(x=>x.data||[]);
      // Players see the same reports the War Room shows them: approved only. Drafts stay with management and scouts.
      const staff=String(ST().profile?.role||'').toLowerCase()==='admin'||(ST().memberships||[]).some(m=>m.team_id===TEAM&&m.active!==false&&['owner','gm','agm','scout'].includes(String(m.role||'').toLowerCase()));
      if(!staff)data.reports=data.reports.filter(r=>r.evidence_summary?.approved===true);
      makePlayers();renderKpis();renderTeam();renderPlayers();
      // ?player=<gamertag> opens that player directly (links from pregame reports and Tonight's Six).
      // LG shows capital I and lower-case l the same, so fall back to a folded match when it is unique.
      const want=qs.get('player')||'',fold=v=>String(v||'').replace(/[Il|]/g,'l').toLowerCase().replace(/[^a-z0-9]/g,'');
      const asked=want?(players.find(p=>p.key===norm(want))||(f=>f.length===1?f[0]:null)(players.filter(p=>fold(p.name)===fold(want)))):null;
      const first=asked||players.find(p=>p.current&&p.position!=='G')||players.find(p=>p.current)||players[0];if(first)selectPlayer(first.key);
      if(asked)setTimeout(()=>E('hsPlayerDetail')?.scrollIntoView({behavior:'smooth',block:'start'}),200);
      prefetchChel();
    }catch(e){console.error(e);E('hsScope').textContent='Could not load scouting data: '+(e.message||e)}
  }
  function bind(){
    E('hsSearch')?.addEventListener('input',renderPlayers);
    document.querySelectorAll('[data-hs-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.hsFilter;document.querySelectorAll('[data-hs-filter]').forEach(x=>x.classList.toggle('active',x===b));renderPlayers()}));
    document.querySelectorAll('[data-hs-metric]').forEach(b=>b.addEventListener('click',()=>{metric=b.dataset.hsMetric;document.querySelectorAll('[data-hs-metric]').forEach(x=>x.classList.toggle('active',x===b));if(selected)renderHeat(selected)}));
    E('hsSaveScout')?.addEventListener('click',saveScout);
    if(!opponent)E('hsScope').textContent='Open this page from an opponent file so the team can be identified.';
  }
  window.addEventListener('vvhl-auth-change',()=>load());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();setTimeout(load,150)});else{bind();setTimeout(load,150)}
})();