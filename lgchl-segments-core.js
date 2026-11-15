/* EliteChel Playoff Segments | shared, pure, evidence-preserving bracket model.
   Source: /api/lgchl-playoffs, with an explicitly stale-marked snapshot fallback.
   No client-side editorial writes or automatic advancement from scheduled games. */
(function(global,factory){
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(global)global.ECMPlayoffSegments=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const validId=n=>Number.isSafeInteger(Number(n))&&Number(n)>0?Number(n):null;
 const num=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n):null;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const roundTitles={R1:'Round One',R2:'Round Two',R3:'Conference Final',LF:'League Final',SF:'Memorial Cup Semifinal',F:'Memorial Cup Final'};
 const isFinal=g=>!!(validId(g?.id)&&g.status==='final'&&validId(g.away)&&validId(g.home)&&num(g.away_score)!==null&&num(g.home_score)!==null&&num(g.away_score)!==num(g.home_score));
 function finalGames(slot){
  const seen=new Set();return(slot?.games||[]).filter(g=>{if(!isFinal(g)||seen.has(Number(g.id)))return false;seen.add(Number(g.id));return true}).sort((a,b)=>Date.parse(a.at||0)-Date.parse(b.at||0));
 }
 function allSlots(data){
  const rows=[];
  const push=(slot,league,conference,stage,order,sourceKey)=>{if(!slot)return;rows.push({ ...slot,league,conference,stage,order,key:validId(slot.id)?String(slot.id):sourceKey,roundTitle:roundTitles[stage]||slot.title||'Playoffs' });};
  for(const l of data?.leagues||[]){
   for(const c of l.conferences||[])for(const r of c.rounds||[])for(const [i,slot] of (r.slots||[]).entries())push(slot,l.name,c.name,r.label,Number(String(r.label).replace(/\D/g,''))||1,l.name+'-'+c.name+'-'+r.label+'-'+i);
   push(l.final,l.name,'League Final','LF',4,l.name+'-league-final');
  }
  push(data?.championship?.semi,'CUP','Memorial Cup','SF',5,'cup-semifinal');
  push(data?.championship?.final,'CUP','Memorial Cup','F',6,'cup-final');
  return rows;
 }
 function slotTeams(slot){return(slot?.sides||[]).map(x=>validId(x.team_id)).filter(Boolean);}
 function seriesFor(data,teamId){const id=validId(teamId);return allSlots(data).filter(x=>slotTeams(x).includes(id)).sort((a,b)=>a.order-b.order);}
 function scoreFor(slot,teamId){
  const s=slot?.score,ids=slotTeams(slot),i=ids.indexOf(Number(teamId));
  if(!Array.isArray(s)||s.length!==2||ids.length!==2||i<0||s.some(x=>num(x)===null||num(x)<0))return null;
  return {for:Number(s[i]),against:Number(s[1-i]),needed:num(slot.wins_needed)||Math.floor((num(slot.best_of)||7)/2)+1};
 }
 function verifiedWinner(slot){
  const id=validId(slot?.winner_id);
  if(!slot?.clinched||!id||!slotTeams(slot).includes(id))return null;
  if(slot.kind==='bye')return id;
  const score=scoreFor(slot,id);
  return score&&score.for>=score.needed&&score.for>score.against?id:null;
 }
 function teamState(data,teamId){
  const id=validId(teamId),team=data?.teams?.[id];if(!id||!team)return {status:'UNKNOWN',reason:'Not in the confirmed playoff field'};
  const slots=seriesFor(data,id),gameSeries=slots.filter(s=>s.kind==='series'&&slotTeams(s).length===2);
  const failed=slots.find(s=>verifiedWinner(s)&&verifiedWinner(s)!==id);
  if(failed)return{status:'ELIMINATED',reason:'Eliminated in '+failed.roundTitle,slot:failed};
  const cup=data?.championship?.final;
  if(verifiedWinner(cup)===id)return{status:'CHAMPION',reason:'Verified Memorial Cup champion',slot:cup};
  const active=gameSeries.filter(s=>!verifiedWinner(s)).at(-1);
  if(active){
    const score=scoreFor(active,id);
    if(score&&score.against===score.needed-1)return{status:'ON THE BRINK',reason:'One loss from elimination',slot:active};
    return{status:'ALIVE',reason:'Competing in '+active.roundTitle,slot:active};
  }
  const advanced=slots.filter(s=>verifiedWinner(s)===id).at(-1);
  if(advanced)return{status:'ADVANCING',reason:advanced.kind==='bye'?'Advanced by a confirmed bye':'Won '+advanced.roundTitle,slot:advanced};
  return{status:'ALIVE',reason:'Playoff field confirmed; future opponent pending',slot:null};
 }
 function recentForm(slot,teamId){
  const games=finalGames(slot),id=validId(teamId);
  const rec=games.map(g=>({id:Number(g.id),at:g.at||null,win:validId(g.winner)|| (Number(g.away_score)>Number(g.home_score)?Number(g.away):Number(g.home)),gf:Number(id===Number(g.away)?g.away_score:g.home_score),ga:Number(id===Number(g.away)?g.home_score:g.away_score),url:g.url||null}));
  const mine=rec.filter(x=>x.win===id||x.win!==id);
  let streak=0,prev=null;for(let i=mine.length-1;i>=0;i--){const result=mine[i].win===id?'W':'L';if(prev&&result!==prev)break;prev=result;streak++;}
  return {games:mine,streak:prev&&streak?prev+streak:null,streakWins:prev==='W'?streak:0,streakLosses:prev==='L'?streak:0};
 }
 function pressure(data,teamId,editorial){
  const st=teamState(data,teamId);if(st.status==='ELIMINATED'||st.status==='CHAMPION')return {...st,label:null,active:false};
  const slot=st.slot;
  if(!slot||slot.kind!=='series'||slotTeams(slot).length!==2)return {...st,label:'AWAITING FIRST PUCK',reason:'Current series or opponent not confirmed',active:true};
  const score=scoreFor(slot,teamId),form=recentForm(slot,teamId);
  if(!score)return {...st,label:'AWAITING VERIFIED SCORE',active:true};
  let label='IN THE FIGHT',reason='Series level; the next game can change everything.';
  if(score.against===score.needed-1){label='ON THE BRINK';reason='Exactly one verified series loss from elimination.';}
  else if(score.for>=score.against+2||form.streakWins>=2){label='RED HOT';reason='Leading this series or riding a verified playoff winning streak.';}
  else if(score.against>=score.for+2||form.streakLosses>=2){label='ICE COLD';reason='Facing a multi-game series deficit or verified losing streak.';}
  else if(score.against>score.for){label='FEELING THE HEAT';reason='Trailing the verified series.';}
  if(editorial?.published&&editorial?.label&&['RED HOT','FEELING THE HEAT','ON THE BRINK','ICE COLD','BUILT DIFFERENT'].includes(editorial.label)){
   // Editorial never overrides the verifiable one-loss-elimination status.
   if(label!=='ON THE BRINK'||editorial.label==='ON THE BRINK'){label=editorial.label;reason=editorial.reason||reason;}
  }
  return{...st,label,reason,active:true,score,form,editorial:editorial?.published?editorial:null};
 }
 function allSeries(data){
  return allSlots(data).filter(s=>s.kind==='series'&&slotTeams(s).length===2&&validId(s.id));
 }
 function journey(data,teamId){
  const team=data?.teams?.[teamId];if(!team)return[];
  const league=team.league;const stages=['R1','R2','R3','LF',...(league==='QMJHL'?[]:['SF']),'F'];
  const matches=seriesFor(data,teamId),st=teamState(data,teamId);
  const completedLoss=st.status==='ELIMINATED'?st.slot:null;
  return stages.map((stage,i)=>{
    const s=matches.find(x=>x.stage===stage);
    if(!s)return{stage,title:roundTitles[stage],state:completedLoss&&i>stages.indexOf(completedLoss.stage)?'LOCKED':'PENDING',opponent:null,slot:null};
    const other=slotTeams(s).find(t=>t!==Number(teamId))||null;
    const score=scoreFor(s,teamId),winner=verifiedWinner(s);
    const state=s.kind==='bye'&&winner===Number(teamId)?'BYE':winner===Number(teamId)?'ADVANCED':winner?'ELIMINATED':s.kind==='series'&&other?'ACTIVE':'PENDING';
    return{stage,title:roundTitles[stage],state,opponent:other?data.teams?.[other]||null:null,slot:s,score,winner};
  });
 }
 function seriesStory(data,slot){
  const ids=slotTeams(slot),a=data?.teams?.[ids[0]],b=data?.teams?.[ids[1]],g=finalGames(slot),score=scoreFor(slot,ids[0]),winner=verifiedWinner(slot);
  if(!a||!b)return'Official matchup details have not been confirmed.';
  if(winner)return escape(data.teams[winner]?.name||'The series winner')+' has clinched this series '+(score?score.for+'–'+score.against:'')+'.';
  if(score&&(score.for||score.against)){
   const leader=score.for===score.against?null:score.for>score.against?a:b;
   return leader?escape(leader.name)+' leads '+Math.max(score.for,score.against)+'–'+Math.min(score.for,score.against)+'. '+(g.length?'The next result could reshape the series.':'Individual final-game details are still pending verification.'):
   'The series is tied '+score.for+'–'+score.against+'. The next game breaks the deadlock.';
  }
  return'The opening puck has not been recorded as final. Both teams begin with a clean slate.';
 }
 return{validId,num,escape,allSlots,slotTeams,allSeries,seriesFor,scoreFor,verifiedWinner,isFinal,finalGames,recentForm,teamState,pressure,journey,seriesStory,roundTitles};
});