/* On-device U2NetP segmentation. Model bytes verified before inference; photos never sent to model host. */
(()=>{'use strict';

const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Photo could not be decoded.'));image.src=src;});}
let worker,requestId=0;
function infer(values){return new Promise((resolve,reject)=>{
 if(!worker)worker=new Worker('card-image-worker.js?v=20261108-publish1');const current=worker,id=++requestId;
 const timeout=setTimeout(()=>{current.terminate();if(worker===current)worker=null;reject(Error('Automatic cutout timed out; original kept for manager review.'));},60000);
 current.onmessage=event=>{if(event.data.id!==id)return;clearTimeout(timeout);if(event.data.error){current.terminate();if(worker===current)worker=null;reject(Error(event.data.error));}else resolve(new Float32Array(event.data.mask));};
 current.onerror=()=>{clearTimeout(timeout);current.terminate();if(worker===current)worker=null;reject(Error('Automatic cutout unavailable; original kept for review.'));};current.postMessage({id,values:values.buffer},[values.buffer]);
 });}
function trim(c){const x=c.getContext('2d'),data=x.getImageData(0,0,c.width,c.height).data;let left=c.width,top=c.height,right=0,bottom=0,count=0;for(let y=0;y<c.height;y++)for(let z=0;z<c.width;z++)if(data[(y*c.width+z)*4+3]>32){left=Math.min(left,z);right=Math.max(right,z);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}if(count<c.width*c.height*.005)throw Error('Cutout was empty.');const pad=Math.round(Math.max(c.width,c.height)*.025);left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(c.width-1,right+pad);bottom=Math.min(c.height-1,bottom+pad);const out=canvas(right-left+1,bottom-top+1);out.getContext('2d').drawImage(c,left,top,out.width,out.height,0,0,out.width,out.height);return out.toDataURL('image/png');}
async function prepare(src,progress=()=>{},{fullFrame=false}={}){
 const image=await loadImage(src),scale=Math.min(1,1600/Math.max(image.width,image.height)),c=canvas(Math.round(image.width*scale),Math.round(image.height*scale)),x=c.getContext('2d');x.drawImage(image,0,0,c.width,c.height);const original=x.getImageData(0,0,c.width,c.height);let transparent=0;for(let i=3;i<original.data.length;i+=4)if(original.data[i]<240)transparent++;
 if(transparent>c.width*c.height*.01)return {data:fullFrame?c.toDataURL():trim(c),mode:'transparent'};
 progress('Preparing your player cutout on this device… Keep this page open.');
 try{
 const small=canvas(320,320),sx=small.getContext('2d');sx.drawImage(c,0,0,320,320);const pixels=sx.getImageData(0,0,320,320).data,values=new Float32Array(3*320*320),means=[.485,.456,.406],std=[.229,.224,.225];let max=1;for(let i=0;i<pixels.length;i+=4)for(let ch=0;ch<3;ch++)max=Math.max(max,pixels[i+ch]);for(let i=0;i<320*320;i++)for(let ch=0;ch<3;ch++)values[ch*320*320+i]=(pixels[i*4+ch]/max-means[ch])/std[ch];
 const mask=await infer(values);let lo=Infinity,hi=-Infinity;for(const v of mask){lo=Math.min(lo,v);hi=Math.max(hi,v);}if(!Number.isFinite(lo)||hi-lo<1e-5)throw Error('No usable foreground found.');const alpha=sx.createImageData(320,320);for(let i=0;i<mask.length;i++){alpha.data[i*4]=alpha.data[i*4+1]=alpha.data[i*4+2]=255;alpha.data[i*4+3]=Math.round(255*Math.max(0,Math.min(1,(mask[i]-lo)/(hi-lo))));}sx.putImageData(alpha,0,0);const large=canvas(c.width,c.height),lx=large.getContext('2d');lx.drawImage(small,0,0,c.width,c.height);const rgba=lx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<rgba.length;i+=4)original.data[i]=Math.round(original.data[i]*Math.min(1,Math.max(0,(rgba[i]-18)/112)));x.putImageData(original,0,0);return {data:fullFrame?c.toDataURL():trim(c),mode:'cutout'};
 }catch(error){return {data:src,mode:'original-fallback',warning:error.message};}
}
window.ECMImagePreparer={prepare,trim};})();
