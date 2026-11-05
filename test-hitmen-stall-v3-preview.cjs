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
const scripts=new Set(['hitmen-stall-v3-preview.js','management-guard.js','media-desk.js','hitmen-locker-shell.js','hitmen-team-locker.js','hitmen-stall-scene.js','hitmen-stall-upgrade.js','vod-review-model.js','hitmen-player-locker.js']);
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
    hitmen_roster_snapshot:[],hitmen_player_reports:[],
    team_player_game_reports:[
      {id:'stats-game-3',team_id:TEAM,season:55,locker_id:'11111111-1111-4111-8111-111111111111',
       week:3,game_date:'2026-10-14T01:00:00Z',schedule_game_id:'game-3',
       position_played:'LW',opponent_name:'Fixture Opponent',result:'W 2-1',
       stats:{goals:1,assists:0,points:1,shots:3,saves:0,shots_faced:0},
       evidence:{},ai_review_id:null},
      {id:'approved-game-3',team_id:TEAM,season:55,locker_id:'11111111-1111-4111-8111-111111111111',
       week:null,game_date:'2026-10-14T01:00:01Z',schedule_game_id:'game-3',
       position_played:'LW',opponent_name:'Fixture Opponent',
       stats:{},evidence:{verification:'approved'},ai_review_id:'review-3',
       coach_summary:'Film review note, identity not independently verified.'}
    ],
    team_player_weekly_reports:[
      {id:'weekly-3',team_id:TEAM,season:55,locker_id:'11111111-1111-4111-8111-111111111111',
       week:3,games_played:1,record:'1-0-0',summary:'Week 3 test report',
       strengths:'Scored a goal.',focus_next_week:'Review changes.',
       stats:{goals:1,assists:0,points:1,shots:3,plus_minus:0,partial_team_roster_games:1},
       evidence:[{type:'recorded_game_stats',schedule_game_id:'game-3'}]},
      {id:'weekly-2',team_id:TEAM,season:55,locker_id:'11111111-1111-4111-8111-111111111111',
       week:2,games_played:2,record:'1-1-0',summary:'Week 2 test report',
       strengths:'Two games.',focus_next_week:'Protect the puck.',
       stats:{goals:0,assists:1,points:1,shots:4},
       evidence:[]},
      {id:'weekly-1',team_id:TEAM,season:55,locker_id:'11111111-1111-4111-8111-111111111111',
       week:1,games_played:1,record:'0-1-0',summary:'Week 1 test report <img src=x>',
       strengths:'One game.',focus_next_week:'Support exits.',
       stats:{goals:0,assists:0,points:0,shots:2},
       evidence:[]}
    ],
    team_line_weekly_reports:[
      {id:'line-3',team_id:TEAM,season:55,week:3,line_label:'Fixture Unit Week 3',
       player_locker_ids:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'],
       games_played:2,stats:{shift_overlap_verified:false,team_record:'1-1-0'},
       summary:'Shared roster, not confirmed shared shifts.',next_adjustments:'Verify film.'},
      {id:'line-1',team_id:TEAM,season:55,week:1,line_label:'Fixture Unit Week 1',
       player_locker_ids:['11111111-1111-4111-8111-111111111111'],
       games_played:2,stats:{shift_overlap_verified:false},
       summary:'Older group context.',next_adjustments:'Review roles.'}
    ],
    lg_player_season_stats:[]
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
  const screenshots=path.join(root,'artifacts/locker-stalls-v3');
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
    for (const width of [390,768,1152,1440]) {
      const {page,context}=await pageFor(width);
      await page.goto(origin+'/hitmen-stall-v3-preview.html?player='+OWN);
      await page.waitForFunction(()=>document.getElementById('playerTitle')?.textContent==='Fixture Active');
      const scene=page.locator('#stallScene .v3-stage');
      assert.equal(await scene.count(),1,'V3 side-by-side scene present');

      const master=scene.locator('.v3-master-photo');
      assert.equal(await master.getAttribute('src'),'assets/hitmen-v3/locker-photo-master.webp?v=20261105-mobile-jersey-1','All viewports load the approved locker art, never legacy jersey files');
      assert.equal(await page.locator('nav.sub-bar a[aria-current="page"]').getAttribute('href'),'hitmen-stall-v3-preview.html','My Stall navigation stays in V3 preview instead of returning to legacy single jersey');
      assert.equal(await scene.locator('.v3-master-photo').count(),1,'Approved photographic locker layer exists');
      await scene.locator('.v3-master-photo').evaluate(img=>img.decode());
      assert.ok(await scene.locator('.v3-master-photo').evaluate(img=>img.naturalWidth>=1086),'Correct high-resolution locker source loads');
      assert.equal(await scene.locator('[data-v3="frontSleeve"]').count(),2,'Editable front jersey sleeve numbers');
      assert.equal(await scene.locator('[data-v3="backSleeve"]').count(),2,'Editable back jersey sleeve numbers');
      assert.equal(await scene.locator('[data-v3="jerseyName"]').count(),1,'Independent back jersey name layer');
      assert.equal(await scene.locator('[data-v3="jerseyNumber"]').count(),1,'Independent back jersey number layer');
      assert.equal(await scene.locator('[data-v3="plateName"]').textContent(),'FIXTURE ACTIVE');
      assert.equal(await scene.locator('[data-v3="jerseyNumber"]').textContent(),'19');
      assert.equal(await page.locator('#profileGoals').innerText(),'1','Uses fixture report stats, no invented stats');
      assert.ok(await page.locator('.v3-recent-table').count()===1,'Recent stats uses individual game data');
      assert.match(await page.locator('.v3-recent-table').innerText(),/Fixture Opponent/);
      assert.equal(await page.locator('.v3-development-card').count(),1,'Neutral pending development panel');
      assert.match(await page.locator('.v3-development-card').innerText(),/NOT YET RATED/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 2),'No horizontal overflow at '+width);
      if(width===390){
        const tiles=await page.locator('.stall-tab-panel[data-stall-panel="overview"] .reference-stat-strip > div').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().width)));
        assert.equal(tiles.length,5,'Five season stat panels on mobile');
        assert.ok(Math.abs(tiles[0]-tiles[1])<2&&Math.abs(tiles[1]-tiles[2])<2,'First mobile stat row is even');
        assert.ok(tiles[3]>tiles[0]&&Math.abs(tiles[3]-tiles[4])<2,'Final mobile stat row fills width evenly');
      }

      await page.locator('[data-stall-tab="settings"]').click();
      await page.locator('#jerseyNameInput').fill('SETTY');
      await page.locator('#jerseyNumberInput').fill('05');
      assert.equal(await scene.locator('[data-v3="plateName"]').textContent(),'SETTY','Live editable nameplate');
      assert.equal(await scene.locator('[data-v3="jerseyName"]').textContent(),'SETTY','Name synchronized to back jersey');
      assert.equal(await scene.locator('[data-v3="jerseyNumber"]').textContent(),'05','Number synchronized to back jersey');
      assert.equal(await scene.locator('[data-v3="frontSleeve"]').first().textContent(),'05','Front sleeve number sync');
      assert.equal(await page.evaluate(()=>window.lockerFixture.writes.length),0,'Preview changes make no database writes before saving');
      await page.locator('#v3EquipmentTarget').selectOption('gloves');
      await page.locator('#v3EquipmentFile').setInputFiles({
        name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+2gZ0AAAAASUVORK5CYII=','base64')
      });
      assert.match(await page.locator('#v3EquipmentMessage').textContent(),/locally. No data saved/);
      assert.equal(await page.evaluate(()=>window.lockerFixture.writes.length),0,'Gear screenshot never silently writes');
      await page.locator('#saveJersey').click();
      await page.waitForFunction(()=>document.getElementById('jerseySaveStatus')?.textContent.includes('Saved'));
      assert.equal(await page.evaluate(()=>window.lockerFixture.writes.length),1,'Authorized save uses existing data write exactly once');
      await page.locator('[data-stall-tab="overview"]').click();
      const hero=page.locator('#stall');await hero.scrollIntoViewIfNeeded();
      /* The local 1-pixel white upload is a test fixture, never show it in design screenshots. */
      await page.evaluate(()=>{
        document.querySelectorAll('#stallScene .v3-gear.has-photo').forEach(el=>{
          el.style.backgroundImage='';el.classList.remove('has-photo');
        });
      });
      await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
      await page.waitForTimeout(100);
      await page.screenshot({path:path.join(screenshots,'v3-'+width+'.png'),fullPage:true});

      if(width===390){
        await page.locator('nav.sub-bar a[aria-current="page"]').click();
        await page.waitForURL('**/hitmen-stall-v3-preview.html');
        await page.waitForFunction(()=>document.querySelector('#stallScene .v3-master-photo')?.naturalWidth>=1086);
        assert.ok(await page.locator('#stallScene .v3-master-photo').count()===1,'Mobile My Stall navigation retains the double-jersey master');
        assert.equal(await page.locator('#stallScene .hs-stall').count(),0,'Mobile navigation must not fall back to old single jersey');
      }
      await context.close();
    }
    // Private content must not load for anonymous / unrelated members.
    for (const options of [{signedIn:false},{role:'gm',team:'unrelated-team'}]) {
      const {page,context}=await pageFor(390,options);
      await page.goto(origin+'/hitmen-stall-v3-preview.html?player='+OWN);
      assert.equal(await page.locator('#hqApp').getAttribute('hidden'),'','Private dashboard hidden');
      assert.equal(await page.evaluate(()=>window.lockerFixture.reads.length),0,'No private data reads for unauthorized viewers');
      await context.close();
    }
    assert.deepEqual(errors,[],'No browser runtime errors in V3 preview');
    console.log('PASS: V3 double jerseys, live editable name/number, stats, local gear preview, private access, and 390/768/1152/1440 responsive layout');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
