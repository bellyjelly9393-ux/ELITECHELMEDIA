const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function harness({rows=[{object_path:'approved/file.png',layout:{imageScale:110}}],local=false,error=false}={}){
 let selected={id:'1',kind:'skater'},resolveSigned;const applied=[],calls=[],events={};const db={from:name=>{calls.push(name);return {select(){return this},eq(){return this},limit:async()=>({data:rows})};},storage:{from:()=>({createSignedUrl:async()=>error?{error:Error('Denied')}:{data:{signedUrl:'https://storage.test/signed'}}})}};
 const window={ecmCardStudio:{getSelected:()=>selected,getLeague:()=> 'lgchl',applyApprovedArtwork:(data,layout)=>{if(local)return false;applied.push({data,layout});return true;}},ecmCardAccount:{getClient:()=>db},ECMStudioV2:{generate:async()=>true},addEventListener:(name,fn)=>events[name]=fn};
 class FileReader{readAsDataURL(){this.result='data:image/png;base64,YWJj';this.onload();}}
 vm.runInNewContext(fs.readFileSync('player-card-public-artwork.js','utf8'),{window,URLSearchParams,location:{search:''},fetch:async()=>({ok:true,blob:async()=>({})}),FileReader,console,document:{getElementById:()=>({})}});return {applied,calls,events,setPlayer:p=>selected=p};
}
test('public loader applies only a published record and its approved layout',async()=>{const h=harness();await flush();assert.equal(h.applied.length,1);assert.equal(h.applied[0].layout.imageScale,110);assert.deepEqual(h.calls,['ecm_card_publications']);});
test('unpublished or inaccessible artwork never becomes the portrait',async()=>{for(const options of [{rows:[]},{error:true},{local:true}]){const h=harness(options);await flush();assert.equal(h.applied.length,0);}});
