/* Public LGCHL season leaderboard. Existing publishable-key views only; no database writes. */
(()=>{
 'use strict';
 const D=window.WMDesk;if(!D)return;
 D.menu();
 const {$,esc,read}=D,CGY=412,PAGE_SIZE=25;
 const metrics={points:'Points',goals:'Goals',assists:'Assists',shots:'Shots',hits:'Hits',blocked_shots:'Blocked shots',takeaways:'Takeaways',save_pct:'Save percentage',gaa:'Goals-against average'};
 const params=new URLSearchParams(location.search);
 const initialMetric=Object.hasOwn(metrics,params.get('metric'))?params.get('metric'):'points';
 const state={metric:initialMetric,rows:[],query:(params.get('q')||'').slice(0,100),page:1,request:0,loading:false,failed:false,capture:null};
 const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
 const format=v=>numeric(v)?Number(v).toLocaleString('en-US'):'—';
 const goalie=m=>m==='save_pct'||m==='gaa';
 const stamp=v=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v))+' ET':'import time unavailable';
 const rate=(v,d)=>numeric(v)?Number(v).toFixed(d):'—';
 const normalize=v=>String(v||'').normalize('NFKC').toLocaleLowerCase();
 function updateUrl(){
  const u=new URL(location.href);u.searchParams.set('metric',state.metric);
  if(state.query.trim())u.searchParams.set('q',state.query.trim());else u.searchParams.delete('q');
  u.searchParams.delete('search');history.replaceState(null,'',u);
 }
 function columns(metric){
  const c=[['rank','Rank'],['player','Player'],['gp','GP']];
  if(goalie(metric))return [...c,['save_pct','SV%'],['gaa','GAA']];
  const sk=[['goals','G'],['assists','A'],['points','PTS']];
  return [...c,...sk,...(['points','goals','assists'].includes(metric)?[]:[[metric,metrics[metric]]])];
 }
 function cell(p,key,metric){
  if(key==='player')return '<button type="button" class="lg-player-open" data-lg-profile="'+encodeURIComponent(JSON.stringify({p,rank:p.rank,metric}))+'">'+esc(p.gamertag)+'</button><small>'+esc(p.position||'Position unavailable')+' · '+esc(p.team_name||'Team unavailable')+'</small>';
  if(key==='rank')return p.rank==null?'—':String(p.rank);
  if(key==='save_pct')return numeric(p[key])?(Number(p[key])*100).toFixed(1)+'%':'—';
  if(key==='gaa')return rate(p[key],2);
  return esc(format(p[key]));
 }
 function table(rows,metric,label){
  const cols=columns(metric);
  return '<table aria-label="'+esc(label)+'"><thead><tr>'+cols.map(([key,title])=>'<th scope="col" class="lg-player-'+key+'"'+(key===metric?' aria-sort="'+(metric==='gaa'?'ascending':'descending')+'"':'')+'>'+esc(title)+'</th>').join('')+'</tr></thead><tbody>'+
   rows.map(p=>'<tr'+(Number(p.lg_team_id)===CGY?' class="is-calgary"':'')+'>'+cols.map(([key,title])=>'<'+(key==='rank'?'th scope="row"':'td')+' data-label="'+esc(title)+'" class="lg-player-'+key+(key===metric?' lg-player-selected':'')+'">'+cell(p,key,metric)+'</'+(key==='rank'?'th':'td')+'>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 function render(){
  const filtered=state.rows.filter(p=>!state.query.trim()||normalize(p.gamertag).includes(normalize(state.query.trim()))||normalize(p.team_name).includes(normalize(state.query.trim())));
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));state.page=Math.min(state.page,pages);
  const start=(state.page-1)*PAGE_SIZE,shown=filtered.slice(start,start+PAGE_SIZE);
  $('lgLeaders').innerHTML=shown.length?table(shown,state.metric,metrics[state.metric]+' league leaderboard'):'<p class="lg-player-empty">'+(state.failed?'Statistics are unavailable. Use Refresh to retry.':state.query.trim()?(state.capture?'No matches in the available verified capture.':'No player or team matches. Try another metric or clear the search.'):'No qualifying imported players for this metric.')+'</p>';
  $('lgLeaders').setAttribute('aria-busy',String(state.loading));
  $('lgPlayerStatus').textContent=state.loading?'Loading '+metrics[state.metric].toLowerCase()+' leaders…':state.failed?'Statistics are unavailable.':filtered.length?'Showing '+(start+1)+'–'+(start+shown.length)+' of '+filtered.length+(state.query.trim()?' matching players':' players')+' · '+metrics[state.metric]+(goalie(state.metric)?' · goalies with 8+ GP':' · skaters'):'No qualifying results.';
  $('lgPrevPage').disabled=state.loading||state.page<=1;
  $('lgNextPage').disabled=state.loading||state.page>=pages;
  $('lgPageStatus').textContent='Page '+state.page+' of '+pages;
  $('lgClearSearch').hidden=!state.query;
  const calgary=state.rows.filter(p=>Number(p.lg_team_id)===CGY);
  $('lgHitmen').innerHTML=state.loading?'<p>Loading Calgary statistics…</p>':state.failed?'<p>Calgary statistics are unavailable.</p>':calgary.length?table(calgary,state.metric,'Calgary players on the league board'):'<p>No Calgary players in the loaded '+(goalie(state.metric)?'goalie':'skater')+' records.</p>';
 }
 async function players(){
  const token=++state.request,metric=$('lgMetric').value;
  state.metric=metric;state.page=1;state.rows=[];state.loading=true;state.failed=false;updateUrl();render();$('lgReload').disabled=true;
  // Load every public player record, not just the top 250 for one statistic.
  // PostgREST caps responses at 1,000 rows, so paginate deterministically.
  const select='gamertag,position,player_kind,lg_team_id,team_name,gp,points,goals,assists,shots,hits,blocked_shots,takeaways,save_pct,gaa,fetched_at,lg_user_id';
  const kind=goalie(metric)?'goalie':'skater';
  async function allPlayers(){
   const all=[],batchSize=1000;
   for(let offset=0;offset<10000;offset+=batchSize){
    const query={select,player_kind:'eq.'+kind,order:'lg_user_id.asc,gp.desc,fetched_at.desc',limit:String(batchSize),offset:String(offset)};
    let batch;
    try{batch=await read('wm_lgchl_s55_player_leaders',query);}
    catch(e){if(offset!==0)throw e;batch=await read('wm_lgchl_s55_player_leaders',{...query,select:select.replace(',lg_user_id',''),order:'gamertag.asc,gp.desc,fetched_at.desc'});}
    all.push(...batch);
    if(batch.length<batchSize)return all;
   }
   throw new Error('Player pagination exceeded safe limit');
  }
  try{
   const rows=await allPlayers();if(token!==state.request)return;
   // Same LG ID can have multiple rows. Keep the most complete, newest row per role.
   const unique=new Map();
   for(const p of rows){
    const id=p.lg_user_id!=null?'id:'+p.lg_user_id:'tag:'+String(p.gamertag||'').toLowerCase();
    const previous=unique.get(id);
    if(!previous||Number(p.gp||0)>Number(previous.gp||0)||
       (Number(p.gp||0)===Number(previous.gp||0)&&String(p.fetched_at||'')>String(previous.fetched_at||'')))unique.set(id,p);
   }
   const sorted=[...unique.values()].sort((a,b)=>{
    const av=numeric(a[metric])?Number(a[metric]):null,bv=numeric(b[metric])?Number(b[metric]):null;
    if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;
    return (av===null?0:(av-bv)*(metric==='gaa'?1:-1))||Number(b.gp||0)-Number(a.gp||0)||String(a.gamertag).localeCompare(String(b.gamertag));
   });
   let rank=0,previous=null;
   state.rows=sorted.map((p,i)=>{const value=numeric(p[metric])?Number(p[metric]):null;if(value!==null&&(i===0||value!==previous))rank=i+1;previous=value;return {...p,rank:value===null?null:rank};});
   const times=state.rows.map(p=>p.fetched_at).filter(Boolean).sort();
   $('lgLastUpdated').textContent='LGCHL Season 55 regular season · '+metrics[metric]+' · '+state.rows.length+' players loaded (all available '+kind+' records).';
   $('lgPlayerSource').textContent='';
   window.WMLgPlayerBadges?.load(state.rows,read).then(()=>{if(token===state.request)window.WMLgPlayerBadges?.refresh($('lgPlayerBoard'));});
  }catch{
   if(token!==state.request)return;state.failed=true;
   $('lgLastUpdated').textContent='Player statistics are unavailable.';
   $('lgPlayerSource').textContent='';
  }finally{
   if(token===state.request){state.loading=false;$('lgReload').disabled=false;render();}
  }
 }
 function powerScore(s){
  const gp=Math.max(1,Number(s.gp||1)),pts=Number(s.pts||0),gf=Number(s.gf||0),ga=Number(s.ga||0);
  return 100*(.70*Math.min(1,pts/(2*gp))+.20*Math.max(0,Math.min(1,((gf-ga)/gp+3)/6))+.10*Math.max(0,Math.min(1,(gf/gp)/6)));
 }
 async function power(){
  try{
   const rows=await read('lgchl_standings_current',{select:'lg_team_id,name,gp,w,l,otl,pts,gf,ga,standings_at'});
   const ranked=rows.filter(p=>Number(p.gp)>=5&&['pts','gf','ga'].every(k=>numeric(p[k]))).map(p=>({...p,score:powerScore(p)})).sort((a,b)=>b.score-a.score||Number(b.pts)-Number(a.pts)).map((p,i)=>({...p,rank:i+1}));
   const shown=ranked.slice(0,20),calgary=ranked.find(p=>Number(p.lg_team_id)===CGY);if(calgary&&!shown.includes(calgary))shown.push(calgary);
   $('lgPower').innerHTML=ranked.length?'<table><thead><tr>'+['Rank','Team','Record','Points','GF–GA','Index'].map(t=>'<th scope="col">'+esc(t)+'</th>').join('')+'</tr></thead><tbody>'+shown.map(p=>'<tr'+(Number(p.lg_team_id)===CGY?' class="is-calgary"':'')+'><td>'+p.rank+'</td><td><b>'+esc(p.name)+'</b></td><td>'+[p.w,p.l,p.otl].map(format).join('-')+'</td><td>'+format(p.pts)+'</td><td>'+format(p.gf)+'–'+format(p.ga)+'</td><td><b>'+p.score.toFixed(1)+'</b><small>Imported '+esc(stamp(p.standings_at))+'</small></td></tr>').join('')+'</tbody></table>':'<p>No qualifying standings available.</p>';
  }catch{$('lgPower').textContent='Standings are unavailable. Refresh to retry.';}
 }
 $('lgMetric').value=initialMetric;$('lgPlayerSearch').value=state.query;
 $('lgMetric').addEventListener('change',players);
 $('lgPlayerSearch').addEventListener('input',()=>{state.query=$('lgPlayerSearch').value;state.page=1;updateUrl();render();});
 $('lgClearSearch').addEventListener('click',()=>{$('lgPlayerSearch').value='';state.query='';state.page=1;updateUrl();render();$('lgPlayerSearch').focus();});
 $('lgPrevPage').addEventListener('click',()=>{state.page--;render();$('lgPlayerStatus').scrollIntoView({block:'nearest'});});
 $('lgNextPage').addEventListener('click',()=>{state.page++;render();$('lgPlayerStatus').scrollIntoView({block:'nearest'});});
 $('lgReload').addEventListener('click',()=>{players();power();});
 if(window.WMLgPlayerBadges)$('lgBadgeLegend').innerHTML=window.WMLgPlayerBadges.legend();
 players();power();
 if(params.get('search')==='1')$('lgPlayerSearch').focus();
})();
