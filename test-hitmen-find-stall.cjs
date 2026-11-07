/* Run: node test-hitmen-find-stall.cjs. Requires Playwright and Chromium/Edge.
   Optional PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE select existing installations. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=__dirname,snapshot=JSON.parse(fs.readFileSync(path.join(root,'assets/lgchl/rosters/main-rosters-s55.json')));
const roster=snapshot.teams['412'].players;
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
 const origin='http://127.0.0.1:'+server.address().port;
 async function pageFor({width=1280,mode='normal',team=412,reducedMotion='reduce'}={}){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<700,isMobile:width<700,reducedMotion});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://lrgllzvwgvqagcpiyvfd.supabase.co/**',route=>route.request().url().includes('wm_lgchl_s55_player_leaders')?route.fulfill({status:503,body:'stats unavailable'}):route.fulfill({json:[]}));
  if(mode!=='normal')await page.route('**/main-rosters-s55.json*',async route=>{
   if(mode==='failed')return route.fulfill({status:503,body:'unavailable'});
   if(mode==='loading')return;
   const data=structuredClone(snapshot);data.teams['412'].players=mode==='empty'?[]:roster.concat(roster[0]);return route.fulfill({json:data});
  });
  await page.goto(origin+'/lgchl-team.html?team='+team);
  return {page,context,errors};
 }
 for(const width of [1280,390]){
  const {page,context,errors}=await pageFor({width});
  await page.locator('#roomSearch').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#roomSearch').disabled);
  assert.equal(await page.locator('#roomPlayers .stall').count(),17);
  // Every public identity maps to exactly its own rendered stall and correct card URL.
  for(const p of roster){assert.equal(await page.evaluate(id=>window.HitmenPublicRoom.focusStall(id),p.lg_user_id),true);const stall=page.locator('#hitmen-stall-'+p.lg_user_id);assert.equal(await stall.getAttribute('aria-current'),'true');assert.equal(await stall.getAttribute('href'),'lgchl-player.html?id='+p.lg_user_id+'&kind='+p.player_kind);}
  await page.locator('#roomSearch').fill('STEVENS I4I');await page.locator('#roomSearch').press('Enter');
  assert.equal(await page.locator('.is-found').getAttribute('id'),'hitmen-stall-12134');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'hitmen-stall-12134');
  assert.equal(await page.locator('#roomPlayers .stall').count(),17,'search must not remove room stalls');
  await page.locator('#stallFinderNext').click();assert.equal(await page.locator('.is-found').getAttribute('id'),'hitmen-stall-66913');
  await page.locator('#stallFinderPrev').click();assert.equal(await page.locator('.is-found').getAttribute('id'),'hitmen-stall-12134');
  await page.locator('#roomSearch').fill('BODFUSION');assert.match(await page.locator('#stallFinderStatus').textContent(),/Not on this saved 17-player roster/);
  await page.locator('#stallFinderClear').click();assert.equal(await page.locator('#roomSearch').inputValue(),'');
  await page.locator('#roomSearch').fill('l');await page.locator('#roomSearch').press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'roomSearch');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.evaluate(()=>window.HitmenPublicRoom.focusStall(73707));assert(await page.locator('#stallFinderPrev').isDisabled());
  await page.evaluate(()=>window.HitmenPublicRoom.focusStall(80604));assert(await page.locator('#stallFinderNext').isDisabled());
  assert.equal(await page.evaluate(()=>window.HitmenPublicRoom.focusStall(999999)),false);
  // Only aliases supplied on the public player object are supported; none are invented.
  assert(await page.evaluate(()=>window.HitmenStallFinder.matches({gamertag:'Test',ea_alias:'Known Alias'},'knownalias')));
  const shot=process.env.SCREENSHOT_DIR;if(shot){fs.mkdirSync(shot,{recursive:true});await page.screenshot({path:path.join(shot,'find-stall-'+width+'.png')});await page.locator('#roomSearch').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shot,'find-stall-search-'+width+'.png')});}
  await page.evaluate(()=>window.HitmenPublicRoom.focusStall(80604));
  await page.keyboard.press('Enter');await page.waitForURL('**/lgchl-player.html?id=80604&kind=goalie');
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const mode of ['failed','invalid','empty','loading']){
  const {page,context}=await pageFor({mode});
  if(mode==='loading'){assert(await page.locator('#roomSearch').isDisabled());assert.match(await page.locator('#stallFinderStatus').textContent(),/Loading/);}
  else{await page.waitForFunction(()=>!document.querySelector('#roomPlayers').getAttribute('aria-busy')||document.querySelector('#roomPlayers').getAttribute('aria-busy')==='false');assert(await page.locator('#roomSearch').isDisabled());assert.match(await page.locator('#stallFinderStatus').textContent(),mode==='empty'?/No main-rostered/:/unavailable/);}
  await context.close();
 }
 const smooth=await pageFor({reducedMotion:'no-preference'});await smooth.page.waitForFunction(()=>!document.querySelector('#roomSearch').disabled);
 const event=await smooth.page.evaluate(()=>{let detail;const room=document.querySelector('#roomPlayers');room.addEventListener('hitmen-stall-selected',e=>detail=e.detail,{once:true});const stall=document.querySelector('#hitmen-stall-73707');stall.scrollIntoView=options=>window.scrollOptions=options;window.HitmenPublicRoom.focusStall(73707);return {detail,options:window.scrollOptions};});assert.equal(event.options.behavior,'smooth');assert.equal(event.detail.lg_user_id,73707);await smooth.context.close();
 const {page,context}=await pageFor({team:364});assert.equal(await page.locator('.stall-finder').count(),0);await page.waitForFunction(()=>document.querySelector('#roomPlayers').getAttribute('aria-busy')==='false');await page.locator('#roomSearch').fill('Shaneomac381');assert.equal(await page.locator('#roomPlayers .stall').count(),1);await context.close();
 if(process.env.LIVE_SITE){const live=await browser.newPage();try{const response=await live.goto(process.env.LIVE_SITE,{timeout:30000});await live.waitForTimeout(15000);console.log('LIVE INSPECTION:',JSON.stringify({status:response.status(),url:live.url(),title:await live.title(),name:await live.locator('#roomName').textContent(),stalls:await live.locator('#roomPlayers .stall').count()}));}catch(e){console.log('LIVE INSPECTION UNAVAILABLE:',e.message);}finally{await live.close();}}
 console.log('PASS: desktop/mobile, 17 ID-to-stall/card mappings, keyboard/search/navigation, missing players, boundaries, public alias contract, loading/empty/error, other-team filtering; public stats mocked unavailable.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
