// Homepage responsive regression: node tests/homepage-responsive.test.cjs
// Structural guards only. Real visual QA still needs an actual browser.
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const root=join(__dirname,'..');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'homepage-responsive.css'),'utf8');
const header=html.match(/<header class="pc-nav">([\s\S]*?)<\/header>/)?.[1]||'';
const footer=html.match(/<footer class="pc-footer">([\s\S]*?)<\/footer>/)?.[1]||'';
const order=['trophy-banner','challenge-strip pc-wide','pc-episode-tease','id="playoffs"','ecm-league-showcase','id="scoreboard"'];
let prev=-1;
for (const token of order) {
  const n=html.indexOf(token);
  assert.ok(n>prev,'Missing or out-of-order homepage section: '+token);
  prev=n;
}
assert.match(html,/homepage-responsive\.css\?v=20261115-layout1/);
assert.ok(html.indexOf('homepage-responsive.css')>html.indexOf('ecm-playoff-broadcast.css'),'Mobile overrides must load last');
assert.ok(!header.includes('management.html'),'Management must not appear in top navigation');
assert.ok(footer.includes('management.html'),'Footer management access must remain');
assert.match(header,/<details class="pc-media-menu">[\s\S]*?<summary>All Media<\/summary>/);
for(const id of ['poBoard','pcScoreGrid','pcBallot','pcSubmit','pcLeaders']){
  assert.ok(html.includes('id="'+id+'"'),'Preserve interactive element '+id);
}
assert.match(css,/#pcMain>\.trophy-banner\s*\{[\s\S]*?grid-column:1\/-1/);
assert.match(css,/#pcMain>\.challenge-strip\s*\{[\s\S]*?grid-column:1\/-1/);
for(const breakpoint of ['1280','920','700','370'])assert.ok(css.includes('@media(max-width:'+breakpoint+'px)'),'Missing breakpoint '+breakpoint);
assert.match(css,/main#pcMain\s*\{\s*display:flex;\s*flex-direction:column;/);
assert.match(css,/#scoreboard \.pc-games\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
let depth=0;
for (const ch of css){if(ch==='{')depth++;if(ch==='}')depth--;assert.ok(depth>=0,'CSS has unmatched close bracket');}
assert.equal(depth,0,'CSS has unmatched open bracket');
console.log('PASS homepage responsive structural regression');
