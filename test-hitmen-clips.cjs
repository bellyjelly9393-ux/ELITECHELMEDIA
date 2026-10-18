// Shared private clip helper (hitmen-clips.js) + War Room Tonight + opponent scout wiring.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const TEAM='b0bcbdda-da9d-419d-8f61-b34937966d49';
const P1=TEAM+'/pregame-clips/2026-10-18/saint_john/2026-10-18_07_backdoor-goal.mp4';
const P2=TEAM+'/pregame-clips/2026-10-18/saint_john/2026-10-18_06_rebound-goal.mp4';
const M=p=>'[clip](storage:hitmen-vod-clips/'+p+')';
const signed=[];
const store={async createSignedUrl(path,ttl){signed.push([path,ttl]);return path.includes('missing')?{data:null,error:{message:'Object not found'}}:{data:{signedUrl:'https://lrgllzvwgvqagcpiyvfd.supabase.co/storage/v1/object/sign/hitmen-vod-clips/'+path+'?token=t'},error:null}}};
const db={storage:{from(b){assert.equal(b,'hitmen-vod-clips');return store}}};
// tiny DOM for the toggle
const mkEl=tag=>({tagName:tag,children:[],attrs:{},hidden:false,textContent:'',appendChild(c){this.children.push(c);c.parentNode=this;return c},setAttribute(k,v){this.attrs[k]=String(v)},remove(){const p=this.parentNode;if(p)p.children=p.children.filter(x=>x!==this)},play(){this.played=true;return Promise.resolve()},pause(){this.paused=true}});
const doc={createElement:mkEl,head:null,getElementById:()=>null,addEventListener(){},readyState:'complete',querySelectorAll:()=>[]};
const window={VVHLBackend:{db,state:{}},addEventListener(){}};
const ctx={window,document:doc,console,URLSearchParams,location:{search:''},history:{},setTimeout(){},clearTimeout(){},setInterval(){},Intl,Date};
vm.runInNewContext(fs.readFileSync('hitmen-clips.js','utf8'),ctx);
const C=window.HitmenClips;
assert.equal(C.TTL,3600);
// tags: compact toggle, full player, rejects other buckets / traversal; never touches surrounding escaped text
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line='Backdoor <goal> "x" '+M(P1)+' '+M(TEAM+'/../a.mp4')+' '+M('x" onerror="y.mp4')+' [clip](storage:hitmen-player-images/'+TEAM+'/a.mp4)';
const compact=C.tags(esc(line),{compact:true});
assert.match(compact,/^Backdoor &lt;goal&gt; &quot;x&quot; /);
assert.equal((compact.match(/class="hc-clip is-compact"/g)||[]).length,1);
assert.ok(compact.includes('data-clip-path="'+P1+'"'));
assert.ok(!compact.includes('<video'),'Compact view loads no video until clicked');
assert.ok(!/onerror="/.test(compact)&&!compact.includes('data-clip-path="'+TEAM+'/..'));
assert.equal((C.tags(esc(M(P1))).match(/<video controls preload="none" playsinline><\/video>/g)||[]).length,1);
// strip + extract
assert.equal(C.strip('Plan. '+M(P1)+' Next.'),'Plan. Next.');
assert.equal(C.strip('Odd [clip](storage:hitmen-player-images/a.mp4) x'),'Odd x');
assert.deepEqual(JSON.parse(JSON.stringify(C.extract('## Video review\n- 18:00–18:07 · backdoor goal — finish far post. '+M(P1)+'\n- **x** '+M(TEAM+'/../a.mp4')))),[{path:P1,label:'18:00–18:07 · backdoor goal — finish far post.'}]);
(async()=>{
 // toggle: sign on first click, then hide/show without re-signing
 const btn=mkEl('button');btn.textContent='Play clip';
 const node={dataset:{clipPath:P1},classList:{add(c){node.cls=c}},kids:[btn],ownerDocument:doc,
  querySelector(sel){return sel==='.hc-clip-play'?node.kids.find(k=>k.tagName==='button')||null:sel==='video'?node.kids.find(k=>k.tagName==='video')||null:sel==='.hc-clip-state'?node.kids.find(k=>k.tagName==='small')||null:null},
  appendChild(c){node.kids.push(c);c.remove=()=>{node.kids=node.kids.filter(x=>x!==c)};return c}};
 btn.remove=()=>{node.kids=node.kids.filter(x=>x!==btn)};
 assert.equal(await C.toggle(node,doc),true);
 const v=node.querySelector('video');
 assert.ok(v&&v.controls===true&&v.preload==='none'&&/^https:\/\/.+token=t$/.test(v.src)&&v.played);
 assert.equal(btn.textContent,'Hide clip');
 await C.toggle(node,doc);assert.equal(v.hidden,true);assert.equal(btn.textContent,'Play clip');
 await C.toggle(node,doc);assert.equal(v.hidden,false);
 assert.deepEqual(signed,[[P1,3600]],'Signed once, for one hour');
 // missing clip -> Clip unavailable, button removed
 const b2=mkEl('button');const n2={dataset:{clipPath:TEAM+'/missing.mp4'},classList:{add(c){n2.cls=c}},kids:[b2],ownerDocument:doc,querySelector:node.querySelector,appendChild:node.appendChild};
 n2.querySelector=function(sel){return sel==='.hc-clip-play'?n2.kids.find(k=>k.tagName==='button')||null:sel==='video'?n2.kids.find(k=>k.tagName==='video')||null:sel==='.hc-clip-state'?n2.kids.find(k=>k.tagName==='small')||null:null};
 n2.appendChild=c=>{n2.kids.push(c);return c};b2.remove=()=>{n2.kids=n2.kids.filter(x=>x!==b2)};
 assert.equal(await C.toggle(n2,doc),false);
 assert.equal(n2.cls,'is-unavailable');assert.ok(!n2.querySelector('.hc-clip-play'));assert.equal(n2.querySelector('.hc-clip-state').textContent,'Clip unavailable');

 // Team clips: lists <team>/pregame-clips/<date>/<opponent>/ with the signed-in client, labels from report lines
 const listed=[];
 store.list=async(prefix)=>{listed.push(prefix);
  if(prefix===TEAM+'/pregame-clips')return {data:[{name:'2026-10-18',id:null},{name:'notes.txt',id:'x'}],error:null};
  if(prefix===TEAM+'/pregame-clips/2026-10-18/saint_john')return {data:[{name:'2026-10-18_06_rebound-goal.mp4',id:'a'},{name:'2026-10-18_07_backdoor-goal.mp4',id:'b'}],error:null};
  return {data:[],error:null}};
 assert.match(C.teamButton('Saint John Sea Dogs','## Video review\n- 18:00–18:07 · backdoor goal — far post. '+M(P1)),/class="hc-team-btn" data-hc-team="Saint John Sea Dogs"/);
 assert.ok(C.slugsFor('Saint John Sea Dogs').includes('saint_john'));
 const team=JSON.parse(JSON.stringify(await C.teamClips('Saint John Sea Dogs')));
 assert.deepEqual(team.map(c=>c.path),[P2,P1]);
 assert.equal(team[1].label,'18:00–18:07 · backdoor goal — far post.');
 assert.equal(team[0].label,'rebound goal','Fallback label from the file name');
 assert.ok(listed.every(p=>p.startsWith(TEAM+'/pregame-clips')),'Lists only the team clip folder');
 assert.match(fs.readFileSync('hitmen-report-view.js','utf8'),/CLIPS\(\)\.teamButton\(report\.opponent_name,report\.report\)/);
 assert.match(fs.readFileSync('hitmen-opponent-scout.js','utf8'),/innerHTML=teamClipsBtn\(\)\+/);
 // War Room Tonight: markers never leak into threats/plan; clips listed as compact toggles in "Across from us"
 const wctx={window:Object.assign(window,{}),document:{readyState:'loading',addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[]},console,Intl,Date,setInterval(){},URLSearchParams,location:{search:''}};
 vm.runInNewContext(fs.readFileSync('war-room-tonight.js','utf8'),wctx);
 const W=window.WRTonight;
 const row={id:'4132a58e-aefe-42d2-8700-633ff61d431b',created_at:'2026-10-16T00:19:08Z',evidence_summary:{approved:true},
  report:'SAINT JOHN\n\n## What can hurt us\n- Backdoor plays off the half-wall. '+M(P1)+'\n## Plan to win\n1. Shoot low. '+M(P2)+'\n## Video review (Grok Bot, Oct 17)\n- 18:00–18:07 · backdoor <goal> — far post. '+M(P1)};
 const r=W.parseReport(row);
 assert.equal(r.clips.length,3);
 assert.ok([...r.threats,...r.plan].every(t=>!/\[clip\]|storage:/.test(t)),'No raw markers in extracted text');
 const html=W.acrossHTML({v:{mgmt:true},standings:[],games:[]},{gm:4,time:'10:10 PM',lg:null,abbr:'SJ',short:'Saint John',name:'Saint John Sea Dogs',id:'1b42b79c-ee02-4ecc-9a2a-d018283903aa',report:r});
 assert.match(html,/Film clips · 3/);
 assert.equal((html.match(/class="hc-clip-play"/g)||[]).length,3);
 assert.ok(html.includes('18:00–18:07 · backdoor &lt;goal&gt; — far post.'),'Clip labels escaped');
 assert.ok(!/\[clip\]\(storage:/.test(html));

 // Opponent scout + Lineup Room + report pages load the shared helper first and route mentions through it
 const scout=fs.readFileSync('hitmen-opponent-scout.js','utf8');
 assert.match(scout,/clipHtml\(esc\(m\.text\)\)/);
 for(const [page,js] of [['hitmen-opponent-scout.html','hitmen-opponent-scout'],['hitmen-lineup.html','hitmen-rooms'],['hitmen-scouting.html','hitmen-rooms'],['hitmen-workspace.html','war-room-tonight'],['hitmen-game-center.html','war-room-tonight'],['hitmen-team-locker.html','war-room-tonight'],['hitmen-player-locker.html','war-room-tonight'],['hitmen-scouting-report.html','hitmen-report-view'],['hitmen-vod-report.html','hitmen-report-view']]){
  const h=fs.readFileSync(page,'utf8'),a=h.indexOf('<script src="hitmen-clips.js?v='),b=h.indexOf('<script src="'+js+'.js?v=');
  assert.ok(a>=0&&b>a,page+' loads hitmen-clips.js before '+js+'.js');
 }
 // styling stays neutral: no team red / gold in the clip styles
 const css=fs.readFileSync('hitmen-clips.js','utf8').match(/const CSS=([\s\S]*?);\nfunction install/)[1];
 assert.ok(!/#d7192d|#ff4054|#ff5365|#efd58c|215,25,45|255,64,84/i.test(css),'Neutral clip styling');
 console.log('PASS: shared clip helper (compact toggle signs once for 1h, escaping, bad paths, Clip unavailable); War Room clips list; scout/lineup/report pages wired.');
})().catch(e=>{console.error(e);process.exit(1)});
