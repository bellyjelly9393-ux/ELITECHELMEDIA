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
const scripts=new Set(['hitmen-team-locker-v3-preview.js','management-guard.js','media-desk.js','hitmen-locker-shell.js','hitmen-team-locker.js','hitmen-stall-scene.js','hitmen-stall-upgrade.js','vod-review-model.js','hitmen-player-locker.js']);
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
  const screenshots=path.join(root,'artifacts/locker-room-v3');
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
    for(const width of [390,768,1152,1440]){
      const {page,context}=await pageFor(width);
      await page.goto(origin+'/hitmen-locker-v3-preview.html');
      assert.equal(new URL(page.url()).pathname,'/hitmen-locker-v3-preview.html');
      await page.waitForSelector('#lockerRoster .v3-room-jersey');
      assert.equal(await page.locator('#lockerRoster .v3-room-jersey').count(),2,'Active roster uses V3 double-jersey stages');
      assert.equal(await page.locator('#lockerTcRoster .v3-room-jersey').count(),2,'Both training camp roster classes retain double jerseys');
      assert.equal(await page.locator('#lockerRosterCount').innerText(),'2','Active count');
      assert.equal(await page.locator('#lockerTcCount').innerText(),'2','Training camp count');
      assert.equal(await page.locator('.locker-stall').filter({hasText:'Fixture Archived'}).count(),0,'Historical players excluded');
      assert.equal(await page.locator('#lockerRoster a').first().getAttribute('href'),'hitmen-stall-v3-preview.html?player='+OWN,'Player card opens the V3 double-jersey detail');
      assert.ok((await page.locator('.v3-roster-notice').innerText()).includes('ROSTER UPDATE PENDING'),'Trades not guessed before actual roster shared');
      assert.equal(await page.locator('.v3-room-jersey .v3-master-photo').count(),4,'Each locker uses approved shared master artwork');
      const images=await page.locator('.v3-room-jersey .v3-master-photo').all();
      for(const img of images){
        await img.evaluate(node=>node.decode());
        assert.ok(await img.evaluate(node=>node.naturalWidth>0),'Approved locker artwork loads');
      }
      assert.equal(await page.locator('#lockerRoster .v3-master-backname').first().textContent(),'FIXTURE ACTIVE','Jersey uses saved player identity');
      assert.equal(await page.locator('#lockerRoster .v3-master-backnumber').first().textContent(),'19','Jersey uses saved number');
      assert.equal(await page.locator('#lockerRoster .v3-master-sleeve').count(),8,'All front/back sleeve numbers rendered');
      assert.equal(await page.locator('#lockerRoster .v3-master-photo[src*="hitmen-stall"]').count(),0,'No legacy single-jersey artwork');
      const style=await page.evaluate(()=>{
        const e=document.querySelector('#lockerRoster .locker-stall');
        const img=document.querySelector('#lockerRoster .v3-room-jersey');
        return {
          columns:getComputedStyle(document.getElementById('lockerRoster')).gridTemplateColumns.split(' ').length,
          width:parseFloat(getComputedStyle(e).borderTopWidth),
          font:getComputedStyle(e.querySelector('.stall-nameplate strong')).fontFamily,
          ratio:img.getBoundingClientRect().width/img.getBoundingClientRect().height,
          screenOverflow:document.documentElement.scrollWidth>innerWidth+2
        };
      });
      assert.equal(style.columns,width<=650?1:2,'One phone column; two desktop columns');
      assert.ok(style.width >= (width<=650?5:6),'Substantial 3D metallic border');
      assert.match(style.font,/Anton/i,'LGCHL match header font');
      assert.ok(Math.abs(style.ratio-1086/639)<.06,'Photo proportions preserved');
      assert.equal(style.screenOverflow,false,'No horizontal clipping at '+width);
      assert.equal(await page.evaluate(()=>window.lockerFixture.writes.length),0,'No roster or stats mutated by preview');
      await page.screenshot({path:path.join(screenshots,'room-v3-'+width+'.png'),fullPage:true});
      await context.close();
    }
    const own=await pageFor(390,{role:'player'});
    await own.page.goto(origin+'/hitmen-locker-v3-preview.html');
    await own.page.waitForSelector('#lockerRoster .v3-room-jersey');
    assert.equal(await own.page.locator('#lockerRoster a').count(),1,'Player can open only their own stall');
    assert.equal(await own.page.locator('#lockerRoster a').first().getAttribute('href'),'hitmen-stall-v3-preview.html?player='+OWN);
    await own.context.close();
    for(const options of [{signedIn:false},{role:'gm',team:'unrelated-team'}]){
      const {page,context}=await pageFor(390,options);
      await page.goto(origin+'/hitmen-locker-v3-preview.html');
      assert.equal(await page.locator('#hqApp').getAttribute('hidden'),'','Unauthorized team locker stays gated');
      assert.equal(await page.evaluate(()=>window.lockerFixture.reads.length),0,'Unauthorized visitor cannot read team lockers');
      await context.close();
    }
    assert.deepEqual(errors,[],'No browser runtime errors');
    console.log('PASS: V3 locker room double-jersey artwork, real roster identities, TC segregation, private access, safe links, 390/768/1152/1440 responsiveness.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
