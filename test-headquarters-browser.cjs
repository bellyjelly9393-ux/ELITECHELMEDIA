// Static headquarters layout regression. Protected content is revealed only in this local fixture;
// production access is still controlled by the existing management/team guards.
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const pages = ['hitmen-team-locker.html','hitmen-player-locker.html','hitmen-locker-room.html','hitmen-battle-plan.html','hitmen-gm-ai.html','hitmen-opponents.html'];
(async () => {
 const root=process.cwd();
 const mime={'.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);return res.end();}
  const ext=path.extname(filename);res.setHeader('Content-Type',mime[ext]||'text/plain');
  let data=fs.readFileSync(filename);
  if(ext==='.html')data=data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  res.end(data);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:1000}});
   await page.route('https://**/*',r=>r.abort());
   await page.goto('http://127.0.0.1:'+server.address().port+'/hitmen-hq.html');
   // Headquarters starts behind the sign-in gate; the merged game-night tools live inside the gated app.
   assert.equal(await page.locator('#hqApp').getAttribute('hidden'),'');
   await page.evaluate(()=>{document.getElementById('hqApp').hidden=false;document.getElementById('hqGate').hidden=true;});
   for(const id of ['weeklyPrep','gameNight','createSession','activeSession','sessionHistory','stallReqPanel'])
    assert.equal(await page.locator('#'+id).count(),1,'Merged section present: '+id);
   assert.equal(await page.locator('.sub-in a[href*="hitmen-workspace"]').count(),0,'No Game Center tab left');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow at '+width);
   await page.close();
  }
  const hq=fs.readFileSync('hitmen-hq.html','utf8');
  const hqIds=[...hq.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(hqIds).size,hqIds.length,'Unique IDs: hitmen-hq.html');
  assert.ok(fs.readFileSync('hitmen-workspace.html','utf8').includes('hitmen-hq.html'),'Old Game Center page redirects to Headquarters');
  for(const file of pages){
   const html=fs.readFileSync(file,'utf8');
   const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
   assert.equal(new Set(ids).size,ids.length,'Unique IDs: '+file);
   assert.equal((html.match(/data-hn-last/g)||[]).length,1,'One final stylesheet: '+file);
   assert.ok(html.includes('hitmen-headquarters.css'),'Shared theme: '+file);
   assert.ok(html.includes('href="hitmen-hq.html"'),'Headquarters return: '+file);
  }
  const routes=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  for(const route of ['/hitmen','/calgary','/war-room','/hitmen/game-center']){
   assert.equal([...routes.rewrites,...(routes.redirects||[])].find(r=>r.source===route)?.destination,'/hitmen-hq.html');
  }
  console.log('PASS: headquarters desktop/tablet/mobile layout, crest, department links, protected initial state and home routes');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
