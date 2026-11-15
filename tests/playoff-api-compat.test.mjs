import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Vercel-playoffs API avoids import.meta in JavaScript bundled as CommonJS',()=>{
 const api=read('api/lgchl-playoffs.js');
 assert.doesNotMatch(api,/import\.meta/);
 assert.match(api,/join\(process\.cwd\(\), 'assets', 'lgchl', 'playoffs', 's55\.json'\)/);
 assert.match(api,/catch\s*\{/);
});

test('the saved playoff bracket file is explicitly bundled with the function',()=>{
 const config=JSON.parse(read('vercel.json'));
 assert.equal(config.functions['api/lgchl-playoffs.js'].includeFiles,'assets/lgchl/playoffs/**');
 const bracket=JSON.parse(read('assets/lgchl/playoffs/s55.json'));
 assert.ok(bracket.leagues?.length>0);
 assert.equal(bracket.season,55);
});
