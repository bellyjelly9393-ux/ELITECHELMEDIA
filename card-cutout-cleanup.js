/* Remove isolated rink markings while preserving equipment close to the skater. */
(()=>{'use strict';
function refine(data,width,height){
 const size=width*height,labels=new Int32Array(size),queue=new Int32Array(size),parts=[];
 let transparent=0;
 for(let i=3;i<data.length;i+=4)if(data[i]<32)transparent++;
 if(transparent<size*.01)return false;
 let body;
 for(let start=0;start<size;start++){
  if(labels[start]||data[start*4+3]<24)continue;
  const id=parts.length+1,part={id,left:width,right:0,top:height,bottom:0,count:0};
  let head=0,tail=1;queue[0]=start;labels[start]=id;
  while(head<tail){
   const i=queue[head++],x=i%width,y=Math.floor(i/width);
   part.left=Math.min(x,part.left);part.right=Math.max(x,part.right);
   part.top=Math.min(y,part.top);part.bottom=Math.max(y,part.bottom);
   for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)
    for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++){
     const n=yy*width+xx;if(!labels[n]&&data[n*4+3]>=24){labels[n]=id;queue[tail++]=n;}
    }
  }
  part.count=tail;parts.push(part);if(!body||tail>body.count)body=part;
 }
 if(!body)return false;
 const removed=new Set(),bodyHeight=body.bottom-body.top+1;
 for(const part of parts){
  const w=part.right-part.left+1,h=part.bottom-part.top+1;
  const gap=Math.max(body.left-part.right,part.left-body.right,body.top-part.bottom,part.top-body.bottom,0);
  if(part!==body && gap>bodyHeight*.10 && (w>h*7 || part.count<body.count*.001))removed.add(part.id);
 }
 for(let i=0;i<size;i++){
  const j=i*4+3,a=data[j];
  data[j]=removed.has(labels[i])||a<24?0:a>=200?255:Math.round(255*(a-24)/176);
 }
 return true;
}
async function clean(src){
 const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();
 const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
 const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
 const pixels=ctx.getImageData(0,0,c.width,c.height);
 if(!refine(pixels.data,c.width,c.height))return src;
 ctx.putImageData(pixels,0,0);
 let l=c.width,r=-1,t=c.height,b=-1;
 for(let i=0;i<c.width*c.height;i++)if(pixels.data[i*4+3]>32){
  const x=i%c.width,y=Math.floor(i/c.width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
 }
 if(r<l)return src;
 const out=document.createElement('canvas');out.width=r-l+5;out.height=b-t+5;
 out.getContext('2d').drawImage(c,l,t,r-l+1,b-t+1,2,2,r-l+1,b-t+1);
 return out.toDataURL();
}
window.ECMCutout={clean,refine};
})();
