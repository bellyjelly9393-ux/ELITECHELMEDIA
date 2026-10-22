/* Isolated VVHL Swolly overlay. Only textContent assignments; no injected HTML. */
(function(){
  'use strict';
  function put(id,value,fallback){
    var el=document.getElementById(id);
    if(el)el.textContent=value===undefined||value===null||String(value).trim()===''?(fallback||''):String(value);
  }
  function readyLogo(){
    document.querySelectorAll('#swollyPack img').forEach(function(img){
      img.addEventListener('error',function(){
        img.style.visibility='hidden';
        if(img.classList.contains('sw-logo'))document.querySelector('.sw-logo-fallback').style.display='grid';
      });
    });
  }
  function render(p){
    var s=p.swolly||{};
    var preset=String(p.presetId||'swolly-starting');
    var opponent=p.awayName||'OPPONENT';
    var title={
      'swolly-starting':['STREAM','STARTING SOON'],
      'swolly-intermission':['INTERMISSION','THE STAMPEDE RETURNS SOON'],
      'swolly-brb':['BE RIGHT BACK','THE STAMPEDE RETURNS SOON'],
      'swolly-outro':['THANKS FOR WATCHING','SEE YOU NEXT GAME']
    }[preset]||['SWOLLY STAMPEDE','VVHL SEASON 12'];
    put('swTitle',title[0]);put('swSubtitle',p.message||title[1]);
    put('swHudHome',p.homeScore,0);put('swHudAway',p.awayScore,0);
    put('swHudOpponent',opponent,'OPPONENT');put('swHudPeriod',p.period||'1ST');
    put('swScoreHome',p.homeScore,0);put('swScoreAway',p.awayScore,0);
    put('swScoreOpponent',opponent,'OPPONENT');put('swMatchOpponent',opponent,'OPPONENT');
    put('swScoreLabel',preset==='swolly-final'?'FINAL SCORE · VVHL S12':'INTERMISSION · VVHL S12');
    put('swScoreMessage',p.message||'SWOLLY STAMPEDE');
    put('swLW',s.lw,'CARNEY I94');put('swC',s.c,'MAXIMUS6684');
    put('swD',s.d,'TRMISERY');put('swG',s.g,'JMEN_FISH27');
    for(var i=1;i<=3;i++){put('swTime'+i,s['time'+i],'GAME '+i);put('swOpp'+i,s['opponent'+i],'TBD');}
    put('swSocial',s.social,'@SWOLLYSTAMPEDE');put('swAlert',s.alert,'NEW FOLLOWER');
    put('swPlayerName',p.playerName,'PLAYER');put('swPlayerRole',p.playerRole,'PLAYER SPOTLIGHT');
    put('swPlayerNumber','#'+String(p.playerNumber||'94').replace(/^#/,''));
    put('swShotsHome',p.intShotsHome,'—');put('swShotsAway',p.intShotsAway,'—');
    put('swHitsHome',p.intHitsHome,'—');put('swHitsAway',p.intHitsAway,'—');
    put('swFaceoffsHome',p.intFaceoffsHome,'—');put('swFaceoffsAway',p.intFaceoffsAway,'—');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',readyLogo);else readyLogo();
  window.WM_Swolly={render:render};
})();