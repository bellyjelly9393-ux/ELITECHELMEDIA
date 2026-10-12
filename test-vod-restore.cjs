// Deterministic DOM integration: real page scripts, isolated DB/worker fixtures.
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const wait=async(test)=>{for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,20));}throw new Error('DOM workflow timed out');};
(async()=>{
 const dom=new JSDOM(fs.readFileSync(__dirname+'/vod-lab.html','utf8'),{url:'https://wildman.test/vod-lab.html?review=game',runScripts:'outside-only',pretendToBeVisual:true});
 const observers=[];
 try{
  const w=dom.window;w.HTMLElement.prototype.scrollIntoView=()=>{};
  const Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this);}};
  const source=fs.readFileSync(__dirname+'/test-vod-browser.cjs','utf8');
  w.eval(source.slice(source.indexOf('const fixture='),source.indexOf('(async()=>'))+'\nfixture();');
  const rows=w.testRows,r=rows.vod_review_sessions[0];rows.vod_review_segments=[];
  rows.vod_review_sessions.push({...r,id:'filed',status:'archived',title:'Filed published game'});
  rows.vod_game_publications=[{review_id:'filed',team_id:'team',active:true,report:{summary:'Preserved approved report'}}];
  const rpc=w.VVHLBackend.db.rpc;
  w.VVHLBackend.db.rpc=async(name,args)=>{
   if(name==='set_vod_period_windows'){
    await rpc(name,args);
    rows.vod_review_segments=args.periods.map((p,i)=>({...p,id:'auto'+i,review_id:'game',team_id:'team',status:'queued',updated_at:'2026-10-12T01:00:00Z'}));
    return {data:{added:3}};
   }
   if(name==='import_vod_worker_draft'){
    r.worker_result=args.worker_result;r.pending_worker_result=null;r.status='reviewing';
    return {data:{imported:true}};
   }
   return rpc(name,args);
  };
  const calls=[];
  w.fetch=async(url,opts={})=>{
   const path=new URL(url).pathname;calls.push({path,opts});
   const body=path==='/health'?{aiConfigured:true}:path.endsWith('/analyze')?{job:{id:'job',status:'retrieving',result:{}}}:path.endsWith('/job')?{job:w.workerJob}:{};
   return {ok:true,json:async()=>body};
  };
  for(const f of ['vod-review-model.js','vod-review-cache.js','vod-lab.js','vod-pipeline.js'])w.eval(fs.readFileSync(__dirname+'/'+f,'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await wait(()=>w.document.querySelector('#vodAnalyzeGame')&&w.document.querySelector('[data-vod-id="game"]'));
  assert.ok(w.document.querySelector('[data-vod-id="filed"]'),'Filed published report remains accessible');
  const filter=w.document.getElementById('vodLibraryFilter');filter.value='active';filter.dispatchEvent(new w.Event('change'));
  assert.equal(w.document.querySelector('[data-vod-id="filed"]'),null);
  filter.value='reviewed';filter.dispatchEvent(new w.Event('change'));
  w.document.getElementById('vodAnalyzeGame').click();
  await wait(()=>calls.some(c=>c.path.endsWith('/analyze')));
  const payload=JSON.parse(calls.find(c=>c.path.endsWith('/analyze')).opts.body);
  assert.equal('periods' in payload,false,'Automatic intake must not send empty manual periods');
  assert.equal(rows.vod_review_segments.length,0);
  w.workerJob={id:'job',status:'ready_for_review',result:{period_detection:'replay_scoreboard',detected_periods:[
   {label:'Period 1',start:0,end:400},{label:'Period 2',start:400,end:800},{label:'Period 3',start:800,end:1460}
  ],period_reports:[1,2,3].map(n=>({label:'Period '+n,report:{summary:'Detected period '+n,player_report:'Player evidence',tactical_report:'Tactical evidence'}})),chunks:[],game_rollup:{summary:'Synthetic game report'}}};
  w.document.getElementById('vodCheckPipeline').click();
  await wait(()=>r.worker_result?.website_imported);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.vod_review_segments.map(p=>[p.start_seconds,p.end_seconds]))),[[1800,2200],[2200,2600],[2600,3260]]);
  assert.ok(rows.vod_review_segments.every(p=>p.status==='needs_review'&&p.analysis_summary));
  assert.equal(rows.vod_game_publications[0].active,true,'Unrelated filed publication is untouched');
  assert.equal(w.published.length,0,'Automatic evidence never grants management approval');
  const before=JSON.stringify(rows.vod_review_segments);
  w.document.getElementById('vodCheckPipeline').click();
  await new Promise(r=>setTimeout(r,80));
  assert.equal(JSON.stringify(rows.vod_review_segments),before,'Repeat import preserves existing periods');
  for(let i=0;i<3;i++){
   await wait(()=>w.document.querySelector('[data-quick-approve="auto'+i+'"]'));
   w.document.querySelector('[data-quick-approve="auto'+i+'"]').click();
   await wait(()=>rows.vod_review_segments[i].status==='complete');
  }
  await wait(()=>!w.document.getElementById('publishVodReport').disabled);
  w.document.getElementById('publishVodReport').click();
  await wait(()=>w.published.length===1);
  assert.equal(w.published[0].name,'publish_vod_review');
  await wait(()=>!w.document.getElementById('reviewDoneCheck').disabled);
  w.document.getElementById('reviewDoneCheck').click();
  w.document.getElementById('fileCompletedVod').click();
  await wait(()=>r.status==='archived');
  await wait(()=>w.document.querySelector('[data-vod-id="game"]'));
  assert.equal(rows.vod_game_publications[0].active,true);
  w.document.querySelector('[data-vod-id="game"]').click();
  await wait(()=>w.document.getElementById('vodAnalyzeGame').textContent==='View Reports');
  rows.vod_review_sessions.push({...r,id:'newgame',status:'queued',worker_status:null,worker_job_id:null,worker_result:{},review_document:null,pending_worker_result:null,full_game_summary:''});
  w.document.getElementById('refreshVod').click();
  await wait(()=>w.document.querySelector('[data-vod-id="newgame"]'));
  w.document.querySelector('[data-vod-id="newgame"]').click();
  await wait(()=>w.document.getElementById('vodAnalyzeGame').textContent==='Analyze Game');
  assert.equal(w.document.getElementById('publishVodStatus').textContent,'','A different game must not inherit the prior publication notice');
  console.log('PASS: filed library access, automatic intake, detected period import with absolute VOD offsets, saved reports, management approval/publication/filing, repeat import preservation');
 }finally{observers.forEach(o=>o.disconnect());dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
