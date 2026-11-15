/* EliteChel Season 55 Memorial Cup Contender Index.
   Official playoff teams and confirmed scores only. This is editorial scoring, never
   an official ranking, championship probability, or corrected disciplinary record. */
(()=>{
'use strict';
const D=window.WMDesk;if(!D)return;
const { $,esc,read,menu,tint }=D;menu();
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const clip=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const teamLogo=n=>id(n)?'assets/lgchl/s55/team'+Number(n)+'.png':'assets/wildman/home/lgchl-logo.webp';
const name=t=>t.name||t.nick||('Team '+t.id);
const record=t=>[t.w,t.l,t.otl].every(x=>x!==undefined)?t.w+'-'+t.l+'-'+t.otl:'Record pending';
const state={ranked:[],review:[],league:'all',source:'',fresh:null};
function scoreTeam(s,team,playoff){
 const gp=num(s.gp),pts=num(s.pts),gf=num(s.gf),ga=num(s.ga),seed=num(team.seed);
 if(!(gp>0&&pts!==null&&gf!==null&&ga!==null))return null;
 const pointsRate=clip(pts/(gp*2));
 const diff=clip(((gf-ga)/gp+3)/6);
 const seedStrength=seed&&seed>0?clip((9-seed)/8):.5;
 // Early playoff index uses *three different signals*: actual points%, goal strength and official seed.
 // Once recorded playoff games exist, game results replace seed strength.
 const form=playoff?.gp>0?clip(playoff.w/playoff.gp):seedStrength;
 return 100*(.55*pointsRate+.25*diff+.20*form);
}
function playoffResults(data){
 const map=new Map(),done=new Set();
 for(const t of Object.values(data.teams||{})){if(id(t.id))map.set(Number(t.id),{gp:0,w:0,l:0});}
 for(const m of Object.values(data.matchups||{}))for(const g of m.games||[]){
   const a=id(g.away),b=id(g.home),ga=num(g.away_score),gb=num(g.home_score);
   if(g.status!=='final'||!a||!b||ga===null||gb===null||!map.has(a)||!map.has(b)||done.has(g.id))continue;
   done.add(g.id);const ta=map.get(a),tb=map.get(b);ta.gp++;tb.gp++;
   if(ga>gb){ta.w++;tb.l++;}else if(gb>ga){tb.w++;ta.l++;}
 }
 return map;
}
function compute(standings,bracket){
 const entries=new Map(standings.map(s=>[Number(s.lg_team_id),s]));
 const results=playoffResults(bracket),ranked=[],review=[];
 for(const team of Object.values(bracket.teams||{})){
   const tid=id(team.id),s=entries.get(tid);if(!tid||!s)continue;
   // League standings do not yet reflect the reported Rimouski second-tagging correction.
   // Do not manufacture a corrected record: quarantine the stale input until verified.
   if(tid===465&&num(s.l)!==null&&Number(s.l)<22){
     review.push({...s,team,reason:'Reported 22-loss adjustment is not reflected in the current standings feed; contender position withheld pending verification.'});
     continue;
   }
   const strength=scoreTeam(s,team,results.get(tid));if(strength===null)continue;
   ranked.push({...s,team,score:strength,gpPlay:results.get(tid)?.gp||0,wPlay:results.get(tid)?.w||0,lPlay:results.get(tid)?.l||0,gd:Number(s.gf||0)-Number(s.ga||0)});
 }
 ranked.sort((a,b)=>b.score-a.score||b.gd-a.gd||name(a).localeCompare(name(b)));
 ranked.forEach((t,i)=>t.rank=i+1);
 return{ranked,review};
}
const podium=rows=>'<div class="lg-podium">'+[1,0,2].filter(i=>rows[i]).map(i=>{
 const t=rows[i];return'<a class="lg-podium-team place-'+(i+1)+' cup-podium" href="#lgPrList" data-logo="'+teamLogo(t.lg_team_id)+'"><img src="'+teamLogo(t.lg_team_id)+'" alt="" loading="lazy"><span class="lg-podium-rank">'+t.rank+'</span><h3>'+esc(name(t.team))+'</h3><small>'+esc(t.team.league)+' · '+esc(record(t))+'</small><b class="lg-podium-score">'+t.score.toFixed(1)+'</b><span class="lg-podium-move">CONTENDER INDEX</span></a>';
}).join('')+'</div>';
const row=t=>'<li class="card tinted lg-pr-row cup-rank-row" data-logo="'+teamLogo(t.lg_team_id)+'"><div class="lg-pr-rk"><b>'+t.rank+'</b></div><div class="lg-team" style="--team-logo:url('+teamLogo(t.lg_team_id)+')"><img src="'+teamLogo(t.lg_team_id)+'" alt="" loading="lazy"><div><b>'+esc(name(t.team))+'</b><small>'+esc(t.team.league||'')+' · '+esc(t.team.group||'')+'</small></div></div><dl class="lg-pr-stats num"><div><dt>Season record*</dt><dd>'+esc(record(t))+'</dd></div><div><dt>Playoffs</dt><dd>'+t.wPlay+'-'+t.lPlay+'</dd></div><div><dt>Season GD</dt><dd>'+(t.gd>0?'+':'')+t.gd+'</dd></div></dl><div class="lg-score-cell"><b>'+t.score.toFixed(1)+'</b><div class="lg-bar"><i style="width:'+t.score.toFixed(1)+'%"></i></div></div><a class="cup-team-link" href="lgchl-team.html?team='+t.lg_team_id+'">Team room →</a></li>';
function render(){
 const rows=state.league==='all'?state.ranked:state.ranked.filter(t=>t.team.league===state.league);
 $('lgPrPodium').innerHTML=podium(rows);
 $('lgPrList').innerHTML=rows.slice(3).map(row).join('')+(state.review.filter(t=>state.league==='all'||t.team.league===state.league).map(t=>'<li class="cup-review card"><img src="'+teamLogo(t.lg_team_id)+'" loading="lazy" alt=""><div><strong>'+esc(name(t.team))+' · Ranking pending correction</strong><p>'+esc(t.reason)+'</p></div></li>').join(''));
 if(!rows.length&&!state.review.length)$('lgPrList').innerHTML='<li class="empty">Verified playoff standings are unavailable. No contender list was invented.</li>';
 $('lgPrCount').textContent=rows.length+' playoff-qualified teams ranked · '+state.review.length+' under source review';
 tint($('lgPrPodium'));tint($('lgPrList'));
}
async function bracket(){
 const r=await Promise.allSettled([fetch('/api/lgchl-playoffs',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(x=>{if(!x.ok)throw Error('bracket');return x.json()}),fetch('assets/lgchl/playoffs/s55.json',{cache:'no-cache'}).then(x=>{if(!x.ok)throw Error('snapshot');return x.json()})]);
 const valid=r.map((x,i)=>x.status==='fulfilled'&&x.value?.teams&&x.value?.matchups?{data:x.value,source:i?'snapshot':'live'}:null).filter(Boolean).sort((a,b)=>Date.parse(b.data.fetched_at||0)-Date.parse(a.data.fetched_at||0));
 if(!valid.length)throw Error('No verified bracket');return valid[0];
}
async function main(){
 const [standings,playoff]=await Promise.all([
  read('lgchl_standings_current',{select:'lg_team_id,name,abbr,nickname,league,gp,w,l,otl,pts,gf,ga,gd'}),
  bracket()
 ]);
 const result=compute(standings,playoff.data);state.ranked=result.ranked;state.review=result.review;state.source=playoff.source;
 $('lgPrEyebrow').textContent='EliteChel · Season 55 · Memorial Cup contender index';
 $('lgPrNote').textContent='Editorial strength index, NOT championship odds: 55% regular-season points percentage + 25% season goal differential per game + 20% official playoff seed, replaced by verified playoff win rate once games finish. Only playoff-qualified teams are included. Season records are shown as the feed reports them; pending corrections are not silently estimated. Source: '+(playoff.source==='live'?'live':'saved')+' playoff bracket'+(playoff.data.stale?' (marked stale)':'')+'.';
 const wanted=new URLSearchParams(location.search).get('league');
 if(['OHL','WHL','QMJHL'].includes(wanted))state.league=wanted;
 document.querySelectorAll('#lgPrTabs button').forEach(b=>{
  b.setAttribute('aria-pressed',String(b.dataset.league===state.league));
  b.addEventListener('click',()=>{state.league=b.dataset.league;document.querySelectorAll('#lgPrTabs button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});
 });
 render();
}
main().catch(e=>{$('lgPrPodium').innerHTML='';$('lgPrList').innerHTML='<li class="empty">Verified playoff contender rankings are temporarily unavailable. Nothing was estimated without source data.</li>';console.warn(e);});
})();
