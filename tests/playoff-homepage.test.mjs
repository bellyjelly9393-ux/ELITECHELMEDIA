import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(name)=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const home=read('index.html');
const old=read('home-archive-s55.html');
const homeCss=read('playoff-home.css');
const originalCss=read('lgchl-playoffs.css');
const originalJs=read('lgchl-playoffs.js');
const centralJs=read('playoff-central.js');
const section=(html)=>{
 const start=html.indexOf('  <section class="po band" id="playoffs"');
 const end=html.indexOf('\n  </section>',start);
 assert.ok(start>=0&&end>start,'original bracket element exists');
 return html.slice(start,end+'\n  </section>'.length);
};

test('the original homepage bracket HTML is preserved byte-for-byte',()=>{
 assert.equal(section(home),section(old));
 assert.equal((home.match(/id="playoffs"/g)||[]).length,1);
 assert.equal((home.match(/id="poBoard"/g)||[]).length,1);
 assert.match(home,/data-po-tab="WHL"/);
 assert.match(home,/data-po-tab="OHL"/);
 assert.match(home,/data-po-tab="QMJHL"/);
 assert.match(home,/data-po-tab="CUP"/);
});

test('existing live-bracket scripts and CSS are retained',()=>{
 assert.match(home,/href="lgchl-playoffs\.css/);
 assert.match(home,/src="lgchl-playoffs\.js/);
 assert.match(home,/src="playoff-central\.js/);
 assert.match(home,/href="playoff-home\.css/);
 assert.ok(originalCss.includes('.po-tree'));
 assert.match(originalJs,/\/api\/lgchl-playoffs/);
 assert.doesNotThrow(()=>new vm.Script(originalJs));
 assert.doesNotThrow(()=>new vm.Script(centralJs));
 assert.match(homeCss,/#playoffs\s*\{/);
});

test('full homepage promotes episodes, bracket, scores, picks, rankings, updates and rules',()=>{
 for(const id of ['episodes','playoffs','scoreboard','predictor','leaderboard','community','contest-rules']){
  assert.match(home,new RegExp('id="'+id+'"'));
 }
 assert.match(home,/Episodes are in production/);
 assert.match(home,/href="https:\/\/discord\.gg\/KMBjak7RD"/);
 assert.match(home,/PREDICTOR RULES/);
 assert.match(home,/not active until official rules/);
 assert.match(home,/lgchl-media\.html#lgRadioSec/);
});

test('older homepage can be restored without chasing previous Git commits',()=>{
 assert.match(old,/Elitechel Media: the home of competitive chel/);
 assert.match(old,/id="playoffs"/);
 assert.match(old,/name="robots" content="noindex,nofollow"/);
 assert.notEqual(home,old);
});

test('both playoff entry pages link to the official Discord community but keep picks onsite',()=>{
 const discord='https://discord.gg/KMBjak7RD';
 const standalone=read('playoff-central.html');
 for(const page of [home,standalone]){
  assert.match(page,/id="community"/);
  assert.ok(page.includes('href="'+discord+'"'));
  assert.match(page,/target="_blank" rel="noopener noreferrer"/);
  assert.match(page,/Discord is optional/);
  assert.match(page,/href="#predictor"/);
 }
});

