/* The locker uses the same shell as Headquarters and the existing locker data/controllers. */
(() => {
  const E=id=>document.getElementById(id);
  const TEAM='b0bcbdda-da9d-419d-8f61-b34937966d49';
  const state=()=>window.VVHLBackend?.state||{};
  function sync(){
    const s=state(),profileRole=String(s.profile?.role||'').toLowerCase();
    const membership=(s.memberships||[]).find(m=>m.team_id===TEAM&&m.active!==false);
    const role=['admin','commissioner'].includes(profileRole)?profileRole:String(membership?.role||'').toLowerCase();
    const staff=['admin','commissioner','owner','gm','agm','scout'].includes(role);
    if(document.body.dataset.room==='locker'){
      // Reuse the full room controller's existing access decision.
      const allowed=Boolean(window.HitmenTeamLocker?.hasAccess());
      E('hqGate').hidden=allowed;
      E('hqApp').hidden=!allowed;
      E('managementLockedMessage').textContent=!s.user
        ?'Sign in with your Calgary team account to open the locker room.'
        :'This account needs an active Calgary Hitmen team membership.';
      if(!allowed){
        ['lockerRoster','lockerTcRoster','lockerLineReports'].forEach(id=>{E(id).textContent='';});
        ['lockerRosterCount','lockerTcCount','lockerReportCount'].forEach(id=>{E(id).textContent='—';});
      }
    }
    const visible=Boolean(s.user&&(role||s.hitmenLockerClaim?.matched));
    E('hqWho').hidden=!visible;
    E('hqWhoName').textContent=visible?(s.profile?.display_name||'Calgary team account'):'';
    E('hqWhoRole').textContent=visible?(role||'player').toUpperCase():'';
    // These links lead to management-only rooms; player stall access stays with the existing controller.
    document.querySelectorAll('.sub-in a').forEach(a=>{
      const target=a.getAttribute('href')||'';
      if(['hitmen-scouting.html','hitmen-lineup.html','obs-control.html','vod-lab.html?team=calgary-hitmen'].includes(target))a.hidden=Boolean(s.user&&!staff);
    });
  }
  window.WMDesk?.menu();
  window.addEventListener('vvhl-auth-change',sync);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
})();
