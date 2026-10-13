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
const reports=tonight.map((g,i)=>({id:'report-'+i,scheduled_game_id:g.scheduled_game_id,opponent_name:g.opponent_name,report:'## Plan to win\n- Protect the middle.',evidence_summary:{lineups:g.lineups},created_at:'2026-10-13T21:00:00Z'}));
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
vm.runInNewContext(fs.readFileSync('hitmen-rooms.js','utf8'),ctx);
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(setImmediate)};
(async()=>{await flush();assert.equal((el('nightTabs').innerHTML.match(/role="tab"/g)||[]).length,3,'All three tabs even with no saved plans or lineups');assert.match(el('sheetBody').innerHTML,/report-0/);assert.match(el('sheetBody').innerHTML,/lllG1lll/);assert.match(el('sixF').innerHTML,/gtcoop73/);assert.doesNotMatch(el('sheetBody').innerHTML,/Im-Rukia/);
for(let i=1;i<3;i++){el('nightTabs').handlers.click({target:{closest:()=>({dataset:{i:String(i)}})}});await flush();assert.match(el('sheetBody').innerHTML,new RegExp('report-'+i));assert.match(el('sheetBody').innerHTML,new RegExp(i===1?'Im-Rukia':'DeaconDish21'));assert.doesNotMatch(el('sheetBody').innerHTML,/lllG1lll/);assert.match(el('labEye').textContent,i===1?/Away/:/Home/);}
const html=fs.readFileSync('hitmen-lineup.html','utf8');for(const id of ['nightTabs','opponentHistory','sixF','sixD','sixG'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);assert.match(html,/id="hqApp" hidden/);
assert.match(fs.readFileSync('hitmen-lineup-room.js','utf8'),/not pickable\n\s*S.snapshots=/,'Opponent/schedule assignments execute outside comment');
console.log('PASS: complete verified snapshots; all three game tabs without plans; exact report links; game-specific opponent six; posted Calgary positions; current night only; protected initial page.');})().catch(e=>{console.error(e);process.exitCode=1});
