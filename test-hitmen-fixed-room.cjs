/* Browser checks for the opt-in public fixed-camera concept. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/lgchl/rosters/main-rosters-s55.json'))),roster=snapshot.teams['412'].players;
const games=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/lgchl/room-360/public-games-preview.json')));
const server=http.createServer((req,res)=>{
 const file=path.resolve(__dirname,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(__dirname+path.sep)){res.writeHead(403).end();return;}
 try{const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};res.setHeader('Content-Type',types[path.extname(file)]||'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
 const origin='http://127.0.0.1:'+server.address().port;
 async function create(width=1440,mode='normal',team=412){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<700,hasTouch:width<700,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://lrgllzvwgvqagcpiyvfd.supabase.co/**',r=>{const url=new URL(r.request().url());return url.pathname.endsWith('lgchl_games_board')?r.fulfill({json:url.searchParams.get('status')==='eq.final'?games.finals:games.upcoming}):r.fulfill({status:503,body:'Live statistics disconnected'});});
  if(mode!=='normal')await page.route('**/main-rosters-s55.json*',r=>{if(mode==='loading')return;if(mode==='failed')return r.fulfill({status:503,body:'unavailable'});const data=structuredClone(snapshot);data.teams['412'].players=mode==='empty'?[]:roster.concat(roster[0]);return r.fulfill({json:data});});
  await page.goto(origin+'/lgchl-team.html?team='+team+'&room=angles');return {page,context,errors};
 }
 const shot=async(page,name)=>{if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('.tour-shell').screenshot({path:path.join(process.env.SCREENSHOT_DIR,name+'.png')});}};
 for(const width of [1440,390]){
  const {page,context,errors}=await create(width);
  await page.waitForFunction(()=>window.HitmenFixedRoom?.getState().players.length===17);
  assert.deepEqual(await page.evaluate(()=>window.HitmenFixedRoom.getState().players),roster.map(p=>p.lg_user_id));
  assert.equal(await page.locator('.angle-stall').count(),5);assert(await page.locator('#roomPlayers').isHidden());
  for(const [bank,count] of [[0,6],[1,5],[2,6]]){
   await page.locator('.angle-tabs button').nth(bank).click();assert.equal(await page.locator('.angle-stall').count(),count);
   await page.waitForFunction(()=>document.querySelector('.angle-background').naturalWidth===1536);
   assert((await page.locator('.angle-stall>img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')))).every(src=>src==='assets/lgchl/jerseys/team412.webp'));
   await shot(page,'fixed-room-'+bank+'-'+width);
  }
  assert(await page.locator('#angleNext').isDisabled());await page.locator('.angle-scene').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.getState().bank),1);await page.keyboard.press('ArrowLeft');assert(await page.locator('#anglePrevious').isDisabled());
  for(const [index,p] of roster.entries()){
   assert(await page.evaluate(id=>window.HitmenPublicRoom.focusStall(id),p.lg_user_id));
   assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.getState().bank),index<6?0:index<11?1:2);
   const selected=page.locator('.angle-stall.is-selected');await selected.waitFor();
   assert.equal(await selected.getAttribute('data-player-id'),String(p.lg_user_id));assert.equal(await selected.getAttribute('aria-current'),'true');
   await selected.click();assert(await page.locator('.fixed-room-level').isHidden());assert.equal(await page.locator('.stall-level-name').textContent(),p.gamertag);assert.equal(await page.locator('.stall-closeup-position').textContent(),p.position);assert.equal(await page.locator('.stall-public-card').getAttribute('href'),'lgchl-player.html?id='+p.lg_user_id+'&kind='+p.player_kind);
   await page.locator('.stall-return').click();assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.getState().view),'room');
  }
  assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.openStall(999999)),false);assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.focusStall(999999)),false);assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.setBank('1')),false);
  await page.locator('#roomSearch').fill('STEVENS I4I');await page.locator('#roomSearch').press('Enter');assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.getState().selectedId),12134);
  // Search must bring the actual off-screen jersey into a phone's scroll viewport.
  await page.waitForFunction(()=>{const b=document.querySelector('.angle-stall.is-selected').getBoundingClientRect(),v=document.querySelector('.angle-scroll').getBoundingClientRect();return b.left>=v.left-1&&b.right<=v.right+1;});
  await page.locator('.angle-stall.is-selected').press('Enter');await page.locator('#roomSearch').fill('Kudolken');await page.locator('#roomSearch').press('Enter');assert.equal(await page.locator('.stall-level-name').textContent(),'Kudolken');await page.locator('.stall-return').press('Escape');assert.equal(await page.evaluate(()=>window.HitmenFixedRoom.getState().bank),2);
  await page.locator('#roomSearch').fill('BODFUSION');assert.match(await page.locator('#stallFinderStatus').textContent(),/No player found/);await page.locator('#stallFinderClear').click();
  await page.locator('#angleRoster').click();assert(await page.locator('#roomPlayers').isVisible());assert.equal(await page.locator('#roomPlayers .stall').count(),17);await page.locator('#angleRoster').click();
  assert.equal(await page.locator('#roomFinals .tour-match-card').count(),6);assert.equal(await page.locator('#roomUpcoming .tour-match-card').count(),6);
  const g=games.finals[0];assert.deepEqual(await page.locator('#roomFinals .tour-match-card').first().locator('img').evaluateAll(images=>images.map(i=>i.getAttribute('src'))),['assets/lgchl/s55/team'+g.away_lg_team_id+'.png','assets/lgchl/s55/team'+g.home_lg_team_id+'.png']);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await context.close();
 }
 for(const mode of ['loading','failed','empty','invalid']){const {page,context,errors}=await create(390,mode);if(mode!=='loading')await page.waitForFunction(()=>document.querySelector('#roomPlayers').getAttribute('aria-busy')==='false');assert(await page.locator('#roomSearch').isDisabled());assert.equal(await page.locator('.angle-stall').count(),0);assert(await page.locator('#anglePrevious').isDisabled());assert(await page.locator('#angleNext').isDisabled());assert(await page.locator('.angle-tabs button').first().isDisabled());assert.match(await page.locator('#angleLocation').textContent(),mode==='loading'?/Loading/:/unavailable/);assert.deepEqual(errors,[]);await context.close();}
 const failed=await create();await failed.page.route('**/fixed-left-v6.png',r=>r.abort());await failed.page.waitForFunction(()=>window.HitmenFixedRoom?.getState().players.length===17);await failed.page.locator('.angle-tabs button').first().click();await failed.page.waitForFunction(()=>document.querySelector('#angleLocation').textContent.includes('artwork unavailable'));assert.equal(await failed.page.locator('.angle-stall').count(),6);await failed.page.locator('.angle-stall').first().click();assert(await failed.page.locator('.stall-public-card').isVisible());await failed.context.close();
 const other=await create(1440,'normal',364);assert.equal(await other.page.locator('.fixed-room-shell').count(),0);await other.context.close();
 if(process.env.PORTABLE_FIXED){
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));await p.goto(require('node:url').pathToFileURL(process.env.PORTABLE_FIXED).href);await p.waitForFunction(()=>window.HitmenFixedRoom?.getState().players.length===17);
  for(let bank=0;bank<3;bank++){await p.locator('.angle-tabs button').nth(bank).click();await p.waitForFunction(()=>document.querySelector('.angle-background').complete&&document.querySelector('.angle-background').naturalWidth===1536);}
  await p.evaluate(()=>window.HitmenFixedRoom.openStall(80604));await p.waitForFunction(()=>document.querySelector('.stall-master').naturalWidth===1254&&document.querySelector('.stall-closeup-jersey').naturalWidth===600);assert.equal(await p.locator('.stall-level-name').textContent(),'XxPASTRNAK88');assert.deepEqual(errors,[]);assert(!requests.some(u=>u.startsWith('https:')));await p.close();
 }
 console.log('PASS: fixed views (6+5+6), all 17 roster IDs and public cards, exact jerseys, search, bank/keyboard/close-up navigation, mobile scrolling, boundaries, failed artwork, loading/empty/invalid roster, other-team isolation, game logos and offline preview. Public game reads mocked; live player statistics disconnected.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
