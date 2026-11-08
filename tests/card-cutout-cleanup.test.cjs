const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync('card-cutout-cleanup.js','utf8'),{window});
test('removes distant board stripe while retaining a nearby detached stick blade and solid jersey',()=>{
 const w=120,h=100,data=new Uint8ClampedArray(w*h*4);
 function paint(l,t,r,b,a){for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)data[(y*w+x)*4+3]=a;}
 paint(81,16,108,90,212);paint(2,30,60,31,100);paint(68,82,77,84,230);
 assert.ok(window.ECMCutout.refine(data,w,h));
 const alpha=(x,y)=>data[(y*w+x)*4+3];
 assert.equal(alpha(40,30),0);assert.equal(alpha(95,54),255);assert.equal(alpha(72,83),255);
});
