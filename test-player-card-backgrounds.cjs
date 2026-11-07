// Contract checks for the Card Background Studio. Run: node test-player-card-backgrounds.cjs
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/player-cards.html','utf8');
const css=fs.readFileSync(__dirname+'/player-cards.css','utf8');
const js=fs.readFileSync(__dirname+'/player-cards.js','utf8');
const backgrounds=['arena','heat','city','locker','playoff','classic'];
const editions=['base','silver','gold','platinum','signature','playoff'];
assert.equal((html.match(/name="cardBackground"/g)||[]).length,6,'Exactly six choices');
for(const theme of backgrounds){
  assert.ok(html.includes('value="'+theme+'"'),'Missing HTML theme '+theme);
  assert.ok(css.includes('.trading-card[data-background='+theme+']'),'Missing card scene '+theme);
}
assert.ok(html.includes('id="edition"'),'Card edition must remain independent');
for(const edition of editions) assert.ok(html.includes('value="'+edition+'"'),'Missing edition '+edition);
assert.ok(html.includes('id="finish"'),'Existing finish choices must remain available');
assert.ok(js.includes("dataset.background=getBackground()"),'Selected theme must affect live card');
assert.ok(js.includes("dataset.edition=getEdition()"),'Edition must be separate from background');
assert.ok(js.includes("dataset.finish=$('finish').value"),'Existing finish must remain separate');
assert.ok(js.includes("background:getBackground(),edition:getEdition()"),'Device saving must retain both preferences');
assert.ok(js.includes("setBackground(p.background)"),'Device loading must restore theme');
assert.ok(js.includes("paintScene(x,W,H,getBackground())"),'PNG export must receive selected background');
assert.ok(html.includes('CHEL overall is still self-reported'),'Avoid unverified automatic rating claims');
new Function(js); // syntax check without executing network requests
console.log('PASS: 6 themes, 6 edition previews, independent finish, storage, export integration, JS syntax');
