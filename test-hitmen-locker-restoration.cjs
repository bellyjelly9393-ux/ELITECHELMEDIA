// Offline regression: real locker pages/scripts/styles with isolated auth/data fixtures.
// No production requests, sessions, database writes or credentials are used.
const {chromium}=require('playwright');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const assert=require('node:assert/strict');
const TEAM='b0bcbdda-da9d-419d-8f61-b34937966d49';
const OWN='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const TC='33333333-3333-4333-8333-333333333333';
const root=process.cwd();
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
assert.ok(!(config.redirects||[]).some(r=>r.source==='/hitmen-team-locker.html'),'Keep the existing full Lineup Lab reachable from its locker-room tool URL');
const scripts=new Set(['management-guard.js','media-desk.js','hitmen-locker-shell.js','hitmen-team-locker.js','hitmen-stall-scene.js','hitmen-stall-upgrade.js','vod-review-model.js','hitmen-player-locker.js']);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const redirect=(config.redirects||[]).find(r=>r.source===url.pathname);
  if(redirect){
    const next=new URL(redirect.destination,url);
    url.searchParams.forEach((v,k)=>{if(!next.searchParams.has(k))next.searchParams.append(k,v);});
    res.writeHead(307,{Location:next.pathname+next.search});return res.end();
  }
  const filename=path.resolve(root,'.'+url.pathname);
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);return res.end();}
  const ext=path.extname(filename);
  let data=fs.readFileSync(filename);
  if(ext==='.html')data=data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>{
    const src=/\bsrc="([^"]+)"/.exec(tag)?.[1]?.split('?')[0];
    return scripts.has(src)?tag:'';
  });
  res.setHeader('Content-Type',mime[ext]||'application/octet-stream');res.end(data);
});
function fixture({role='gm',team='b0bcbdda-da9d-419d-8f61-b34937966d49',signedIn=true}={}){
  const TEAM='b0bcbdda-da9d-419d-8f61-b34937966d49';
  const user=signedIn?{id:'fixture-user'}:null;
  const state={user,profile:{role:'member'},memberships:user?[{team_id:team,role,active:true}]:[]};
  const make=(id,gamertag,roster_class,extra={})=>({id,gamertag,team_id:TEAM,season:55,roster_class,position:'C',jersey_name:gamertag,jersey_number:'19',...extra});
  const tables={
    team_player_lockers:[
      make('11111111-1111-4111-8111-111111111111','Fixture Active','active_roster',{user_id:'fixture-user'}),
      make('22222222-2222-4222-8222-222222222222','Fixture Teammate','active_roster',{jersey_number:'21'}),
      make('33333333-3333-4333-8333-333333333333','Fixture Camp','training_camp',{position:'G',jersey_number:'35'}),
      make('44444444-4444-4444-8444-444444444444','Fixture TC','tc',{jersey_number:null}),
      make('55555555-5555-4555-8555-555555555555','Fixture Archived','historical')
    ],
    hitmen_roster_snapshot:[],hitmen_player_reports:[],team_player_game_reports:[],
    team_player_weekly_reports:[],team_line_weekly_reports:[],lg_player_season_stats:[]
  };
  window.lockerFixture={tables,reads:[],writes:[]};
  class Query{
    constructor(table){this.table=table;this.filters=[];this.max=Infinity;}
    select(){return this;}
    eq(k,v){this.filters.push(r=>r[k]===v);return this;}
    ilike(k,v){this.filters.push(r=>String(r[k]||'').toLowerCase()===String(v).toLowerCase());return this;}
    order(){return this;}
    limit(n){this.max=n;return this;}
    maybeSingle(){this.one=true;return this;}
    single(){this.one=true;return this;}
    update(payload){this.payload=payload;return this;}
    then(resolve,reject){
      window.lockerFixture.reads.push(this.table);
      const rows=(tables[this.table]||[]).filter(r=>this.filters.every(f=>f(r))).slice(0,this.max);
      if(this.payload){
        window.lockerFixture.writes.push({table:this.table,payload:this.payload});
        rows.forEach(r=>Object.assign(r,this.payload));
      }
      const error=this.one&&rows.length>1?{message:'Ambiguous fixture match'}:null;
      return Promise.resolve({data:this.one?rows[0]||null:rows,error}).then(resolve,reject);
    }
  }
  window.VVHLBackend={state,db:{from:table=>new Query(table),auth:{getUser:async()=>({data:{user}})},rpc:async()=>({data:{matched:false},error:null})}};
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const screenshots=path.join(root,'artifacts/locker-stalls');
  fs.mkdirSync(screenshots,{recursive:true});
  const errors=[];
  async function pageFor(width,options){
    const context=await browser.newContext({viewport:{width,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await context.addInitScript(fixture,options||{});
    const page=await context.newPage();
    page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
    return {page,context};
  }
  try{
    for(const width of [360,390,768,1440]){
      const {page,context}=await pageFor(width);
      await page.goto(origin+'/hitmen-locker.html');
      assert.equal(new URL(page.url()).pathname,'/hitmen-locker.html');
      assert.equal(await page.locator('header.top').count(),1,'Shared Headquarters header');
      assert.equal(await page.locator('nav.sub-bar a[aria-current="page"]').textContent(),'Locker Room');
      assert.equal(await page.locator('script[src*="hitmen-rooms.js"]').count(),0,'Use original full locker controller');
      await page.waitForSelector('#lockerRoster .hs-stall');
      assert.equal(await page.locator('#lockerRoster .hs-stall').count(),2,'Active roster photo stalls');
      assert.equal(await page.locator('#lockerTcRoster .hs-stall').count(),2,'Both TC roster classes have stalls');
      assert.equal(await page.locator('#lockerRosterCount').innerText(),'2');
      assert.equal(await page.locator('#lockerTcCount').innerText(),'2');
      assert.equal(await page.locator('.locker-stall').filter({hasText:'Fixture Archived'}).count(),0);
      assert.equal(await page.locator('#lockerRoster a').first().getAttribute('href'),'hitmen-stall.html?player='+OWN);
      await page.locator('#lockerRoster .hs-img').first().scrollIntoViewIfNeeded();
      await page.locator('#lockerRoster .hs-img').first().evaluate(img=>img.decode());
      assert.ok(await page.locator('#lockerRoster .hs-img').first().evaluate(img=>img.naturalWidth>0),'Original stall art loads');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Team room fits '+width);
      await page.locator('#hnRoomTitle').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(screenshots,'team-'+width+'.png')});
      if([390,1440].includes(width))console.log('LOCKER_VISUAL team '+width+' '+(await page.screenshot({type:'jpeg',quality:50})).toString('base64'));
      await page.locator('#lockerRoster a').first().click();
      await page.waitForFunction(()=>document.getElementById('playerTitle').textContent==='Fixture Active');
      await page.locator('#stallScene .hs-img').first().evaluate(img=>img.decode());
      assert.equal(await page.locator('#stallScene .hs-name').innerText(),'FIXTURE ACTIVE');
      assert.equal(await page.locator('#stallScene .hs-bnum').innerText(),'19');
      await page.locator('#jerseyBackBtn').click();
      assert.ok(await page.locator('#stallScene .hs-stall').evaluate(el=>el.classList.contains('is-back')),'Jersey flips');
      await page.locator('[data-stall-tab="settings"]').click();
      await page.locator('#jerseyNameInput').fill('UPDATED FIXTURE');
      await page.locator('#jerseyNumberInput').fill('27');
      await page.locator('#saveJersey').click();
      await page.waitForFunction(()=>document.getElementById('jerseySaveStatus').textContent.includes('Saved'));
      assert.equal(await page.locator('#stallScene .hs-name').innerText(),'UPDATED FIXTURE');
      assert.equal(await page.locator('#stallScene .hs-bnum').innerText(),'27');
      assert.equal(await page.locator('.hitmen-app-sidebar').count(),0,'No duplicate legacy sidebar');
      assert.equal(await page.locator('.sub-in a[aria-current="page"]').textContent(),'My Stall');
      assert.equal(await page.evaluate(()=>window.lockerFixture.writes.length),1,'One isolated customization write');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Player stall fits '+width);
      await page.locator('[data-stall-tab="overview"]').click();
      await page.locator('#stall').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(screenshots,'player-'+width+'.png')});
      if([390,1440].includes(width))console.log('LOCKER_VISUAL player '+width+' '+(await page.screenshot({type:'jpeg',quality:50})).toString('base64'));
      await context.close();
    }
    const shared=await pageFor(390);
    await shared.page.goto(origin+'/hitmen-hq.html');
    const rooms=await shared.page.locator('.sub-in a').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
    assert.equal(rooms.filter(p=>p==='hitmen-hq.html').length,1,'One merged headquarters destination');
    assert.equal(await shared.page.locator('#hitmen-live-session').count(),1,'Game-night War Room controls stay in Headquarters');
    await shared.page.goto(origin+'/hitmen-locker.html');
    await shared.page.waitForSelector('#lockerRoster .hs-stall');
    assert.deepEqual(await shared.page.locator('.sub-in a').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),rooms,'Same room navigation as Headquarters');
    const readsBefore=await shared.page.evaluate(()=>window.lockerFixture.reads.length);
    await shared.page.evaluate(()=>{window.VVHLBackend.state.user=null;window.dispatchEvent(new Event('vvhl-auth-change'));});
    assert.equal(await shared.page.locator('#hqApp').getAttribute('hidden'),'','Team content hides on signout');
    assert.equal(await shared.page.locator('.locker-stall').count(),0,'Stalls clear on signout');
    assert.equal(await shared.page.evaluate(()=>window.lockerFixture.reads.length),readsBefore,'Signout does not re-query private data');
    await shared.context.close();
    // Alias bookmarks keep UUIDs and view parameters; legacy names canonicalize after auth.
    for(const player of [OTHER,'Fixture Teammate']){
      const {page,context}=await pageFor(390);
      await page.goto(origin+'/hitmen-player-locker.html?player='+encodeURIComponent(player)+'&view=stats#games');
      await page.waitForFunction(()=>document.getElementById('playerTitle').textContent==='Fixture Teammate');
      const url=new URL(page.url());
      assert.equal(url.pathname,'/hitmen-stall.html');
      assert.equal(url.searchParams.get('player'),OTHER);
      assert.equal(url.searchParams.get('view'),'stats');
      assert.equal(url.hash,'#games');
      await context.close();
    }
    const owned=await pageFor(390,{role:'player'});
    await owned.page.goto(origin+'/hitmen-team-locker.html');
    await owned.page.waitForSelector('#lockerRoster .hs-stall');
    assert.equal(await owned.page.locator('#lockerRoster a').count(),1,'Player can open own stall only');
    await owned.page.goto(origin+'/hitmen-stall.html?player='+OTHER);
    await owned.page.waitForFunction(()=>document.getElementById('playerTitle').textContent==='Fixture Active');
    assert.equal(await owned.page.locator('#playerTitle').textContent(),'Fixture Active','Another player link cannot expose another dossier');
    await owned.context.close();
    for(const options of [{signedIn:false},{role:'gm',team:'unrelated-team'}]){
      for(const url of ['/hitmen-locker.html','/hitmen-stall.html?player='+OWN]){
        const {page,context}=await pageFor(390,options);
        await page.goto(origin+url);
        const content=page.locator('[data-management-content],[data-locker-content]');
        assert.equal(await content.getAttribute('hidden'),'','Unauthorized content remains gated');
        assert.equal(await page.evaluate(()=>window.lockerFixture.reads.length),0,'Unauthorized visitors do not query private data');
        await context.close();
      }
    }
    assert.deepEqual(errors,[],'No browser runtime errors');
    console.log('PASS: restored aliases, canonical IDs and legacy links, active/TC photo stalls, jersey flips/customization, private access, 360/390/768/1440 layouts');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
