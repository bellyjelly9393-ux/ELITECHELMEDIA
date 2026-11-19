/* Optional Great Britain 3D experience below its native panoramic locker room.
 * Keeps WebGL off until explicitly requested; never embeds the private AI Studio app.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const button=$('enterLocker'), status=$('lockerStatus'), frame=$('lockerFrame'), splash=$('lockerSplash'), standalone=$('openStandalone');
const raw=String(window.ECM_GB_LOCKER_ORIGIN||'').trim();
let base=null;
try{
  const candidate=new URL(raw);
  if(candidate.protocol==='https:' &&
     (/^elitechel-gb-locker(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(candidate.hostname)
      || candidate.hostname==='gb-locker.wildmanhockey-elitechelmedia.app')
      && candidate.pathname==='/' && !candidate.search && !candidate.hash){
    base=candidate.origin+'/';
  }
}catch{}
if(!base){
  status.textContent='The 3D app is prepared but its separate hosting connection is not live yet. The official roster and hockey cards remain accessible below.';
  button.disabled=true;
  return;
}
button.disabled=false;
standalone.hidden=false;
standalone.href=base;
status.textContent='Explore the interactive 3D dressing room. The experience loads only when you enter.';
const enterRoom=()=>{
  if(frame.src)return;
  button.disabled=true;
  status.textContent='Opening 3D locker room…';
  frame.src=base;
  frame.hidden=false;
  splash.hidden=true;
};
button.addEventListener('click',enterRoom);
// The panoramic roster is the GB default. Only load the 3D iframe when Enter is clicked.
// This prevents wasted GPU usage when visitors only need player stalls and cards.
})();
