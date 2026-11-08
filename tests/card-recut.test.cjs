const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync('card-recut.js','utf8'),{window,Math,Map,Array,Float32Array,Int32Array,Uint8ClampedArray,Infinity});
const {recut}=window.ECMRecut;

/* 200x160 scene: white ice floor, gold boards across the top, dark player body, thin dark stick with red blade. */
function scene(){
 const w=200,h=160,rgba=new Uint8ClampedArray(w*h*4),alpha=new Uint8ClampedArray(w*h),restored=new Uint8ClampedArray(w*h);
 const set=(x,y,[r,g,b])=>{const i=(y*w+x)*4;rgba[i]=r;rgba[i+1]=g;rgba[i+2]=b;rgba[i+3]=255;};
 const noise=(v,x,y)=>Math.max(0,Math.min(255,v+((x*31+y*17)%7)-3));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ice=[noise(232,x,y),noise(238,x,y),noise(244,x,y)],gold=[noise(196,x,y),noise(150,x,y),noise(52,x,y)];set(x,y,y<40?gold:ice);}
 const rect=(l,t,r,b,c,a)=>{for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){set(x,y,[noise(c[0],x,y),noise(c[1],x,y),noise(c[2],x,y)]);if(a!==undefined)alpha[y*w+x]=a;}};
 rect(90,20,130,130,[28,24,30],255);          // body: model got it right
 for(let y=20;y<=130;y++){alpha[y*w+131]=255;alpha[y*w+89]=255;}   // ...plus a thin ice halo along both edges
 rect(98,60,104,70,[225,70,150],255);          // pink stripe on the jersey
 rect(40,100,89,102,[20,20,22]);               // stick shaft (model missed it)
 rect(30,98,40,106,[200,30,40]);               // red blade (model missed it)
 // Manager painted a wide Restore stroke along the stick: everything under it came back, ice included.
 for(let y=92;y<=112;y++)for(let x=26;x<=92;x++){alpha[y*w+x]=255;restored[y*w+x]=1;}
 // The model also kept a gold board chunk touching the shoulder.
 for(let y=10;y<=30;y++)for(let x=131;x<=150;x++)alpha[y*w+x]=255;
 return {w,h,rgba,alpha,restored};
}

test('re-cut keeps the restored stick and blade but drops the ice that came back with them',()=>{
 const s=scene(),{alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored});
 const a=(x,y)=>alpha[y*s.w+x];
 assert.equal(a(60,101),255,'stick shaft kept');
 assert.equal(a(34,102),255,'red blade kept');
 assert.equal(a(60,95),0,'ice above the stick removed');
 assert.equal(a(60,110),0,'ice below the stick removed');
 assert.equal(a(110,80),255,'body untouched');
 assert.equal(a(101,65),255,'jersey stripe untouched');
});

function aiPass(s){const ai=new Float32Array(s.w*s.h);for(let y=20;y<=130;y++)for(let x=90;x<=130;x++)ai[y*s.w+x]=.95;return ai;}

test('with the fresh AI pass, re-cut removes board pixels the first cut glued to the player',()=>{
 const s=scene(),{alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored,ai:aiPass(s)});
 assert.equal(alpha[20*s.w+140],0,'gold boards removed');
 assert.equal(alpha[80*s.w+110],255,'body kept');
 assert.equal(alpha[101*s.w+60],255,'stick still kept');
 assert.equal(alpha[95*s.w+60],0,'restored ice still removed');
});

test('without the AI pass, re-cut leaves pixels the first cut already accepted',()=>{
 const s=scene(),{alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored});
 assert.equal(alpha[20*s.w+140],255);
});

test('a fresh AI pass protects pixels it is confident about',()=>{
 const s=scene(),ai=aiPass(s);
 for(let y=10;y<=30;y++)for(let x=131;x<=150;x++)ai[y*s.w+x]=.9;   // pretend the boards were actually a gold jersey
 const {alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored,ai});
 assert.equal(alpha[20*s.w+140],255);
});

test('locked pixels survive even when they match the background',()=>{
 const s=scene(),locked=new Uint8ClampedArray(s.w*s.h);
 for(let y=92;y<=96;y++)for(let x=50;x<=70;x++)locked[y*s.w+x]=1;
 const {alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored,locked});
 assert.equal(alpha[94*s.w+60],255);
 assert.equal(alpha[110*s.w+60],0);
});

test('white equipment the first cut accepted is not eaten by the colour check',()=>{
 const s=scene();for(let y=120;y<=130;y++)for(let x=92;x<=110;x++){const i=(y*s.w+x)*4;s.rgba[i]=s.rgba[i+1]=s.rgba[i+2]=240;}  // white skate
 const {alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored});
 assert.equal(alpha[125*s.w+100],255);
});

test('re-cut never adds pixels and does nothing without background samples',()=>{
 const s=scene(),{alpha}=recut({rgba:s.rgba,alpha:s.alpha,width:s.w,height:s.h,restored:s.restored});
 for(let i=0;i<alpha.length;i++)assert.ok(alpha[i]<=s.alpha[i]);
 const full=new Uint8ClampedArray(s.w*s.h).fill(255),r=recut({rgba:s.rgba,alpha:full,width:s.w,height:s.h});
 assert.equal(r.removed,0);
});
