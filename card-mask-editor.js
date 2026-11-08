/* Edit the foreground at original-image coordinates; only the masked PNG is exported. */
(() => {
 const image = async src => { const img = new Image(); img.src = src; await img.decode(); return img; };
 async function edit(original, progress, previous) {
  const initial = previous ? {data:previous} : await window.ECMImagePreparer.prepare(original, progress, {fullFrame:true});
  const [photo, mask] = await Promise.all([image(original), image(initial.data)]);
  const dialog = document.createElement('dialog');
  dialog.className = 'mask-editor';
  dialog.innerHTML = '<h2>Refine player cutout</h2><p>Paint over missing equipment to restore the original pixels. Erase removes rink pixels. Turn off the guide to inspect the edges.</p><label>Tool <select><option value="restore">Restore</option><option value="erase">Erase</option></select></label> <label>Brush width <input type="range" min="1" max="70" value="8"></label> <label><input type="checkbox" checked> Show original as guide</label><div class="mask-stage"><canvas></canvas></div><button type="button" data-undo>Undo stroke</button> <button type="button" data-cancel>Cancel</button> <button type="button" data-use>Use cutout</button>';
  document.body.append(dialog);
  const view=dialog.querySelector('canvas'), layer=document.createElement('canvas');
  view.width=layer.width=mask.width;view.height=layer.height=mask.height;
  const ctx=layer.getContext('2d'), screen=view.getContext('2d');
  const source=document.createElement('canvas');source.width=view.width;source.height=view.height;
  source.getContext('2d').drawImage(photo,0,0,view.width,view.height);
  const pattern=ctx.createPattern(source,'no-repeat');
  const tool=dialog.querySelector('select'), size=dialog.querySelector('[type=range]'), guide=dialog.querySelector('[type=checkbox]');
  const strokes=[];let active=null,pointer=null,frame;
  function display(){
   screen.clearRect(0,0,view.width,view.height);
   if(guide.checked){screen.globalAlpha=.28;screen.drawImage(source,0,0);screen.globalAlpha=1;}
   screen.drawImage(layer,0,0);
  }
  function paint(stroke,a,b){
   ctx.save();ctx.globalCompositeOperation=stroke.tool==='erase'?'destination-out':'source-over';
   ctx.strokeStyle=ctx.fillStyle=stroke.tool==='erase'?'black':pattern;
   ctx.lineWidth=stroke.size;ctx.lineCap='round';
   ctx.beginPath();
   if(a.x===b.x&&a.y===b.y){ctx.arc(a.x,a.y,stroke.size/2,0,Math.PI*2);ctx.fill();}
   else {ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
   ctx.restore();
  }
  function replay(){ctx.clearRect(0,0,view.width,view.height);ctx.drawImage(mask,0,0);for(const stroke of strokes)stroke.points.forEach((p,i)=>paint(stroke,stroke.points[Math.max(0,i-1)],p));display();}
  function point(e){const r=view.getBoundingClientRect();return {x:(e.clientX-r.left)*view.width/r.width,y:(e.clientY-r.top)*view.height/r.height};}
  function append(e){const p=point(e),last=active.points.at(-1)||p;active.points.push(p);paint(active,last,p);cancelAnimationFrame(frame);frame=requestAnimationFrame(display);}
  view.onpointerdown=e=>{if(active||e.button!==0)return;pointer=e.pointerId;view.setPointerCapture(pointer);active={tool:tool.value,size:+size.value,points:[]};strokes.push(active);append(e);};
  view.onpointermove=e=>{if(active&&e.pointerId===pointer)append(e);};
  view.onlostpointercapture=()=>{active=null;pointer=null;};
  guide.onchange=display;
  dialog.querySelector('[data-undo]').onclick=()=>{strokes.pop();replay();};
  replay();dialog.showModal();
  return new Promise(resolve=>{
   let output=null;
   dialog.querySelector('[data-use]').onclick=()=>{try{output=window.ECMImagePreparer.trim(layer);dialog.close();}catch{dialog.querySelector('p').textContent='Restore some player pixels before using this cutout.';}};
   dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
   dialog.onclose=()=>{cancelAnimationFrame(frame);dialog.remove();resolve(output?{data:output,full:layer.toDataURL()}:null);};
  });
 }
 let saved;
 const button=document.getElementById('playerMaskEdit');
 if(button)button.onclick=async()=>{
  const api=window.ecmCardStudio,art=api.getArtwork(),player=api.getSelected(),status=document.getElementById('playerMaskStatus');
  if(!art||!player){status.textContent='Choose a player and upload a screenshot first.';return;}
  button.disabled=true;
  try{
   const result=await edit(art,msg=>status.textContent=msg,saved?.original===art?saved.full:null);
   if(result&&api.getArtwork()===art&&api.getSelected()===player){
    saved={original:art,...result};await window.ECMStudioV2.generate();status.textContent='Cutout applied. Submit artwork for review when ready.';
   }else status.textContent='';
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
 window.ECMMaskEditor={edit,prepared:art=>saved?.original===art?saved.data:null};
})();
