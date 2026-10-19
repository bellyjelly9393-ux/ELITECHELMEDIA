// All synthetic records below are isolated browser fixtures, never public site data.
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),type={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const at='2026-10-16T20:00:00Z',source='https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid=999999';
const player={gamertag:'Example <img src=x onerror=alert(1)>',lg_team_id:413,gp:5,goals:6,assists:9,points:15,plus_minus:2,position:'C',team_name:'Example Club',player_kind:'skater',last_game_at:at,first_game_at:at,imported_at:at,fetched_at:at,source_urls:[source]};
function fixture(table,url,mode){
 if(mode==='empty')return table==='lg_public_history_current'?[{import_id:'test-only'}]:[];
 const teams=[413,412].map((id,i)=>({lg_team_id:id,name:i?'Example Home':'Example Away',abbr:i?'HOM':'AWY',nickname:i?'Home':'Away',league:'WHL',conference:'East',gp:9,w:6-i,l:2+i,otl:1,pts:13-i*2,gf:40-i*4,ga:22+i*4,gd:18-i*8,streak:'3W',last10:'6-2-1',conference_rank:i+1,standings_at:at}));
 if(table==='lgchl_standings_current')return teams;
 if(table==='lgchl_standings_snapshots')return teams.map(t=>({...t,taken_at:at}));
 if(table==='lgchl_games_board')return ['final','scheduled'].map((status,i)=>({lg_game_id:999998+i,week:3,game_at:new Date(Date.now()+(i?1:-1)*86400000).toISOString(),status,league:'WHL',away_lg_team_id:413,home_lg_team_id:412,away_abbr:'AWY',home_abbr:'HOM',away_score:i?null:3,home_score:i?null:4,away_conf_rank:1,home_conf_rank:2,big_game:true,big_reasons:['top4_clash'],source_url:source,fetched_at:at}));
 if(table==='wm_lgchl_s55_player_leaders')return url.searchParams.get('player_kind')==='eq.goalie'?[{...player,player_kind:'goalie',gamertag:'Example Goalie',gp:9,save_pct:.85,gaa:2.5}]:[player];
 if(table==='lg_public_history_current')return [{import_id:'test-only'}];
 const history={...player,player_id:'test-only',gp:6,points:18,ppg:3,prev_gp:10,prev_points:10,prev_ppg:1,improvement:2,history_imported_at:at,source_captured_at:null,source_url:source,history_source_url:source};
 if(table==='lgchl_public_breakout_watch')return [history];
 if(table==='lgchl_public_ahl_movement')return [{...history,from_league:'AHL',from_season:54,from_gp:5,from_points:5,from_ppg:1,from_plus_minus:0}];
 if(table==='lgchl_public_trending')return [player];
 if(table==='lgchl_public_weekly_players')return [{...player,week:3}];
 if(table==='lgchl_public_box_coverage')return [{final_games:100,imported_games:5,imported_at:at}];
 return [];
}
test('LGCHL media at 390, 768 and 1440: live, pending and empty feeds; safe text, tabs and no overflow/errors',async()=>{
 const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const snapshots=process.env.LGCHL_SCREENSHOT_DIR;
 if(snapshots)fs.mkdirSync(snapshots,{recursive:true});
 try{
  for(const mode of (process.env.LGCHL_REAL_PUBLIC_READS?['readonly']:['pending','live','empty']))for(const width of [390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   const page=await context.newPage(),errors=[],newReads=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   page.on('dialog',async d=>{errors.push('Unexpected dialog');await d.dismiss();});
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname.endsWith('supabase.co')){
     if(mode==='readonly'&&route.request().method()==='GET'&&['lgchl_standings_current','lgchl_standings_snapshots','lgchl_games_board','wm_lgchl_s55_player_leaders'].includes(url.pathname.split('/').pop()))return route.continue();
     const table=url.pathname.split('/').pop();
     // Approved public stat-history views (LG season totals compared over time) are always readable.
     const STAT_HISTORY_VIEWS=['lgchl_public_night_players','lgchl_public_week_players','lgchl_public_trending_players'];
     if((table.startsWith('lgchl_public_')||table.startsWith('lg_public_'))&&!STAT_HISTORY_VIEWS.includes(table))newReads.push(table);
     return route.fulfill({json:fixture(table,url,mode)});
    }
    if(!['pending','readonly'].includes(mode)&&url.pathname==='/lgchl-media-config.js')return route.fulfill({contentType:'application/javascript',body:'window.LGCHL_PUBLIC_MEDIA_CONFIG={history:true,boxScores:true};'});
    if(url.hostname!=='127.0.0.1')return route.fulfill({status:200,body:'',contentType:'text/css'});
    return route.continue();
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/lgchl-media.html',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!document.getElementById('lgWeekPlayers').textContent.includes('Loading'));
   await page.waitForTimeout(150);
   const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(dimensions.scroll<=dimensions.viewport,mode+' '+width+' overflow: '+JSON.stringify(dimensions));
   assert.deepEqual(errors,[],mode+' '+width+' browser errors');
   if(mode==='pending'||mode==='readonly'){
    assert.deepEqual(newReads,[],'Unapproved tables must not be requested');
    assert.match(await page.locator('#lgBreakout').innerText(),/Dated snapshot/i);
    assert.match(await page.locator('#lgTrendingRecords').innerText(),/awaiting approval/);
   }else if(mode==='live'){
    assert.match(await page.locator('#lgTrendingRecords').innerText(),/15/);
    assert.match(await page.locator('#lgWeekPlayers').innerText(),/Week 3/i);
    assert.match(await page.locator('#lgBreakout').innerText(),/Public history import/i);
    assert.match(await page.locator('#lgBreakout').innerText(),/Example <img/);
    assert.equal(await page.locator('img[onerror]').count(),0,'Names remain text, never HTML');
   }else{
    assert.match(await page.locator('#lgBreakout').innerText(),/No players meet/);
    assert.match(await page.locator('#lgTrendingRecords').innerText(),/No qualifying/);
   }
   await page.locator('button[data-metric="save_pct"]').click();
   await page.waitForTimeout(100);
   assert.equal(await page.locator('button[data-metric="save_pct"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#lgLeadersHead').innerText(),/GAA/);
   assert.deepEqual(errors,[],mode+' '+width+' after interaction');
   if(snapshots&&mode==='live')await page.screenshot({path:path.join(snapshots,'lgchl-'+width+'.png'),fullPage:false});
   console.log(mode+' '+width+': no horizontal overflow or console/page errors; public gates and tabs passed');
   if(snapshots&&mode==='live')await page.locator('#lgTrendSec').screenshot({path:path.join(snapshots,'lgchl-trending-'+width+'.png')});
   await context.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
