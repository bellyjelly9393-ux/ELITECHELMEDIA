/* Re-cut a refined player mask: drop restored/leftover pixels whose colour matches the nearby background.
   Subtractive only - it never adds pixels back. Locked pixels are never touched. Runs on-device. */
(()=>{'use strict';
const TILE=24,REACH=3,PALETTE=48,GLOBAL=16;

function toLab(rgba,n){
 const lab=new Float32Array(n*3);
 const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
 const table=new Float32Array(256);for(let i=0;i<256;i++)table[i]=lin(i);
 const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
 for(let i=0;i<n;i++){
  const r=table[rgba[i*4]],g=table[rgba[i*4+1]],b=table[rgba[i*4+2]];
  const x=f((r*.4124+g*.3576+b*.1805)/.95047),y=f(r*.2126+g*.7152+b*.0722),z=f((r*.0193+g*.1192+b*.9505)/1.08883);
  lab[i*3]=116*y-16;lab[i*3+1]=500*(x-y);lab[i*3+2]=200*(y-z);
 }
 return lab;
}
const bin=(rgba,i)=>(rgba[i*4]>>3)<<10|(rgba[i*4+1]>>3)<<5|rgba[i*4+2]>>3;

/* Per-tile colour histograms (quantised bins -> mean Lab + count). */
function histograms(rgba,lab,w,h,include){
 const cols=Math.ceil(w/TILE),rows=Math.ceil(h/TILE),tiles=Array.from({length:cols*rows},()=>new Map()),global=new Map();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(!include(i))continue;
  const key=bin(rgba,i),tile=tiles[Math.floor(y/TILE)*cols+Math.floor(x/TILE)];
  for(const map of [tile,global]){let e=map.get(key);if(!e){e=[0,0,0,0];map.set(key,e);}e[0]+=lab[i*3];e[1]+=lab[i*3+1];e[2]+=lab[i*3+2];e[3]++;}
 }
 return {tiles,global,cols,rows};
}
const top=(map,limit)=>[...map.values()].sort((a,b)=>b[3]-a[3]).slice(0,limit).map(e=>[e[0]/e[3],e[1]/e[3],e[2]/e[3]]);

/* Merge each tile's neighbourhood into one flat palette (Float32 L,a,b triples). */
function palettes(hist,withGlobal){
 const {tiles,cols,rows}=hist,out=new Array(tiles.length),shared=withGlobal?top(hist.global,GLOBAL):[];
 for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++){
  const merged=new Map();
  for(let y=Math.max(0,ty-REACH);y<=Math.min(rows-1,ty+REACH);y++)for(let x=Math.max(0,tx-REACH);x<=Math.min(cols-1,tx+REACH);x++)
   for(const [key,e] of tiles[y*cols+x]){let m=merged.get(key);if(!m){m=[0,0,0,0];merged.set(key,m);}m[0]+=e[0];m[1]+=e[1];m[2]+=e[2];m[3]+=e[3];}
  const colours=top(merged,PALETTE).concat(shared),flat=new Float32Array(colours.length*3);
  colours.forEach((c,k)=>flat.set(c,k*3));out[ty*cols+tx]=flat;
 }
 return out;
}
function nearest(lab,i,palette){
 let best=Infinity;const L=lab[i*3],A=lab[i*3+1],B=lab[i*3+2];
 for(let k=0;k<palette.length;k+=3){const d=(L-palette[k])**2+(A-palette[k+1])**2+(B-palette[k+2])**2;if(d<best)best=d;}
 return Math.sqrt(best);
}

