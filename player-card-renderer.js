/* Shared, layered 1400 × 2000 composition: preview and PNG use the same canvas. */
(()=>{'use strict';const W=1400,H=2000,cache=new Map();let serial=0;
function image(src){if(!src)return Promise.resolve(null);if(cache.has(src))return cache.get(src);const promise=new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(Error('Required image unavailable: '+src.slice(0,90)));i.src=src;});cache.set(src,promise);promise.catch(()=>cache.delete(src));return promise;}
function polygon(x,pts,append=false){if(!append)x.beginPath();pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();}
function bevel(x,a,b,c,d,n=32,append=false){polygon(x,[[a+n,b],[c-n,b],[c,b+n],[c,d-n],[c-n,d],[a+n,d],[a,d-n],[a,b+n]],append);}
function gradient(x,a,b,c,d,colors){const g=x.createLinearGradient(a,b,c,d);colors.forEach(([p,v])=>g.addColorStop(p,v));return g;}
function text(x,t,a,b,size,color='#fff',align='left',width=999,font='CardDisplay'){x.textAlign=align;let n=size;do{x.font=n+'px '+font+',Impact,sans-serif';if(x.measureText(t).width<=width)break;n-=2;}while(n>16);x.fillStyle=color;x.shadowColor='#000b';x.shadowBlur=6;x.shadowOffsetY=5;x.fillText(t,a,b);x.shadowBlur=0;x.shadowOffsetY=0;}
function metal(x,t,a,b,size,align='left',width=999){text(x,t,a,b,size,gradient(x,0,b-size,0,b+8,[[0,'#fff'],[.34,'#eefaff'],[.48,'#a9c6da'],[.51,'#50677c'],[.7,'#fff'],[1,'#b5d2e9']]),align,width);}
function glow(x,a,b,r,color){const g=x.createRadialGradient(a,b,0,a,b,r);g.addColorStop(0,color);g.addColorStop(1,'#00000000');x.fillStyle=g;x.fillRect(a-r,b-r,r*2,r*2);}
function plate(x,a,b,w,h,accent){bevel(x,a,b,a+w,b+h,22);x.fillStyle=gradient(x,a,b,a+w,b+h,[[0,'#b2d6e8'],[.05,'#263f56'],[.3,'#09192c'],[.65,'#031120'],[.9,'#22425b'],[1,accent]]);x.fill();x.strokeStyle='#b9e9ff';x.lineWidth=3;x.stroke();}
function frame(x,colors){x.save();x.beginPath();bevel(x,10,10,W-10,H-10,85,true);bevel(x,58,58,W-58,H-58,66,true);x.clip('evenodd');x.fillStyle=gradient(x,0,0,W,H,[[0,'#e9fdff'],[.12,colors[2]],[.25,colors[1]],[.4,'#eaffff'],[.49,colors[2]],[.65,'#94d9ff'],[.76,'#0a2946'],[.91,'#f1fdff'],[1,colors[1]]]);x.fillRect(0,0,W,H);let seed=81;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<180;i++){const side=i%4,a=side===0?rnd()*W:side===1?W-30:side===2?rnd()*W:30,b=side===0?30:side===1?rnd()*H:side===2?H-30:rnd()*H;polygon(x,[[a,b],[a+(rnd()-.5)*150,b+(rnd()-.5)*180],[a+(rnd()-.5)*210,b+(rnd()-.5)*140]]);x.fillStyle=i%3?'#c9efff35':'#ffffff99';x.fill();x.strokeStyle='#d8faffbb';x.lineWidth=rnd()*2+1;x.stroke();}x.restore();for(const inset of [9,19,47,61]){bevel(x,inset,inset,W-inset,H-inset,85-inset/2);x.strokeStyle=inset===19?'#fff':'#97dbff';x.lineWidth=inset===19?4:2;x.stroke();}for(const [a,b] of [[85,30],[W-36,350],[40,1330],[W-130,H-32]]){glow(x,a,b,95,'#7ad6ff99');x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.moveTo(a-45,b);x.lineTo(a+45,b);x.moveTo(a,b-32);x.lineTo(a,b+32);x.stroke();}}
const backdrops={
 arena:['assets/wildman/home/arena.webp','#346698'],
 heat:['assets/broadcast/arena-tunnel.webp','#be5136'],
 city:['assets/broadcast/arena-blur.webp','#515792'],
 locker:['assets/hitmen-v3/locker-photo-master.webp','#87644e'],
 playoff:['assets/war-room/fx-arena.webp','#9a874e'],
 storm:['assets/broadcast/fx-lights.webp','#795bad'],
 classic:['assets/wildman/home/ice.webp','#567584']
};
function scene(x,arena,theme){
 x.save();bevel(x,49,49,W-49,H-49,63);x.clip();x.fillStyle='#102133';x.fillRect(0,0,W,H);
 const scale=Math.max(W/arena.width,1200/arena.height);
 x.drawImage(arena,(W-arena.width*scale)/2,205+(1200-arena.height*scale)/2,arena.width*scale,arena.height*scale);
 x.fillStyle=gradient(x,0,240,0,1280,[[0,'#050d2180'],[.55,'#101c3011'],[1,'#0a142280']]);x.fillRect(0,240,W,1040);
 const accent=(backdrops[theme]||backdrops.arena)[1];
 glow(x,950,720,650,accent+'38');x.restore();
}
// Scattered mask noise can leave a large transparent border on an otherwise good cutout.
const portraitBounds=new WeakMap();
function subjectBounds(img){
 if(portraitBounds.has(img))return portraitBounds.get(img);
 const mask=document.createElement('canvas'),scale=Math.min(1,360/Math.max(img.width,img.height));
 mask.width=Math.max(1,Math.round(img.width*scale));mask.height=Math.max(1,Math.round(img.height*scale));
 const ctx=mask.getContext('2d');ctx.drawImage(img,0,0,mask.width,mask.height);
 const pixels=ctx.getImageData(0,0,mask.width,mask.height).data;
 let left=mask.width,right=-1,top=mask.height,bottom=-1;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
  if(pixels[(y*mask.width+x)*4+3]<120)continue;
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 const bounds=right<left?{x:0,y:0,w:img.width,h:img.height}:{
  x:left*img.width/mask.width,y:top*img.height/mask.height,
  w:(right-left+1)*img.width/mask.width,h:(bottom-top+1)*img.height/mask.height};
 portraitBounds.set(img,bounds);return bounds;
}
async function draw(canvas,s){const ticket=++serial;const [arena,crest,league,portrait,team]=await Promise.all([image((backdrops[s.background]||backdrops.arena)[0]),image('assets/brand/ecm-crest.webp'),image(s.league==='lgchl'?'assets/wildman/home/lgchl-logo.webp':'assets/lg3s/art/ec-logo-ice.webp'),image(s.portrait),image(s.logo)]);await document.fonts.ready;if(ticket!==serial)return false;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),p=s.player,colors={ice:['#e3faff','#80d6ff','#174a77'],gold:['#fff3bd','#e7b94f','#745019'],crimson:['#ffd2d9','#ef5273','#6a152b']}[s.finish]||['#fff','#8ad8ff','#164777'];scene(x,arena,s.background);
plate(x,70,72,1260,160,colors[1]);x.drawImage(crest,99,83,155,155);text(x,s.edition==='season'?'PLAYER SERIES':s.edition.toUpperCase()+' SERIES',700,140,40,'#e8f6ff','center',790,'CardLabel');text(x,s.season,700,200,44,'#efd589','center',790,'CardLabel');

