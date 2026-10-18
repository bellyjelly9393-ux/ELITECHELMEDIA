// Lineup Room: pregame report clips render as compact 'Play clip' toggles (shared hitmen-clips.js); harness from test-hitmen-tonight-prep.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const snap=JSON.parse(fs.readFileSync('data/hitmen/season-55-week-3-posted-lineups.json'));
const tonight=snap.games.filter(g=>g.lg_game_id>=917493&&g.lg_game_id<=917554);
assert.equal(tonight.length,3);
for(const g of tonight){assert.equal(g.status,'verified_posted_lineups');for(const side of ['calgary','opponent'])for(const p of ['LW','C','RW','LD','RD','G'])assert.ok(g.lineups[side][p]);}
const stand=[{lg_team_id:412,name:'Calgary Hitmen',league:'WHL',conference:'Eastern',w:11,l:11,otl:2},...tonight.map(g=>({lg_team_id:g.opponent_lg_team_id,name:g.opponent_name,league:'WHL',conference:'Eastern',gp:24,w:10,l:10,otl:4,pts:24}))];
const games=tonight.map(g=>({lg_game_id:g.lg_game_id,game_at:g.scheduled_at,status:'scheduled',home_lg_team_id:g.calgary_side==='away'?g.opponent_lg_team_id:412,away_lg_team_id:g.calgary_side==='away'?412:g.opponent_lg_team_id}));
// Some snapshots encode Calgary side only via the known schedule.
games[1].home_lg_team_id=tonight[1].opponent_lg_team_id;games[1].away_lg_team_id=412;
const schedule=tonight.map(g=>({id:g.scheduled_game_id,scheduled_at:g.scheduled_at,opponent_name:g.opponent_name}));
const reports=tonight.map((g,i)=>({id:'report-'+i,scheduled_game_id:g.scheduled_game_id,opponent_name:g.opponent_name,report:'## Plan to win\n- Protect the middle. [clip](storage:hitmen-vod-clips/b0bcbdda-da9d-419d-8f61-b34937966d49/pregame-clips/2026-10-18/barrie/2026-10-18_01_barrie-collapse-blocks.mp4)\n## Video review (Grok Bot, Oct 17)\n- 01:54–02:00 · Barrie <b>collapse</b> blocks [clip](storage:hitmen-vod-clips/b0bcbdda-da9d-419d-8f61-b34937966d49/pregame-clips/2026-10-18/barrie/2026-10-18_01_barrie-collapse-blocks.mp4)\n- bad [clip](storage:hitmen-player-images/x/y.mp4)',evidence_summary:{lineups:g.lineups},created_at:'2026-10-13T21:00:00Z'}));
const lockers=Object.values(tonight[0].lineups.calgary).map((tag,i)=>({id:'locker-'+i,player_id:'player-'+i,gamertag:tag,roster_class:'active_roster',lg_user_id:i+1}));
const elements=new Map();
const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:false,handlers:{},addEventListener(k,f){this.handlers[k]=f},querySelector(){return el(id+'child')}});return elements.get(id)};
const db={from(table){let data={team_player_lockers:lockers,lineups:[],hitmen_schedule_games:schedule,hitmen_opponent_pregame_reports:reports,hitmen_battle_plans:[]}[table]||[];const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},then(ok){return Promise.resolve({data,error:null}).then(ok)}};return q}};
const F={day:new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',month:'short',day:'numeric'}),longDay:new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',dateStyle:'full'}),md:new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',month:'short',day:'numeric'}),time:new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',hour:'numeric',minute:'2-digit'})};
const etDate=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const document={body:{dataset:{room:'lineup'}},getElementById:el};
const window={WMDesk:{$:el,esc:s=>String(s??'').replace(/</g,'&lt;'),nb:s=>s,F,etDate,ordinal:s=>s,logo:s=>s||'',read:async table=>table==='lgchl_standings_current'?stand:table==='lgchl_games'?games:[],tint(){},menu(){}},VVHLBackend:{db,state:{user:{id:'admin'},profile:{role:'admin'}}},addEventListener(){}};
const Clock=class extends Date { constructor(...args){super(...(args.length?args:['2026-10-13T21:00:00Z']))} static now(){return Date.parse('2026-10-13T21:00:00Z')} };
const ctx={window,document,console,Date:Clock,URLSearchParams,location:{search:''},history:{replaceState(){}},setInterval(){}};
document.head=null;
vm.runInNewContext(fs.readFileSync('hitmen-clips.js','utf8'),ctx);
assert.ok(window.HitmenClips,'shared clip helper loads first');
vm.runInNewContext(fs.readFileSync('hitmen-rooms.js','utf8'),ctx);
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(setImmediate)};
(async()=>{
 await flush();
 const html=el('sheetBody').innerHTML;
 assert.match(html,/pregame-excerpt/);
 const CLIP='b0bcbdda-da9d-419d-8f61-b34937966d49/pregame-clips/2026-10-18/barrie/2026-10-18_01_barrie-collapse-blocks.mp4';
 assert.equal(html.split('class="hc-clip is-compact" data-clip-path="'+CLIP+'"').length-1,2,'Both valid clip markers become toggles');
 assert.match(html,/<button type="button" class="hc-clip-play" aria-expanded="false">Play clip<\/button>/);
 assert.ok(!/\[clip\]\(storage:hitmen-vod-clips/.test(html),'No raw clip markers');
 assert.ok(!html.includes('<b>collapse</b>'),'Report text stays escaped');
 assert.ok(!/data-clip-path="[^"]*hitmen-player-images/.test(html)&&!html.includes('hitmen-player-images/x/y.mp4"'),'Other buckets never become players');
 console.log('PASS: Lineup Room pregame excerpt shows private clips as Play clip toggles; text escaped; raw markers hidden.');
})().catch(e=>{console.error(e);process.exit(1)});
