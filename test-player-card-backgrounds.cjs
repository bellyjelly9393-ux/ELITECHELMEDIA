// Studio contracts: preserve old saved IDs while scenes are rendered by the shared canvas.
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/player-cards.html','utf8'),js=fs.readFileSync(__dirname+'/player-cards.js','utf8'),renderer=fs.readFileSync(__dirname+'/player-card-renderer.js','utf8'),studio=fs.readFileSync(__dirname+'/player-card-studio-v2.js','utf8');
const themes=['arena','heat','city','locker','playoff','storm','classic'];assert.equal((html.match(/name="cardBackground"/g)||[]).length,themes.length);
for(const theme of themes){assert.ok(html.includes('value="'+theme+'"'));assert.ok(js.includes("'"+theme+"'"));if(theme!=='arena')assert.ok(renderer.includes("theme==='"+theme+"'"));}
for(const edition of ['season','base','silver','gold','platinum','signature','playoff'])assert.ok(html.includes('value="'+edition+'"'));
assert.ok(js.includes('background:getBackground(),edition:getEdition()'));assert.ok(js.includes('setBackground(p.background)'));assert.ok(js.includes('window.ECMStudioV2.exportPNG()'));assert.ok(studio.includes("$('cardCanvas').toBlob"));assert.ok(html.includes('Uploaded images are never published'));for(const code of [js,renderer,studio])new Function(code);
console.log('PASS: 7 scene IDs, legacy editions, independent selection persistence, shared PNG composition, syntax');
