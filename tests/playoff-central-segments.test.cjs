const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const central=readFileSync(join(root,'playoff-central.html'),'utf8');
const home=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'lgchl-segments-home.css'),'utf8');
const js=readFileSync(join(root,'lgchl-segments-home.js'),'utf8');
test('Canonical Playoff Central includes all three interactive preview cards',()=>{
 for(const link of ['pressure-cooker.html','rivalry-report.html','road-to-cup.html'])
  assert.ok(central.includes('href="'+link+'"'),'Missing '+link);
 for(const id of ['ecmSegmentsHome','s55RoadSelect','s55RoadLink'])
  assert.ok(central.includes('id="'+id+'"'),'Missing '+id);
 assert.ok(central.includes('data-s55-slot="pressure"'));
 assert.ok(central.includes('data-s55-slot="rivalry"'));
 assert.equal((central.match(/id="ecmSegmentsHome"/g)||[]).length,1);
});
test('Predictor, score results, leaderboard, navigation and management footer are retained',()=>{
 for(const id of ['pcMain','scoreboard','pcScoreGrid','predictor','pcBallot','pcSubmit','pcLeaders','leaderboard','community','accountPanel'])
  assert.ok(central.includes('id="'+id+'"'),'Original section/control missing: '+id);
 for(const path of ['playoff-central.js?v=1','backend.js','lgchl-segments-core.js','lgchl-segments-home.js'])
  assert.ok(central.includes(path),'Script missing: '+path);
 const nav=central.match(/<header class="pc-nav">([\s\S]*?)<\/header>/)?.[1]||'';
 assert.ok(nav.includes('href="#ecmSegmentsHome"'));
 assert.ok(!nav.includes('management.html'),'Management stays at bottom');
 assert.ok(central.match(/<footer class="pc-footer">[\s\S]*?href="management.html"/));
});
test('Playoff desk is a single full-width section before the current scoreboard',()=>{
 const positions=['id="episodes"','id="ecmSegmentsHome"','id="scoreboard"','id="predictor"','id="leaderboard"'].map(t=>central.indexOf(t));
 assert.ok(positions.every((n,i)=>n>=0&&(i===0||n>positions[i-1])),'Existing sections unexpectedly reordered');
 assert.ok(central.includes('id="ecmSegmentsHome" aria-label="Interactive LGCHL playoff segments" class="pc-wide pc-segments-in-central"'));
 assert.ok(css.includes('.pc-segments-in-central'));
 assert.ok(css.includes('@media(max-width:700px)'));
});
test('The shared data renderer is reused rather than rebuilding or substituting new records',()=>{
 assert.ok(central.includes('lgchl-segments-home.css'));
 assert.ok(js.includes("document.getElementById('ecmSegmentsHome')"));
 assert.ok(js.includes("C.pressure("));
 assert.ok(js.includes("C.allSeries("));
 assert.ok(js.includes("road-to-cup.html?team="));
 assert.ok(home.includes('id="ecmSegmentsHome"'),'Original homepage preview remains untouched');
});
