const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const html=readFileSync(join(root,'lgchl-media.html'),'utf8');
const css=readFileSync(join(root,'lgchl-playoff-scroll.css'),'utf8');
const segment=readFileSync(join(root,'lgchl-segments-home.js'),'utf8');
const enhancing=readFileSync(join(root,'lgchl-playoff-scroll.js'),'utf8');
const original=readFileSync(join(root,'lgchl-playoff-desk.js'),'utf8');
test('The actual LGCHL Media page scrolls through all playoff sections in order',()=>{
 const ids=['lgPressure','lgRivalry','lgRoad','lgPlayoffStats','lgContenders','cup','lgRadioSec','archive'];
 const pos=ids.map(x=>html.indexOf('id="'+x+'"'));
 assert.ok(pos.every((x,i)=>x>0&&(i===0||x>pos[i-1])),'Sections must be stacked in scrolling DOM order');
 assert.ok(html.includes('id="ecmSegmentsHome"'));
 assert.equal((html.match(/id="ecmSegmentsHome"/g)||[]).length,1);
});
test('Mobile navigation is a Browse Sections dropdown, not a horizontal tab wall',()=>{
 assert.match(html,/<details class="lg-scroll-mobile-menu">/);
 assert.match(html,/<summary>Browse playoff sections/);
 for(const anchor of ['#lgPressure','#lgRivalry','#lgRoad','#lgPlayoffStats','#lgContenders','#lgRadioSec'])
   assert.ok(html.includes('href="'+anchor+'"'),'Missing page anchor '+anchor);
 assert.match(css,/\.lg-scroll-desktop-links\{display:none\}/);
 assert.match(css,/\.lg-scroll-mobile-menu\{display:block/);
 assert.match(css,/\.lg-scroll-nav\{[^}]*overflow:visible!important/);
});
test('Mobile body and all preview cards retain normal vertical scrolling',()=>{
 assert.ok(html.includes('<body class="lgchl-playoff-scroll">'));
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/main#top\{[\s\S]*?height:auto/);
 assert.match(css,/\.lgchl-scroll-segments \.s55-seg-tiles\{grid-template-columns:1fr!important/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Each segment reuses canonical verified bracket records, not manual copied scores',()=>{
 for(const str of ['lgchl-segments-core.js','lgchl-segments-home.js','lgchl-playoff-scroll.js'])
   assert.ok(html.includes(str),'Missing linked script '+str);
 assert.match(segment,/C\.pressure\(/);
 assert.match(segment,/C\.allSeries\(/);
 assert.match(segment,/road-to-cup\.html\?team=/);
 assert.match(enhancing,/C\.allSlots\(/);
 assert.match(enhancing,/C\.isFinal/);
 assert.match(enhancing,/seen\.has\(Number\(game\.id\)\)/);
});
test('The original show, archive, team navigation and prediction links are preserved',()=>{
 for(const str of ['id="desk-games"','lgchl-playoff-desk.js','id="lgRadioSec"','class="hn-video"','id="archive"','hitman-nightly.js','lgchl-team.html','playoff-central.html#predictor'])
   assert.ok(html.includes(str),'Original site link or component missing '+str);
 assert.ok(original.includes('updateDesk()'));
 assert.ok(html.includes('playoff-central.html#scoreboard'));
});
