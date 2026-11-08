/* Edit the foreground at original-image coordinates; only the masked PNG is exported. */
(() => {
 const image = async src => { const img = new Image(); img.src = src; await img.decode(); return img; };
 async function edit(original, progress, previous) {
  const initial = previous ? {data:previous} : await window.ECMImagePreparer.prepare(original, progress, {fullFrame:true});
  const [photo, mask] = await Promise.all([image(original), image(initial.data)]);
  const dialog = document.createElement('dialog');
  dialog.className = 'mask-editor';
  dialog.innerHTML = '<h2>Refine player cutout</h2><p>Paint over missing equipment to restore the original pixels, then press <b>Re-cut</b> to strip the ice and boards that came back with them. Use <b>Restore &amp; lock</b> for anything Re-cut must never remove. Erase removes rink pixels. Turn off the guide to inspect the edges.</p><label>Tool <select><option value="restore">Restore</option><option value="lock">Restore &amp; lock</option><option value="erase">Erase</option></select></label> <label>Brush width <input type="range" data-size min="1" max="70" value="8"></label> <label><input type="checkbox" checked> Show original as guide</label><div class="mask-stage"><canvas></canvas></div><div class="mask-recut"><button type="button" data-recut>Re-cut</button> <label>Re-cut strength <input type="range" data-strength min="0" max="100" value="50"></label></div><p class="mask-status" role="status" aria-live="polite"></p><button type="button" data-undo>Undo</button> <button type="button" data-cancel>Cancel</button> <button type="button" data-use>Use cutout</button>';
  document.body.append(dialog);
  const view=dialog.querySelector('canvas'), blank=()=>{const c=document.createElement('canvas');c.width=mask.width;c.height=mask.height;return c;};
  view.width=mask.width;view.height=mask.height;
  const layer=blank(), touched=blank(), locked=blank();
  const ctx=layer.getContext('2d'), screen=view.getContext('2d'), tctx=touched.getContext('2d'), kctx=locked.getContext('2d');
  const source=blank();
  source.getContext('2d').drawImage(photo,0,0,view.width,view.height);
  const pattern=ctx.createPattern(source,'no-repeat');
  const tool=dialog.querySelector('select'), size=dialog.querySelector('[data-size]'), guide=dialog.querySelector('[type=checkbox]');
  const strength=dialog.querySelector('[data-strength]'), recutButton=dialog.querySelector('[data-recut]'), status=dialog.querySelector('.mask-status');
  const strokes=[];let active=null,pointer=null,frame,busy=false;
  function display(){
   screen.clearRect(0,0,view.width,view.height);
   if(guide.checked){screen.globalAlpha=.28;screen.drawImage(source,0,0);screen.globalAlpha=1;}
   screen.drawImage(layer,0,0);
  }
  function line(c,style,stroke,a,b){
   c.save();c.globalCompositeOperation=stroke.tool==='erase'?'destination-out':'source-over';
   c.strokeStyle=c.fillStyle=style;c.lineWidth=stroke.size;c.lineCap='round';
   c.beginPath();
   if(a.x===b.x&&a.y===b.y){c.arc(a.x,a.y,stroke.size/2,0,Math.PI*2);c.fill();}
   else {c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
   c.restore();
  }
  function paint(stroke,a,b){
   const erase=stroke.tool==='erase';
   line(ctx,erase?'black':pattern,stroke,a,b);
   line(tctx,'white',stroke,a,b);                       // restore marks pixels for Re-cut; erase clears the mark
   if(erase||stroke.tool==='lock')line(kctx,'white',stroke,a,b);
  }
  function restoreSnapshot(entry){
   ctx.putImageData(entry.layer,0,0);tctx.clearRect(0,0,view.width,view.height);kctx.putImageData(entry.locked,0,0);
  }
  function replay(){
   for(const c of [ctx,tctx,kctx])c.clearRect(0,0,view.width,view.height);
   ctx.drawImage(mask,0,0);
   for(const stroke of strokes){if(stroke.recut)restoreSnapshot(stroke);else stroke.points.forEach((p,i)=>paint(stroke,stroke.points[Math.max(0,i-1)],p));}
   display();
  }
  function point(e){const r=view.getBoundingClientRect();return {x:(e.clientX-r.left)*view.width/r.width,y:(e.clientY-r.top)*view.height/r.height};}
  function append(e){const p=point(e),last=active.points.at(-1)||p;active.points.push(p);paint(active,last,p);cancelAnimationFrame(frame);frame=requestAnimationFrame(display);}
  const channel=(c,k)=>{const d=c.getContext('2d').getImageData(0,0,view.width,view.height).data,out=new Uint8ClampedArray(view.width*view.height);for(let i=0;i<out.length;i++)out[i]=d[i*4+k];return out;};
  async function freshSegmentation(alpha){
   if(!window.ECMImagePreparer?.segment)return null;
   const w=view.width,h=view.height;let l=w,t=h,r=-1,b=-1;
   for(let i=0;i<alpha.length;i++)if(alpha[i]>32){const x=i%w,y=(i-x)/w;if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}
   if(r<l)return null;
   const pad=Math.round(Math.max(r-l,b-t)*.08);l=Math.max(0,l-pad);t=Math.max(0,t-pad);r=Math.min(w-1,r+pad);b=Math.min(h-1,b+pad);
   const crop=document.createElement('canvas');crop.width=r-l+1;crop.height=b-t+1;
   crop.getContext('2d').drawImage(source,l,t,crop.width,crop.height,0,0,crop.width,crop.height);
   const prob=await window.ECMImagePreparer.segment(crop),ai=new Float32Array(w*h);
   for(let y=0;y<crop.height;y++)ai.set(prob.subarray(y*crop.width,(y+1)*crop.width),(t+y)*w+l);
   return ai;
  }
  async function recut(){
   if(busy||active)return;busy=true;recutButton.disabled=true;status.textContent='Re-cutting… keep this window open.';
   try{
    await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
    const w=view.width,h=view.height,alpha=channel(layer,3);
    let ai=null,note='';
    try{ai=await freshSegmentation(alpha);}catch{note=' AI pass unavailable, so only the colour check ran.';}
    if(!dialog.open)return;
    const rgba=source.getContext('2d').getImageData(0,0,w,h).data;
    const result=window.ECMRecut.recut({rgba,alpha,width:w,height:h,restored:channel(touched,3),locked:channel(locked,3),ai,strength:+strength.value/100});
    const image=ctx.getImageData(0,0,w,h);for(let i=0;i<result.alpha.length;i++)image.data[i*4+3]=result.alpha[i];
    const entry={recut:true,layer:image,locked:kctx.getImageData(0,0,w,h)};strokes.push(entry);restoreSnapshot(entry);display();
    status.textContent=result.removed?'Re-cut removed '+result.removed.toLocaleString()+' background pixels. Check the stick edges, then Undo or raise the strength if needed.'+note:'Re-cut found nothing to remove.'+note;
   }catch(error){status.textContent='Re-cut failed: '+error.message;}
   finally{busy=false;recutButton.disabled=false;}
  }
  view.onpointerdown=e=>{if(busy||active||e.button!==0)return;pointer=e.pointerId;view.setPointerCapture(pointer);active={tool:tool.value,size:+size.value,points:[]};strokes.push(active);append(e);};
  view.onpointermove=e=>{if(active&&e.pointerId===pointer)append(e);};
  view.onlostpointercapture=()=>{active=null;pointer=null;};
  guide.onchange=display;
  recutButton.onclick=recut;
  dialog.querySelector('[data-undo]').onclick=()=>{if(busy)return;strokes.pop();replay();status.textContent='';};
  replay();dialog.showModal();
  return new Promise(resolve=>{
   let output=null;
   dialog.querySelector('[data-use]').onclick=()=>{if(busy)return;try{output=window.ECMImagePreparer.trim(layer);dialog.close();}catch{status.textContent='Restore some player pixels before using this cutout.';}};
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
