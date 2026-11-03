/* White-jersey art adapter for the existing HitmenStall renderer.
   Enables only after the image loads, preserving the existing black asset as fallback. */
(()=>{
  const ASSET='assets/war-room/hitmen-white-stall.webp';
  let enabled=false;
  const src=new Image();
  function apply(){
    if(!enabled)return;
    document.querySelectorAll('.hs-stall:not(.is-empty):not(.hs-white)').forEach(stall=>{
      stall.classList.add('hs-white');
      const front=stall.querySelector('.hs-img.hs-front');
      if(front)front.src=ASSET;
      // Existing back uses an incompatible black jersey; don't present that as white.
      stall.querySelector('.hs-img.hs-back')?.remove();
      stall.classList.remove('is-back');
    });
  }
  src.addEventListener('load',()=>{enabled=true;apply();});
  src.addEventListener('error',()=>{console.warn('Hitmen white stall artwork unavailable; retaining existing image.');});
  src.src=ASSET;
  const start=()=>{apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
