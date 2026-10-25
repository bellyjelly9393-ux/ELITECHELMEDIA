/* Tap/keyboard disclosures shared by homepage, live hub and leaderboards. */
(()=>{'use strict';const nav=document.getElementById('nav'),menu=document.getElementById('menuBtn');if(!nav)return;
const triggers=[...nav.querySelectorAll('.home-menu-trigger')];
function close(except){triggers.forEach(b=>{if(b!==except){b.setAttribute('aria-expanded','false');document.getElementById(b.getAttribute('aria-controls')).hidden=true;}});}
triggers.forEach(b=>b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')!=='true';close();b.setAttribute('aria-expanded',String(open));document.getElementById(b.getAttribute('aria-controls')).hidden=!open;}));
nav.addEventListener('click',e=>{if(e.target.closest('a')){close();nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');}});
document.addEventListener('click',e=>{if(!e.target.closest('.home-live-menu'))close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const active=triggers.find(b=>b.getAttribute('aria-expanded')==='true');close();if(active)active.focus();}});
// Existing pages own their hamburger; the new leaderboard pages use this handler.
if(document.body.dataset.leaderboard&&menu){menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');if(!open)close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.focus();}});document.addEventListener('click',e=>{if(!e.target.closest('.top')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}});}
})();