metal(x,s.overall!==''&&s.overall!=null?String(s.overall):'—',135,475,220,'left',375);text(x,s.ratingKind==='beta'?'ECM OVR · BETA':'OVR PENDING',250,535,36,'#dceefa','center',380,'CardLabel');if(s.ratingKind==='beta'&&s.performanceScore!=null)text(x,'INDEX '+s.performanceScore+' / 100',250,564,24,'#a6c3d9','center',340,'CardLabel');plate(x,105,585,290,94,colors[1]);text(x,(p?.pos||p?.kind||'PLAYER').toUpperCase(),250,657,66,'#fff','center',240);
if(s.edition!=='season'){plate(x,105,704,290,87,colors[1]);text(x,s.edition.toUpperCase(),250,764,42,'#fff','center',245);}if(s.jersey)text(x,'#'+s.jersey,1220,1200,58,'#fff','right');
if(portrait){x.save();x.beginPath();x.rect(65,240,1270,1040);x.clip();const bounds=subjectBounds(portrait);
 const z=Math.min(1170/bounds.w,985/bounds.h)*(s.imageScale||100)/100;
 const px=785+(s.imageX||0)*3-(bounds.x+bounds.w/2)*z;
 const py=1260+(s.imageY||0)*3-(bounds.y+bounds.h)*z;
 x.filter='contrast(1.07)';x.shadowColor='#030815cc';x.shadowBlur=8;
 x.drawImage(portrait,px,py,portrait.width*z,portrait.height*z);x.restore();}else{x.save();glow(x,760,850,490,'#98d9ff33');x.strokeStyle='#c1e8ff88';x.lineWidth=5;x.setLineDash([18,14]);x.strokeRect(400,405,650,790);x.setLineDash([]);x.fillStyle='#06213c99';x.fillRect(402,407,646,786);x.strokeStyle='#acd9f0';x.lineWidth=7;x.beginPath();x.arc(725,650,98,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(530,1040);x.lineTo(555,845);x.lineTo(645,800);x.lineTo(725,850);x.lineTo(805,800);x.lineTo(895,845);x.lineTo(920,1040);x.stroke();text(x,'YOUR CHEL PLAYER',725,1100,40,'#e5f6ff','center',550,'CardLabel');text(x,'UPLOAD YOUR PHOTO',725,1150,28,'#b1cfe1','center',550,'CardLabel');x.restore();}
plate(x,76,1287,1248,253,colors[1]);x.save();x.beginPath();bevel(x,79,1290,1321,1537,20);x.clip();if(team){x.globalAlpha=.09;x.drawImage(team,870,1265,360,330);x.globalAlpha=1;}x.fillStyle=gradient(x,0,1460,W,1525,[[0,'#0b1a27'],[.6,'#1b3444'],[1,'#253540']]);x.fillRect(91,1460,1218,60);x.fillStyle=colors[1];x.fillRect(91,1460,1218,3);x.restore();if(team)x.drawImage(team,100,1312,198,198);else text(x,(p?.team||'ECM').split(' ').map(v=>v[0]).join('').slice(0,4),195,1430,64,'#abcce0','center',180);metal(x,(p?.tag||'YOUR PLAYER').toUpperCase(),700,1420,100,'center',780);text(x,(p?.team||'SELECT YOUR VERIFIED PLAYER').toUpperCase(),700,1501,36,'#f1d896','center',950,'CardLabel');plate(x,76,1570,1248,266,colors[1]);for(let i=0;i<4;i++){const a=241+i*305;metal(x,s.values[i],a,1735,126,'center',275);text(x,s.labels[i],a,1800,45,'#efd281','center',260,'CardLabel');if(i<3){x.strokeStyle='#90cfff44';x.beginPath();x.moveTo(a+150,1620);x.lineTo(a+150,1800);x.stroke();}}text(x,s.season+' / '+(s.ratingKind==='beta'?'ECM BETA':'RATING PENDING'),700,1905,32,'#c6deec','center',1190,'CardLabel');frame(x,colors);
 // Keep league branding clear of the foil, fitted at its original aspect ratio.
 const logoScale=Math.min(266/league.width,140/league.height);
 const lw=league.width*logoScale,lh=league.height*logoScale;
 x.drawImage(league,1150-lw/2,154-lh/2,lw,lh);
 canvas.width=W;canvas.height=H;canvas.getContext('2d').drawImage(c,0,0);canvas.setAttribute('aria-label',(p?.tag||'No player selected')+', '+(p?.team||'')+', '+s.season+'. '+s.labels.map((l,i)=>l+' '+s.values[i]).join(', ')+'. '+(s.ratingKind==='beta'?'ECM beta OVR '+s.overall+', performance index '+s.performanceScore+' out of 100':'Automatic OVR unavailable'));return true;}
window.ECMCardRenderer={draw,width:W,height:H};})();
