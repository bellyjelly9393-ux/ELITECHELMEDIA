const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup({signed=true,rights=true,uploadError=false}={}){
 const events={},calls=[],nodes={submitArtwork:{addEventListener:(n,fn)=>events[n]=fn},artworkReviewStatus:{},artworkRights:{checked:rights}},row={object_path:'private/image.png'};
 const query={select(){return this},eq(){return this},neq(){return this},order(){return this},limit:async()=>({data:[]})};
 const db={from:()=>query,rpc:async(name,args)=>{calls.push({name,args});return {data:row}},storage:{from:()=>({upload:async(path,blob,options)=>{calls.push({name:'upload',path,blob,options});return uploadError?{error:Error('Upload failed')}:{}}})}};
 const window={ecmCardAccount:{getClient:()=>db,getUser:()=>signed?{id:'owner'}:null},ecmCardStudio:{getSelected:()=>({id:'73707',kind:'skater'}),getLeague:()=> 'lgchl',getArtwork:()=> 'data:image/png;base64,YWJj'},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('player-card-artwork-submit.js','utf8'),{window,document:{getElementById:id=>nodes[id]},crypto:{randomUUID:()=> 'unique-review-id'},Uint8Array,Blob,atob});return {events,calls,nodes};
}
test('guest and missing permission cannot transmit artwork',async()=>{for(const options of [{signed:false},{rights:false}]){const h=setup(options);await h.events.click();assert.equal(h.calls.length,0);}});
test('review submission uses a private immutable upload followed by submission',async()=>{const h=setup();await h.events.click();assert.deepEqual(h.calls.map(c=>c.name),['ecm_card_artwork_start','upload','ecm_card_artwork_submit']);assert.equal(h.calls[1].options.upsert,false);assert.equal(h.calls[1].blob.type,'image/png');assert.match(h.nodes.artworkReviewStatus.textContent,/Waiting for manager approval/);});
test('failed upload withdraws the draft and never submits',async()=>{const h=setup({uploadError:true});await h.events.click();assert.deepEqual(h.calls.map(c=>c.name),['ecm_card_artwork_start','upload','ecm_card_artwork_withdraw']);assert.match(h.nodes.artworkReviewStatus.textContent,/not submitted/);assert.equal(h.nodes.submitArtwork.disabled,false);});
