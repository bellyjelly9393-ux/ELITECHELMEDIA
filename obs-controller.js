(function(){
  'use strict';
  var panel=document.getElementById('controllerPanel');
  if(!panel)return;
  var byId=function(id){return document.getElementById(id);};
  var background=byId('controllerBackground'),accent=byId('controllerAccent');
  var source=byId('controllerSourceUrl'),preview=byId('controllerPreview');
  var loaded=false;
  function sourceUrl(){
    var url=new URL('https://keymap.io/overlay/');
    url.searchParams.set('style','xbox');
    if(background.value==='dark'||background.value==='green')url.searchParams.set('bg',background.value);
    var colour=/^#[0-9a-f]{6}$/i.test(accent.value)?accent.value.slice(1):'d9a63b';
    url.searchParams.set('accent',colour);
    return url.href;
  }
  function update(){
    source.value=sourceUrl();
    byId('controllerOpen').href=source.value;
    byId('controllerCopyStatus').textContent='';
    var appearance=byId('controllerAppearance');
    appearance.style.setProperty('--controller-accent',/^#[0-9a-f]{6}$/i.test(accent.value)?accent.value:'#d9a63b');
    appearance.dataset.background=background.value;
    if(loaded)loadPreview();
  }
  function loadPreview(){
    loaded=true;
    byId('controllerLiveFrame').hidden=false;
    preview.src=sourceUrl();
    byId('controllerPreviewStatus').textContent='Keymap preview requested. Press a button on a controller connected to this computer. A drawing or successful page load does not confirm input capture. If blank, use Open Overlay.';
  }
  background.addEventListener('change',update);
  accent.addEventListener('input',update);
  byId('controllerLoad').addEventListener('click',loadPreview);
  byId('controllerGold').addEventListener('click',function(){accent.value='#d9a63b';background.value='transparent';update();});
  byId('controllerExample').addEventListener('click',function(){accent.value='#ff3d6e';background.value='green';update();});
  byId('controllerCopy').addEventListener('click',async function(){
    var value=source.value;
    try{
      await navigator.clipboard.writeText(value);
      byId('controllerCopyStatus').textContent='Controller URL copied. Paste it into an OBS Browser Source at 600 × 400.';
    }catch(error){
      source.focus();source.select();
      byId('controllerCopyStatus').textContent='Clipboard unavailable. The URL is selected; copy it manually.';
    }
  });
  update();
})();
