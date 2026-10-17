// Isolated synthetic browser records only; never uploaded or used by production data.
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2'};
const at='2026-10-16T20:00:00Z';
const skaters=Array.from({length:280},(_,i)=>{const n=i+1,points=1000-Math.floor(i/2);return {gamertag:'Player'+String(n).padStart(3,'0')+(n===125?' <img src=x onerror=alert(1)>':''),position:'C',player_kind:'skater',lg_team_id:n%10===0?412:413,team_name:n%10===0?'Calgary Hitmen':'Example Away',gp:9,goals:n,assists:points-n,points,shots:n*2,hits:n,blocked_shots:n,takeaways:n,plus_minus:0,save_pct:null,gaa:null,fetched_at:at};});
const goalies=Array.from({length:40},(_,i)=>({...skaters[i],gamertag:'Goalie'+String(i+1).padStart(3,'0'),player_kind:'goalie',position:'G',save_pct:.95-i*.002,gaa:1+i*.1}));
test('media top 10 and searchable top 250 at 390, 768 and 1440 pixels',async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],reads=[];
  let mode='normal';
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',async d=>{errors.push('Unexpected dialog');await d.dismiss();});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname.endsWith('supabase.co')){
    const table=u.pathname.split('/').pop();
    assert.equal(route.request().method(),'GET','Browser statistics only perform public reads');
    assert.ok(['wm_lgchl_s55_player_leaders','lgchl_standings_current','lgchl_games_board','lgchl_standings_snapshots'].includes(table),'Unexpected/private query: '+table);
    if(table!=='wm_lgchl_s55_player_leaders')return route.fulfill({json:[]});
    reads.push(u);
    if(mode==='empty')return route.fulfill({json:[]});
    if(mode==='failure')return route.fulfill({status:200,body:'not JSON',contentType:'application/json'});
    const metric=(u.searchParams.get('order')||'points.desc').split('.')[0],ascending=metric==='gaa';
    const rows=[...(u.searchParams.get('player_kind')==='eq.goalie'?goalies:skaters)].sort((a,b)=>(a[metric]-b[metric])*(ascending?1:-1)||b.gp-a.gp||a.gamertag.localeCompare(b.gamertag)).slice(0,Number(u.searchParams.get('limit')||250));
    return route.fulfill({json:rows});
   }
   if(u.hostname!=='127.0.0.1')return route.fulfill({status:200,body:'',contentType:u.pathname.endsWith('.js')?'application/javascript':'text/css'});
   return route.continue();
  });
  const base='http://127.0.0.1:'+server.address().port;
  async function noOverflow(label){
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.width,label+' '+width+' overflow '+JSON.stringify(size));assert.deepEqual(errors,[],label+' '+width);
  }
  await page.goto(base+'/lgchl-media.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelectorAll('#lgLeaders tr').length===10);
  assert.equal(reads.find(u=>u.searchParams.get('limit')==='10').searchParams.get('player_kind'),'eq.skater');
  assert.equal(await page.locator('#lgLeaders tr').nth(1).locator('td').first().innerText(),'1','Tied totals share ranks on media');
  await page.locator('button[data-metric="goals"]').click();
  await page.waitForFunction(()=>document.querySelector('#lgLeaders').textContent.includes('Player280'));
  assert.match(await page.locator('#lgFullLeaders').getAttribute('href'),/metric=goals/);
  assert.match(await page.locator('#lgFindPlayer').getAttribute('href'),/metric=goals&search=1/);
  await noOverflow('Media top 10');
  const searchLink=await page.locator('#lgFindPlayer').getAttribute('href');
  await page.goto(base+'/'+searchLink,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.getElementById('lgLeaders').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#lgMetric').inputValue(),'goals');
  assert.equal(await page.locator('#lgLeaders tbody tr').count(),25);
  assert.match(await page.locator('#lgPlayerStatus').innerText(),/of 250 players/);
  await page.locator('#lgMetric').selectOption('points');
  await page.waitForFunction(()=>document.querySelector('#lgLeaders').textContent.includes('Player001'));
  assert.equal(await page.locator('#lgLeaders tbody tr').nth(1).locator('th').innerText(),'1');
  await page.locator('#lgNextPage').click();
  assert.match(await page.locator('#lgPageStatus').innerText(),/Page 2 of 10/);
  assert.equal(await page.locator('#lgLeaders tbody tr').first().locator('th').innerText(),'25','Tied league rank crosses page boundary');
  await page.locator('#lgPlayerSearch').fill('Player125');
  assert.equal(await page.locator('#lgLeaders tbody tr').count(),1);
  assert.equal(await page.locator('#lgLeaders tbody tr th').innerText(),'125','Search preserves rank');
  assert.equal(await page.locator('#lgLeaders img[onerror]').count(),0);
  assert.match(await page.locator('#lgLeaders').innerText(),/<img src=x onerror=alert\(1\)>/);
  assert.equal(new URL(page.url()).searchParams.get('q'),'Player125');
  await noOverflow('Filtered board');
  await page.locator('#lgPlayerSearch').fill('Player999');
  assert.match(await page.locator('#lgLeaders').innerText(),/No player or team matches/);
  assert.equal(await page.locator('#lgNextPage').isDisabled(),true);
  await page.locator('#lgClearSearch').click();
  assert.equal(await page.locator('#lgLeaders tbody tr').count(),25);
  for(let i=0;i<9;i++)await page.locator('#lgNextPage').click();
  assert.match(await page.locator('#lgPlayerStatus').innerText(),/226–250 of 250/);
  assert.equal(await page.locator('#lgNextPage').isDisabled(),true);
  await page.locator('#lgMetric').selectOption('gaa');
  await page.waitForFunction(()=>document.querySelector('#lgLeaders').textContent.includes('Goalie001'));
  assert.match(await page.locator('#lgPlayerStatus').innerText(),/goalies with 8\+ GP/);
  assert.ok(reads.some(u=>u.searchParams.get('gp')==='gte.8'&&u.searchParams.get('order').startsWith('gaa.asc')));
  await noOverflow('Goalie board');
  if(process.env.LGCHL_SCREENSHOT_DIR){
   fs.mkdirSync(process.env.LGCHL_SCREENSHOT_DIR,{recursive:true});
   await page.locator('#lgPlayerBoard').screenshot({path:path.join(process.env.LGCHL_SCREENSHOT_DIR,'lgchl-top250-'+width+'.png')});
  }
  mode='empty';await page.locator('#lgMetric').selectOption('assists');
  await page.waitForFunction(()=>document.querySelector('#lgLeaders').textContent.includes('No qualifying imported'));
  await noOverflow('Empty board');
  mode='failure';await page.locator('#lgReload').click();
  await page.waitForFunction(()=>document.querySelector('#lgLeaders').textContent.includes('Statistics are unavailable'));
  assert.match(await page.locator('#lgHitmen').innerText(),/statistics are unavailable/);
  await noOverflow('Unavailable board');
  console.log(width+': top10 links, top250 pagination/search, stable tied ranks, goalies, empty/error states; no overflow or console errors');
  await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
