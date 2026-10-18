// Pregame report clips: [clip](storage:hitmen-vod-clips/...) renders a private inline player signed for 1h.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const signed=[];
const store={async createSignedUrl(path,ttl){signed.push([path,ttl]);return path.includes('missing')?{data:null,error:{message:'Object not found'}}:{data:{signedUrl:'https://lrgllzvwgvqagcpiyvfd.supabase.co/storage/v1/object/sign/hitmen-vod-clips/'+path+'?token=t'},error:null}}};
const db={storage:{from(b){assert.equal(b,'hitmen-vod-clips');return store}}};
const window={VVHLBackend:{db,state:{}},addEventListener(){}};
const document={body:{dataset:{view:'report'}},readyState:'complete',getElementById:()=>null,addEventListener(){}};
const ctx={window,document,console,URLSearchParams,location:{search:''},history:{},setTimeout(){},clearTimeout(){}};
vm.runInNewContext(fs.readFileSync('hitmen-clips.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('hitmen-report-view.js','utf8'),ctx);
const {reportHtml,hydrateClips}=window.HitmenReportView;
const team='b0bcbdda-da9d-419d-8f61-b34937966d49';
const good=team+'/pregame-clips/2026-10-18/barrie/2026-10-18_01_barrie-collapse-blocks.mp4';
const html=reportHtml([
 '## Video review',
 '- 01:54–02:00 · Barrie <collapse> "blocks" — high slot [clip](storage:hitmen-vod-clips/'+good+')',
 '- bad bucket [clip](storage:hitmen-player-images/'+team+'/x.mp4)',
 '- traversal [clip](storage:hitmen-vod-clips/'+team+'/../other/x.mp4)',
 '- injection [clip](storage:hitmen-vod-clips/'+team+'/x.mp4" onerror="alert(1).mp4)',
 '- missing [clip](storage:hitmen-vod-clips/'+team+'/pregame-clips/missing.mp4)'
].join('\n'));
assert.match(html,/<h2>Video review<\/h2>/);
assert.match(html,/Barrie &lt;collapse&gt; &quot;blocks&quot;/,'Text around clips stays escaped');
assert.equal((html.match(/<video controls preload="none" playsinline><\/video>/g)||[]).length,2,'Only valid hitmen-vod-clips paths become players');
assert.ok(html.includes('data-clip-path="'+good+'"'));
assert.ok(!/onerror=/.test(html.replace(/&quot; onerror=&quot;/g,'')),'No attribute injection');
assert.ok(!html.includes('hitmen-player-images/'+team+'/x.mp4"'),'Other buckets are not turned into players');
assert.ok(!html.includes('data-clip-path="'+team+'/../'),'Path traversal is rejected');
// hydrate with a tiny DOM stub
const mk=path=>{const n={dataset:{clipPath:path},classList:{added:[],add(c){this.added.push(c)}},video:{src:'',removed:false,remove(){this.removed=true}},state:{textContent:'Loading clip…',removed:false,remove(){this.removed=true}},querySelector(sel){return sel==='video'?(this.video.removed?null:this.video):sel==='.hc-clip-state'?(this.state.removed?null:this.state):null}};return n};
const nodes=[mk(good),mk(team+'/pregame-clips/missing.mp4')];
(async()=>{
 const ok=await hydrateClips({querySelectorAll:()=>nodes});
 assert.equal(ok,1);
 assert.deepEqual(signed,[[good,3600],[team+'/pregame-clips/missing.mp4',3600]],'Signed for one hour');
 assert.match(nodes[0].video.src,/^https:\/\/.+token=t$/);
 assert.ok(nodes[0].state.removed);
 assert.ok(nodes[1].video.removed);assert.equal(nodes[1].state.textContent,'Clip unavailable');assert.deepEqual(nodes[1].classList.added,['is-unavailable']);
 console.log('PASS: report clips render as private signed inline players; other text stays escaped; bad paths rejected; missing clips degrade.');
})().catch(e=>{console.error(e);process.exit(1)});
