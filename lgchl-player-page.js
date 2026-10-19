/* Standalone LGCHL player profile, same renderer and navigation as the Top 250 modal. */
(() => {
  'use strict';
  const D=window.WMDesk;
  const Profile=window.WMLgPlayerProfile;
  const box=document.getElementById('lgFullPlayerProfile');
  if(!D||!Profile||!box)return;
  D.menu();
  const params=new URLSearchParams(location.search);
  const id=Number(params.get('id'));
  const kind=params.get('kind')==='goalie'?'goalie':'skater';
  const allowedMetrics=new Set(['points','goals','assists','shots','hits','blocked_shots','takeaways','save_pct','gaa']);
  const metric=allowedMetrics.has(params.get('metric'))?params.get('metric'):(kind==='goalie'?'save_pct':'points');
  const error=message=>{
    box.classList.add('lg-profile-page-error');
    box.textContent=message;
    box.setAttribute('aria-busy','false');
  };
  if(!Number.isSafeInteger(id)||id<=0) {
    error('This profile needs a valid official LeagueGaming player ID. Return to the Top 250 and select a player.');
    return;
  }
  (async()=>{
    try {
      // Public read-only leaderboard only. Never infer a player's identity from a tag.
      const list=await D.read('wm_lgchl_s55_player_leaders',{
        select:'lg_user_id,gamertag,player_kind,position,lg_team_id,team_name,gp,goals,assists,points,shots,save_pct,gaa,fetched_at',
        lg_user_id:'eq.'+id,
        player_kind:'eq.'+kind,
        order:'fetched_at.desc',
        limit:'5'
      });
      const player=list.find(p=>Number(p.lg_user_id)===id && p.player_kind===kind);
      if(!player){
        error('No current Season 55 profile was found for this player. Check the Top 250 for the latest listing.');
        return;
      }
      document.title=player.gamertag+' | EliteChel Media Player Profile';
      const update=()=>{
        box.innerHTML=Profile.render(player,{page:true,metric});
        box.setAttribute('aria-busy','false');
      };
      update();
      if(window.WMLgPlayerBadges){
        await window.WMLgPlayerBadges.load([player],D.read).catch(()=>false);
        update();
      }
    } catch {
      error('Player stats are not currently available. Please try again from the LGCHL Top 250.');
    }
  })();
})();
