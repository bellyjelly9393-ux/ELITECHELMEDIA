// Static headquarters layout regression. Protected content is revealed only in this local fixture;
// production access is still controlled by the existing management/team guards.
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const pages = ['hitmen-workspace.html','hitmen-team-locker.html','hitmen-player-locker.html','hitmen-locker-room.html','hitmen-battle-plan.html','hitmen-gm-ai.html','hitmen-opponents.html'];
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
   await page.goto('http://127.0.0.1:'+server.address().port+'/hitmen-workspace.html');
   // The real document must begin protected.
   assert.equal(await page.locator('[data-management-content]').getAttribute('hidden'),'');
   await page.evaluate(()=>{
    document.body.classList.add('management-authorized');
    document.querySelector('[data-management-content]').hidden=false;
    document.querySelector('.management-login-shell').hidden=true;
   });
   await page.addScriptTag({content:fs.readFileSync('hitmen-headquarters.js','utf8')});
   await page.waitForSelector('.hq-game');
   assert.equal(await page.locator('.hq-game').count(),9);
   assert.equal(await page.locator('.hq-game details').count(),6);
   assert.equal(await page.locator('#hmRecapList').getAttribute('data-first'),'2');
   assert.equal(await page.locator('#hqTitle').innerText(),'War Room');
   assert.ok(await page.locator('.hq-identity img').evaluate(img=>img.complete&&img.naturalWidth>0));
   assert.ok(await page.locator('#hqTitle').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=36));
   assert.equal(await page.locator('#hqDepartments .hm-command-card').count(),10);
   assert.ok(await page.evaluate(()=>document.querySelector('#wrSeason').compareDocumentPosition(document.querySelector('#hqDepartments')) & Node.DOCUMENT_POSITION_FOLLOWING));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow at '+width);
   assert.equal(await page.locator('.hq-welcome').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(182, 39, 57)');
   await page.close();
  }
  for(const file of pages){
   const html=fs.readFileSync(file,'utf8');
   const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
   assert.equal(new Set(ids).size,ids.length,'Unique IDs: '+file);
   assert.equal((html.match(/data-hn-last/g)||[]).length,1,'One final stylesheet: '+file);
   assert.ok(html.includes('hitmen-headquarters.css'),'Shared theme: '+file);
   assert.ok(html.includes('href="hitmen-workspace.html"'),'Headquarters return: '+file);
  }
  const routes=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  for(const route of ['/hitmen','/calgary','/war-room','/hitmen/game-center']){
   assert.equal([...routes.rewrites,...(routes.redirects||[])].find(r=>r.source===route)?.destination,'/hitmen-workspace.html');
  }
  console.log('PASS: headquarters desktop/tablet/mobile layout, crest, department links, protected initial state and home routes');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
