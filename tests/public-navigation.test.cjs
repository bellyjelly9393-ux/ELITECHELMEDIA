const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pages=require('./public-navigation-pages.json');
test('every public entry point uses the shared menu and excludes private navigation',()=>{
 for(const page of pages){
  const html=fs.readFileSync(page,'utf8');
  assert.match(html,/public-navigation\.js/,page);
  for(const nav of html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g)){
   assert.doesNotMatch(nav[0],/href="(?:management|hitmen-hq|hitmen-workspace|scouting|scouting-lab|vod-lab)\.html/,page);
  }
 }
});
test('public menu destinations exist and include both leagues and goalies',()=>{
 const js=fs.readFileSync('public-navigation.js','utf8');
 const markup=JSON.parse(js.match(/const markup=(.*);\n/)[1]);
 for(const m of markup.matchAll(/href="([^"?#]+)/g))assert.ok(fs.existsSync(m[1]),m[1]);
 for(const league of ['lgchl','lg3s']){
  assert.ok(markup.includes('league-leaderboards.html?league='+league));
  assert.ok(markup.includes('league-leaderboard.html?league='+league+'&category=save_pct'));
 }
 assert.doesNotMatch(markup,/scouting|war.room|management/i);
});
