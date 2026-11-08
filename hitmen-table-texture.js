/* Draw original logo pixels into the panorama texture, never camera-facing DOM.
   No generative artwork or player data is used in this compositor. */
(()=>{'use strict';
 const images=new Map(),textures=new Map();
 const logos=['assets/lgchl/s55/team412.png','assets/brand/ecm-logo.webp'];
 const load=src=>{if(!images.has(src))images.set(src,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;}));return images.get(src);};
 // Tabletop corners measured in the original 1774 x 887 empty room images.
 const planes={entrance:[[812,529],[960,529],[985,558],[788,558]],centre:[[703,609],[1066,609],[1120,677],[649,677]]};
 function projection(q){
  const [p0,p1,p2,p3]=q,dx1=p1[0]-p2[0],dx2=p3[0]-p2[0],dy1=p1[1]-p2[1],dy2=p3[1]-p2[1],sx=p0[0]-p1[0]+p2[0]-p3[0],sy=p0[1]-p1[1]+p2[1]-p3[1],den=dx1*dy2-dx2*dy1;
  const g=(sx*dy2-dx2*sy)/den,h=(dx1*sy-sx*dy1)/den;
  const a=p1[0]-p0[0]+g*p1[0],b=p3[0]-p0[0]+h*p3[0],d=p1[1]-p0[1]+g*p1[1],e=p3[1]-p0[1]+h*p3[1];
  return (u,v)=>[(a*u+b*v+p0[0])/(g*u+h*v+1),(d*u+e*v+p0[1])/(g*u+h*v+1)];
 }
 function triangle(ctx,art,s,t){
  const a=(t[1][0]-t[0][0])/(s[1][0]-s[0][0]),b=(t[1][1]-t[0][1])/(s[1][0]-s[0][0]),c=(t[2][0]-t[0][0])/(s[2][1]-s[0][1]),d=(t[2][1]-t[0][1])/(s[2][1]-s[0][1]);
  ctx.save();ctx.beginPath();ctx.moveTo(...t[0]);ctx.lineTo(...t[1]);ctx.lineTo(...t[2]);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,t[0][0]-a*s[0][0]-c*s[0][1],t[0][1]-b*s[0][0]-d*s[0][1]);ctx.drawImage(art,0,0);ctx.restore();
 }
 async function compose(scene,src){
  const key=scene+src;if(textures.has(key))return textures.get(key);
  const task=(async()=>{try{
   if(!planes[scene])return src;
   const [room,hitmen,ecm]=await Promise.all([load(src),...logos.map(load)]);
   const art=document.createElement('canvas');art.width=1000;art.height=500;const ink=art.getContext('2d');
   ink.strokeStyle='#a8293e';ink.lineWidth=5;ink.globalAlpha=.85;
   ink.beginPath();ink.roundRect(12,12,976,476,160);ink.stroke();
   ink.lineWidth=3;ink.beginPath();for(const at of [280,500,720]){ink.moveTo(at,20);ink.lineTo(at,480);}ink.stroke();ink.beginPath();ink.arc(500,250,105,0,Math.PI*2);ink.stroke();
   const canvas=document.createElement('canvas');canvas.width=room.width*2;canvas.height=room.height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.imageSmoothingQuality='high';ctx.drawImage(room,0,0);
   const q=planes[scene].map(([x,y])=>[x*room.width/1774,y*room.height/887]),point=projection(q),n=24;
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n,U=(x+1)/n,V=(y+1)/n;
    triangle(ctx,art,[[u*1000,v*500],[U*1000,v*500],[u*1000,V*500]],[point(u,v),point(U,v),point(u,V)]);
    triangle(ctx,art,[[U*1000,V*500],[u*1000,V*500],[U*1000,v*500]],[point(U,V),point(u,V),point(U,v)]);
   }
   // The upright front fascia keeps both original marks readable at natural proportions.
   const front=scene==='entrance'?{y:578,height:24,x:[850,898]}:{y:714,height:44,x:[811,911]};
   const scaleX=room.width/1774,scaleY=room.height/887;ctx.globalAlpha=.98;
   [hitmen,ecm].forEach((logo,i)=>ctx.drawImage(logo,front.x[i]*scaleX,front.y*scaleY,front.height*logo.width/logo.height*scaleX,front.height*scaleY));
   return canvas.toDataURL('image/png');
  }catch{return src;}})();textures.set(key,task);return task;
 }
 window.HitmenTableTexture={compose};
})();
