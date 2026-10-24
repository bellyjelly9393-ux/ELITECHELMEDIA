/* Reference-style controls around the existing verified statistics and fixture desk. */
(()=>{'use strict';
const mode=document.getElementById('thPlayerStatus'),metric=document.getElementById('thPlayerSort');
const tabs=[...document.querySelectorAll('.desk-leader-tabs button')];
function sync(){tabs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode.value&&b.dataset.metric===metric.value)))}
tabs.forEach(b=>b.addEventListener('click',()=>{mode.value=b.dataset.mode;mode.dispatchEvent(new Event('change'));metric.value=b.dataset.metric;metric.dispatchEvent(new Event('change'));sync()}));
mode?.addEventListener('change',()=>queueMicrotask(sync));metric?.addEventListener('change',sync);
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const id=a.getAttribute('href').slice(1),target=document.getElementById(id);if(!target)return;let parent=target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement}});
})();
