// Local fixtures only: no production credentials, writes, downloads or AI jobs.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const M = require('./hitmen-postgame-model.js');
const game = {id:'g1',season:55,source_url:'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&gameid=917001'};
assert.equal(M.lgId(game),917001);
assert.equal(M.lgId({...game,source_url:'https://evil.test/?gameid=917001'}),null);
assert.equal(M.final({status:'final',calgary_score:null,opponent_score:0}),false);
assert.throws(()=>M.draft({status:'scheduled'}),/final score/);
assert.equal(M.matches({source_metrics:{team:'Calgary Hitmen',season:55,schedule_game_id:'other',lg_game_id:917001}},game),false);
assert.equal(M.matches({source_metrics:{team:'Calgary Hitmen',season:55,lg_game_id:917001}},game),true);
assert.equal(M.matches({source_metrics:{team:'Calgary Hitmen',season:54,lg_game_id:917001}},game),false);
assert.deepEqual(M.approved([{status:'complete',analysis_summary:'saved'},{status:'complete',analysis_summary:'old',archived_at:'date'},{status:'needs_review',analysis_summary:'pending'}]).map(s=>s.analysis_summary),['saved']);
assert.equal(M.canRead({user:{id:'other'},memberships:[{team_id:'other',role:'gm'}]}),false);
assert.equal(M.canPublish({user:{id:'gm'},memberships:[{team_id:M.TEAM,role:'gm'}]}),false);

