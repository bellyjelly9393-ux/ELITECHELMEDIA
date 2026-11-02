/* Keep the physical desk's front panel in sync with the existing episode player. */
(()=>{'use strict';const section=document.getElementById('lgRadioSec'),caption=document.getElementById('lgRadioSceneTitle');if(!section||!caption)return;
const sync=()=>{const source=section.querySelector('.hn-card [data-k="headline"]')||section.querySelector('[data-hn-headline]');const value=source?.textContent?.trim();if(value&&caption.textContent!==value)caption.textContent=value;};new MutationObserver(sync).observe(section,{childList:true,subtree:true,characterData:true});sync();})();
