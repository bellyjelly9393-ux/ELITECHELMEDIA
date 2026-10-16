const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
const raw=fs.readFileSync('supabase/functions/lgchl-league-sync/index.ts','utf8');
function harness({expired=false,status=403}={}){
 let handler,paused=false,requests=0;const calls=[],pauses=[];
 const db={
  from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{value:'offline-test-token'}})}),
  rpc:async(name,args)=>{
   calls.push({name,args});
   let data=null;
   if(name==='lgchl_media_acquire_lease')data=!paused;
   if(name==='lgchl_media_before_fetch')data=new Date(Date.now()+(expired?-1000:180000)).toISOString();
   if(name==='lgchl_media_fail_box'&&args.p_challenge)paused=true;
   return {data,error:null};
  }
 };
 const context={
  Deno:{env:{get:k=>k==='LGCHL_PUBLIC_BOX_SCORES_ENABLED'?'true':'offline-test-value'},serve:f=>handler=f},
  createClient:()=>db,crypto:webcrypto,TextEncoder,Request,Response,Headers,AbortSignal,URL,
  setTimeout:(fn,ms)=>{pauses.push(ms);queueMicrotask(fn);return 0},
  fetch:async()=>{requests++;return new Response('Blocked offline example',{status})},
  isChallenge:code=>code===403,parseStandings:()=>[],standingsUrl:()=> 'https://www.leaguegaming.com/offline-test',
  drainPublicBoxes:async()=>({}),console
 };
 vm.runInNewContext(stripTypeScriptTypes(raw.replace(/^import .*$/gm,'')),context);
 const probe=()=>handler(new Request('https://example.invalid/sync',{method:'POST',headers:{'x-sync-token':'offline-test-token','Content-Type':'application/json'},body:JSON.stringify({action:'probe'})}));
 return {probe,calls,pauses,get requests(){return requests}};
}
test('probe challenge uses the guarded fetcher, persists the pause and blocks a subsequent probe',async()=>{
 const h=harness();
 assert.equal((await h.probe()).status,502);
 assert.equal(h.requests,1);
 assert.ok(h.calls.some(c=>c.name==='lgchl_media_before_fetch'));
 const fail=h.calls.find(c=>c.name==='lgchl_media_fail_box');
 assert.equal(fail.args.p_lg_game_id,null);assert.equal(fail.args.p_challenge,true);
 assert.deepEqual(h.pauses,[1500],'The polite delay still follows a failed LG request');
 const response=await h.probe();assert.equal(response.status,200);
 assert.equal((await response.json()).idle,true);assert.equal(h.requests,1,'Paused sync cannot contact LG again');
});
test('expired pre-fetch lease blocks a probe before any LG request',async()=>{
 const h=harness({expired:true,status:200});
 assert.equal((await h.probe()).status,502);assert.equal(h.requests,0);assert.equal(h.pauses.length,0);
});