function fixture() {
  const TEAM='b0bcbdda-da9d-419d-8f61-b34937966d49';
  window.calls=[]; window.writes=[]; window.delays={}; window.failTable=null;
  window.rows={
    hitmen_schedule_games:Array.from({length:66},(_,i)=>({
      id:'g'+i,team_id:TEAM,season:55,week:1+Math.floor(i/9),scheduled_at:new Date(Date.UTC(2026,8,28+i,1)).toISOString(),
      opponent_name:i<2?'Same Opponent':'Opponent '+i,status:i<2?'final':'scheduled',
      calgary_score:i<2?4:null,opponent_score:i<2?2:null,overtime:false,
      source_url:'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&gameid='+(917000+i)
    })),
    media_posts:[{id:'p0',post_type:'recap',title:'Reviewed existing recap',body:'Saved reviewed evidence at 00:40:10.',
      season:'S55',published:true,published_at:'2026-09-29T00:00:00Z',updated_at:'v1',author_id:'original',
      source_metrics:{team:'Calgary Hitmen',season:55,schedule_game_id:'g0',lg_game_id:917000,three_stars:[{player:'Verified GT'}]}}],
    vod_review_sessions:[{id:'v0',team_id:TEAM,schedule_game_id:'g0',title:'Approved footage',status:'complete'}]
  };
  const val=(r,k)=>k.includes('->>')?String(r[k.split('->>')[0]]?.[k.split('->>')[1]]):r[k];
  function query(table) {
    window.calls.push(table);
    if(!Object.hasOwn(window.rows,table))throw new Error('Unexpected table: '+table);
    const filters=[],orders=[]; let payload,method,start=0,end=Infinity,single=false;
    const q={
      select(){return q},eq(k,v){filters.push(r=>val(r,k)===v);return q},
      or(s){const parts=s.split(',').map(p=>p.split('.eq.'));filters.push(r=>parts.some(([k,v])=>val(r,k)===v));return q},
      order(k,o={}){orders.push([k,o.ascending!==false]);return q},
      range(a,b){start=a;end=b;return q},limit(n){end=n-1;return q},
      update(v){payload=v;method='update';return q},insert(v){payload=v;method='insert';return q},
      single(){single=true;return q},maybeSingle(){single=true;return q},
      async then(resolve,reject) {
        try {
          let rows=window.rows[table].filter(r=>filters.every(f=>f(r)));
          let data;
          if(method) {
            window.writes.push({table,method,payload:structuredClone(payload)});
            if(method==='insert'){const r={id:'new-'+window.writes.length,...payload,updated_at:payload.updated_at||'new'};window.rows[table].push(r);rows=[r];}
            else rows.forEach(r=>Object.assign(r,payload));
          }
          for(const [k,asc] of [...orders].reverse()) rows.sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*(asc?1:-1));
          data=structuredClone(rows.slice(start,end+1));
          const key=table==='media_posts'?data[0]?.source_metrics?.schedule_game_id:table==='vod_review_sessions'?data[0]?.schedule_game_id:null;
          if(window.delays[key])await new Promise(r=>setTimeout(r,window.delays[key]));
          if(window.failTable===table)return resolve({data:null,error:{message:'Fixture read failure'}});
          return resolve({data:single?data[0]||null:data,error:single&&method&&!data.length?{message:'Concurrent update'}:null});
        }catch(e){return reject(e);}
      }
    };return q;
  }
  const role=new URLSearchParams(location.search).get('role');
  const state=role==='anon'?{}:{user:{id:'admin-user'},profile:{role:role==='other'?'player':'admin'},memberships:role==='other'?[{team_id:'other',role:'gm',active:true}]:[]};
  window.VVHLBackend={db:{from:query},state};
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const u=new URL(route.request().url()),name=u.pathname.slice(1);
      if(u.hostname!=='wildman.test')return route.fulfill({contentType:'application/javascript',body:''});
      if(name==='empty')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
      if(name==='backend.js')return route.fulfill({contentType:'application/javascript',body:'('+fixture.toString()+')();'});
      if(['script.js','ui-polish.js'].includes(name))return route.fulfill({contentType:'application/javascript',body:''});
      const file=path.join(__dirname,name);
      if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
    });
    const open=async(query='schedule=g0')=>{
      await page.goto('https://wildman.test/postgame-desk.html?'+query);
      if(!query.includes('role='))await page.waitForFunction(()=>document.getElementById('reportGameSelect').options.length===66&&!document.getElementById('reportHeadline').disabled);
    };
    await open('role=anon');
    assert.equal(await page.locator('[data-management-content]').isVisible(),false);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    await open('role=other');
    assert.equal(await page.locator('[data-management-content]').isVisible(),false);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    await open();
    assert.equal(await page.locator('#reportGameSelect option').count(),66);
    assert.match(await page.locator('#scheduleMessage').innerText(),/66 Hitmen games/);
    assert.equal(await page.locator('#reportHeadline').inputValue(),'Reviewed existing recap');
    assert.match(await page.locator('#vodReviewLinks a').getAttribute('href'),/review=v0/);
    assert.equal(await page.locator('#createGameVodBtn').isVisible(),false);
    assert.equal(await page.evaluate(()=>window.writes.length),0,'Opening desk must not write or auto-publish');
    assert.equal(await page.evaluate(()=>window.calls.some(t=>t.startsWith('esports_')||t==='postgame_media_jobs')),false);
    await page.locator('#reportAnalyst').fill('Human edit with preserved 00:40:10 evidence.');
    await page.locator('#saveReportDraftBtn').click();
    await page.waitForFunction(()=>document.getElementById('reportSaveMessage').textContent.includes('Published to'));
    const saved=await page.evaluate(()=>window.rows.media_posts[0]);
    assert.equal(saved.published,true);
    assert.equal(saved.author_id,'original');
    assert.equal(saved.published_at,'2026-09-29T00:00:00Z');
    assert.deepEqual(saved.source_metrics.three_stars,[{player:'Verified GT'}]);
    await page.locator('#reportGameSelect').selectOption('g1');
    await page.waitForFunction(()=>!document.getElementById('generateReportBtn').disabled);
    assert.equal(await page.locator('#reportAnalyst').inputValue(),'','Same opponent must not copy the other game');
    await page.locator('#generateReportBtn').click();
    assert.match(await page.locator('#reportAnalyst').inputValue(),/Review the linked period evidence/);
    await page.locator('#publishReportBtn').click();
    await page.waitForFunction(()=>document.getElementById('reportSaveMessage').textContent.includes('Published to'));
    assert.equal(await page.evaluate(()=>window.rows.media_posts[1].source_metrics.schedule_game_id),'g1');
    await page.locator('#reportGameSelect').selectOption('g2');
    await page.waitForFunction(()=>document.getElementById('vodMessage').textContent.includes('No VOD'));
    assert.equal(await page.locator('#publishReportBtn').isDisabled(),true);
    assert.equal(await page.locator('#generateReportBtn').isDisabled(),true);
    assert.equal(await page.locator('#reportAnalyst').inputValue(),'');
    assert.doesNotMatch(await page.locator('#reportFactsPreview').innerText(),/0–0/);
    await page.locator('#createGameVodBtn').click();
    await page.waitForFunction(()=>document.getElementById('vodMessage').textContent.includes('Review created'));
    assert.equal(await page.locator('#vodReviewLinks a').count(),1);
    const created=await page.evaluate(()=>window.rows.vod_review_sessions.at(-1));
    assert.equal(created.schedule_game_id,'g2');assert.equal(created.status,'queued');assert.equal(created.team_id,M.TEAM);
    // Stale responses may not replace the newly selected game's editor or VOD links.
    await page.evaluate(()=>window.delays.g0=250);
    await page.locator('#reportGameSelect').selectOption('g0');
    await page.locator('#reportGameSelect').selectOption('g3');
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#reportAnalyst').inputValue(),'');
    assert.equal(await page.locator('#vodReviewLinks a').count(),0);
    // A read failure cannot be mistaken for "no recap": writing stays disabled.
    await page.evaluate(()=>window.failTable='media_posts');
    await page.locator('#reportGameSelect').selectOption('g4');
    await page.waitForFunction(()=>document.getElementById('reportState').textContent.includes('could not load'));
    assert.equal(await page.locator('#saveReportDraftBtn').isDisabled(),true);
    await page.evaluate(()=>{window.failTable=null;window.delays={};});
    await page.locator('#reportGameSelect').selectOption('g0');
    await page.waitForFunction(()=>!document.getElementById('reportAnalyst').disabled);
    await page.locator('#reportAnalyst').fill('Unsaved local edit');
    await page.evaluate(()=>window.rows.media_posts[0].updated_at='changed-elsewhere');
    await page.locator('#saveReportDraftBtn').click();
    await page.waitForFunction(()=>document.getElementById('reportSaveMessage').textContent.includes('changed elsewhere'));
    assert.notEqual(await page.evaluate(()=>window.rows.media_posts[0].body),'Unsaved local edit');
    // Sign-out clears private evidence immediately and prevents a pending load restoring it.
    await page.evaluate(()=>{window.VVHLBackend.state={};window.dispatchEvent(new Event('vvhl-auth-change'));});
    assert.equal(await page.locator('#reportAnalyst').inputValue(),'');
    assert.equal(await page.locator('[data-management-content]').isVisible(),false);
    await open();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'Mobile layout should not scroll sideways');
    // The real VOD handoff must await its cached Promise and use schedule identity.
    await page.goto('https://wildman.test/empty');
    await page.setContent('<div class="vod-row active" data-vod-id="v0"></div><div id="vodPipelineVisual"></div>');
    await page.evaluate(()=>{
      window.VVHLBackend={db:{from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:[{id:'recap',published:true}]})};return q;}}};
      window.WildmanVODCache={review:async()=>{await new Promise(r=>setTimeout(r,20));return {id:'v0',schedule_game_id:'g0'};}};
    });
    await page.addScriptTag({path:path.join(__dirname,'vod-postgame-link.js')});
    await page.waitForFunction(()=>document.getElementById('vodHandoffTitle')?.textContent==='Hitmen recap published ✓');
    assert.match(await page.locator('#vodHandoffBtn').getAttribute('href'),/schedule=g0/);
    assert.deepEqual(errors,[]);
    console.log('PASS: 66-game schedule, exact game links, auth, no auto-writes, published preservation, optimistic edit conflict, pending finals, VOD setup, stale responses, read errors, mobile and async handoff');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