/* Remove specks left behind: components far smaller than the main body. */
function despeckle(alpha,w,h){
 const n=w*h,labels=new Int32Array(n),queue=new Int32Array(n),sizes=[0];let body=0;
 for(let s=0;s<n;s++){
  if(labels[s]||alpha[s]<24)continue;
  const id=sizes.length;let head=0,tail=1;queue[0]=s;labels[s]=id;
  while(head<tail){const i=queue[head++],x=i%w,y=(i-x)/w;
   for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){const j=yy*w+xx;if(!labels[j]&&alpha[j]>=24){labels[j]=id;queue[tail++]=j;}}}
  sizes.push(tail);if(tail>sizes[body]||!body)body=id;
 }
 if(!body)return 0;
 const minimum=Math.max(30,sizes[body]*.003);let removed=0;
 for(let i=0;i<n;i++){const id=labels[i];if(alpha[i]&&(alpha[i]<24||(id!==body&&sizes[id]<minimum))){alpha[i]=0;removed++;}}
 return removed;
}

/**
 * rgba: original photo pixels (Uint8ClampedArray, w*h*4)
 * alpha: current cutout alpha (Uint8ClampedArray w*h) - modified copy is returned
 * restored: optional Uint8 w*h, non-zero where the manager painted Restore since the last re-cut
 * locked: optional Uint8 w*h, non-zero where pixels must be kept as-is
 * ai: optional Float32 w*h foreground probability (0..1) from a fresh tight-crop segmentation
 * strength: 0..1, higher removes more
 */
function recut({rgba,alpha,width:w,height:h,restored,locked,ai,strength=.5}){
 const n=w*h,out=new Uint8ClampedArray(alpha),lab=toLab(rgba,n);
 const isLocked=i=>locked&&locked[i],isRestored=i=>restored&&restored[i];
 const isBg=i=>alpha[i]<8&&!isLocked(i),isFg=i=>alpha[i]>=250&&!isRestored(i)&&(!ai||ai[i]>=.6||isLocked(i));
 // A colour only counts as player evidence when it is far more typical of the player than of the background,
 // so an ice halo left on the first cut cannot vouch for restored ice.
 const coarse=i=>(rgba[i*4]>>4)<<8|(rgba[i*4+1]>>4)<<4|rgba[i*4+2]>>4,bgC=new Float64Array(4096),fgC=new Float64Array(4096);let bgN=0,fgN=0;
 for(let i=0;i<n;i++){if(isBg(i)){bgC[coarse(i)]++;bgN++;}else if(isFg(i)){fgC[coarse(i)]++;fgN++;}}
 const typical=i=>isLocked(i)||!bgN||fgC[coarse(i)]/fgN>2*bgC[coarse(i)]/bgN;
 const bgHist=histograms(rgba,lab,w,h,isBg);
 const fgHist=histograms(rgba,lab,w,h,i=>isFg(i)&&typical(i));
 if(!bgHist.global.size)return {alpha:out,removed:0,kept:n};
 const bg=palettes(bgHist,false),fg=palettes(fgHist,true),cols=bgHist.cols;
 const cut=.28+.3*Math.max(0,Math.min(1,strength));
 let removed=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(!out[i]||isLocked(i))continue;
  const touched=isRestored(i),p=ai?ai[i]:null;
  // Pixels the first cut accepted are only re-judged when the fresh AI pass doubts them.
  if(!touched&&(p===null||p>=.6))continue;
  const t=Math.floor(y/TILE)*cols+Math.floor(x/TILE);
  const dB=bg[t].length?nearest(lab,i,bg[t]):Infinity;if(dB===Infinity)continue;
  const dF=fg[t].length?nearest(lab,i,fg[t]):Infinity;
  const score=dF===Infinity?0:dB/(dF+dB+1e-6);        // 0 = looks like background, 1 = looks like player
  const limit=touched||p<.2?cut:cut-.12;
  if(dB<2.5&&dF>6||score<limit-.08){if(out[i]){out[i]=0;removed++;}}
  else if(score<limit+.08)out[i]=Math.round(out[i]*(score-(limit-.08))/.16);  // soft edge on mixed pixels
 }
 removed+=despeckle(out,w,h);
 if(locked)for(let i=0;i<n;i++)if(locked[i])out[i]=alpha[i];
 return {alpha:out,removed};
}
window.ECMRecut={recut,despeckle};
})();
