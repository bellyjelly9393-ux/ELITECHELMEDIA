'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const script = read('lg3s-carbon-source.js');
const html = read('lg3s-carbon-source.html');
const desk = read('obs-control.html');
const api = read('api/lg3s-carbon.js');

async function execute(hash, reply, search='') {
  let count=0, request=null;
  const warnings=[];
  const program = { src:'',hidden:false,removeAttribute(name){ delete this[name]; } };
  const status = {hidden:true};
  const message = {textContent:''};
  const elements = {program,carbonAccessStatus:status,carbonAccessMessage:message,carbonAccessBrand:{},carbonAccessDesk:{}};
  const document={getElementById(id){ if(!elements[id])throw Error('missing DOM node '+id);return elements[id]; }};
  const fetch = async (...args) => {count++;request=args;if(reply instanceof Error)throw reply;return {ok:reply===204,status:reply};};
  const context = {document,location:{hash,search},URLSearchParams,fetch,console:{warn(s){warnings.push(s);}}};
  vm.runInNewContext(script,context,{filename:'lg3s-carbon-source.js',timeout:2000});
  await new Promise(resolve=>setImmediate(resolve));
  return {program,status,message,count,request,warnings};
}
test('successful private program exchange loads only authenticated Carbon broadcast',async()=>{
  const result=await execute('#test-opaque-token',204);
  assert.equal(result.program.src,'/lg3s-gb/arena/broadcast.html?follow=desk');
  assert.equal(result.program.hidden,false);
  assert.equal(result.status.hidden,true);
  assert.equal(result.count,1);
  assert.equal(result.request[0],'/lg3s-gb/arena/open-program');
  assert.equal(result.request[1].method,'POST');
  assert.equal(result.request[1].headers.Authorization,'Bearer test-opaque-token');
  assert.equal(result.warnings.length,0);
});
test('private Czechia OBS links keep their selected matchup and reject unknown matchups',async()=>{
  for(const game of ['germany','usa','sweden','lg-923931']){
    const result=await execute('#test-opaque-token',204,'?game='+game);
    assert.equal(result.count,1);
    assert.equal(result.request[0],'/czechia/arena/'+game+'/open-program');
    assert.equal(result.program.src,'/czechia/arena/'+game+'/broadcast.html?follow=desk&team=czechia&game='+game);
  }
  const unknown=await execute('#test-opaque-token',204,'?game=unknown');
  assert.equal(unknown.count,0);
  assert.equal(unknown.status.hidden,false);
});
test('expired or invalid token cannot silently render public GB tactical overlay',async()=>{
  const result=await execute('#expired-token',401);
  assert.equal(result.program.src,undefined);
  assert.equal(result.program.hidden,true);
  assert.equal(result.status.hidden,false);
  assert.match(result.message.textContent,/invalid or expired/);
  assert.ok(!result.warnings.join(' ').includes('expired-token'),'do not log secrets');
  assert.doesNotMatch(script,/program\.src\s*=\s*['"`]\/lg3s-gb\?mode=obs/);
});
test('missing token never requests public graphics or program exchange',async()=>{
  const result=await execute('',204);
  assert.equal(result.count,0);
  assert.equal(result.program.src,undefined);
  assert.equal(result.status.hidden,false);
  assert.match(result.message.textContent,/No private program link/);
});
test('unavailable server or network error surfaces an explicit access problem',async()=>{
  for(const reply of [403,503,new Error('network failed')]){
    const result=await execute('#redacted',reply);
    assert.equal(result.program.src,undefined);
    assert.equal(result.program.hidden,true);
    assert.equal(result.status.hidden,false);
    assert.ok(result.message.textContent.length>35);
  }
});
test('OBS source HTML provides accessible instructions; public graphics distinguished',()=>{
 assert.match(html,/id="carbonAccessStatus"/);
 assert.match(html,/id="carbonAccessMessage"/);
 assert.match(html,/role="status" aria-live="polite"/);
 assert.match(html,/lg3s-carbon-source\.js\?v=[\w-]+/);
 assert.match(desk,/GBR WEB GRAPHICS · PUBLIC TACTICAL PREVIEW, NOT CARBON/);
 assert.match(desk,/data-preview="lineup"[^>]+>Web Tactics<\/button>/);
 assert.match(desk,/Copy Carbon Arena OBS URL/);
 assert.match(desk,/1920 × 1080 at 60 FPS/);
 assert.match(desk,/Control audio via OBS/);
 assert.match(api,/const PROGRAM_TTL = 90 \* 24 \* 60 \* 60/);
 assert.match(api,/const PREVIEW_TTL = 60 \* 60/);
});
