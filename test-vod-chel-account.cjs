const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/api/chelstats-player.js','utf8');
const handler=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')).then(m=>m.default);
const original=global.fetch;
afterEach(()=>{global.fetch=original;});
const response=()=>({statusCode:0,body:null,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}});
async function lookup(profile,query={}){
 global.fetch=async()=>({ok:true,json:async()=>profile});
 const res=response();await(await handler)({method:'GET',query:{identity:'1',username:'ExactGT',expected_platform:'xbox',...query}},res);return res;
}
test('exact verified console tag returns character suggestion with platform and stable EA ID',async()=>{
 const res=await lookup({Username:'ExactGT',Platform:'Xbox Series X',skplayername:'Character One',blazeId:'12345678901234567890'});
 assert.equal(res.statusCode,200);assert.equal(res.body.profile.chelName,'Character One');assert.equal(res.body.profile.platform,'xbox');
 assert.equal(res.body.profile.blazeId,'12345678901234567890');assert.equal(res.body.profile.historical_game_identity_verified,false);
 assert.equal(res.body.verification,'current_profile_suggestion');assert.ok(res.body.fetched_at);
});
test('same name on wrong platform never produces an identity',async()=>{
 const res=await lookup({Username:'ExactGT',Platform:'PS5',skplayername:'Wrong person'});assert.equal(res.statusCode,409);assert.equal(res.body.profile,undefined);
});
test('missing or unsupported platform stays unconfirmed',async()=>{
 for(const Platform of [undefined,'common-gen5','unknown']){
  const res=await lookup({Username:'ExactGT',Platform,skplayername:'Unconfirmed'});
  assert.equal(res.statusCode,200);assert.equal(res.body.verification,'current_profile_suggestion_platform_unconfirmed');
  assert.equal(res.body.profile.platform,null);assert.equal(res.body.profile.platform_verified,false);
  assert.equal(res.body.profile.historical_game_identity_verified,false);
 }
});
test('similar or different returned name is rejected',async()=>{
 assert.equal((await lookup({Username:'ExactGT2',Platform:'xbox',skplayername:'Wrong'})).statusCode,404);
});
test('generic display label is not treated as a character name',async()=>{
 const res=await lookup({Username:'ExactGT',Platform:'xbox',identity:{displayName:'Account label'}});
 assert.equal(res.statusCode,200);assert.equal(res.body.profile.chelName,null);
});
test('unsafe numeric EA IDs are withheld and invalid platform requests fail',async()=>{
 assert.equal((await lookup({Username:'ExactGT',Platform:'xbox',blazeId:Number.MAX_SAFE_INTEGER+1})).body.profile.blazeId,null);
 assert.equal((await lookup({}, {expected_platform:'invented'})).statusCode,400);
});
test('identity nested under the existing shot node is checked consistently',async()=>{
 const res=await lookup({stats:{ShotsLocationOnIce1:0,Username:'ExactGT',Platform:'PlayStation 5',skplayername:'PS Character'}},{expected_platform:'playstation'});
 assert.equal(res.statusCode,200);assert.equal(res.body.profile.chelName,'PS Character');
});
