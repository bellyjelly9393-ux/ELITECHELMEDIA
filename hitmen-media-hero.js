/* Hitmen Media hero reads the latest public Calgary S55 schedule and standings.
   A blank data field is intentionally preferable to inventing a record or game time. */
(() => {
  'use strict';
  const record=document.getElementById('hmSeasonRecord'),next=document.getElementById('hmSeasonNext');
  if(!record||!next)return;
  const KEY='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP',ROOT='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
  const headers={apikey:KEY,Authorization:'Bearer '+KEY};
  function name(id){
    return ({413:'Prince Albert Raiders',414:'Regina Pats',415:'Edmonton Oil Kings',416:'Medicine Hat Tigers',409:'Brandon Wheat Kings',379:'Saskatoon Blades',385:'Red Deer Rebels',377:'Swift Current Broncos',411:'Moose Jaw Warriors',418:'Lethbridge Hurricanes',2983:'Spokane Chiefs'})[id]||'Opponent '+id;
  }
  async function json(table,params){
    const r=await fetch(ROOT+table+'?'+new URLSearchParams(params),{headers,cache:'no-store'});
    if(!r.ok)throw Error(table+' '+r.status);
    return r.json();
  }
  async function load(){
    try{
      const rows=await json('lgchl_standings_snapshots',{select:'w,l,otl,taken_at',season:'eq.55',lg_team_id:'eq.412',order:'taken_at.desc',limit:'1'});
      const s=rows[0];if(s)record.textContent=[s.w,s.l,s.otl].map(v=>Number(v)||0).join('–');
    }catch(e){console.warn('Hitmen standings unavailable',e);record.textContent='See game log';record.style.fontSize='18px';}
    try{
      const rows=await json('lgchl_games',{select:'lg_game_id,home_lg_team_id,away_lg_team_id,game_at,status',season:'eq.55',status:'eq.scheduled',order:'game_at.asc',limit:'200'});
      const today=Date.now();
      const g=rows.find(g=>(g.home_lg_team_id===412||g.away_lg_team_id===412)&&Date.parse(g.game_at)>today-7200000);
      if(!g){next.textContent='Season game log ↗';return;}
      const opp=g.home_lg_team_id===412?g.away_lg_team_id:g.home_lg_team_id;
      const date=new Date(g.game_at).toLocaleString('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      next.textContent='vs '+name(opp)+' · '+date+' ET';
    }catch(e){console.warn('Hitmen schedule unavailable',e);next.textContent='View game center ↗';}
  }
  load();
})();
