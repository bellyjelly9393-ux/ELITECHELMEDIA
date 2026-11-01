'use strict';
// This service cannot connect to Supabase. All DB records live on its own volume.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {timingSafeEqual}=require('node:crypto');
const {spawn}=require('node:child_process');
const {PGlite}=require('@electric-sql/pglite');
const MANAGER='a0000000-0000-4000-8000-000000000001',TEAM='a0000000-0000-4000-8000-000000000002';
const games=require('./games.json');
const locker=uid=>'b0000000-0000-4000-8000-'+String(uid).padStart(12,'0');
const gameKey=id=>'c0000000-0000-4000-8000-'+String(id).padStart(12,'0');
function checkIsolation(env){
 if(env.SUPABASE_URL||env.SUPABASE_SERVICE_ROLE_KEY||env.WORKER_QUEUE_SECRET||env.HITMEN_GM_PROFILE_URL)throw Error('Test service refuses production-connected configuration');
 if(!env.TEST_ACCESS_TOKEN||env.TEST_ACCESS_TOKEN.length<32)throw Error('Private test access token required');
}
function authorized(header,key){const a=Buffer.from(header||''),b=Buffer.from('Bearer '+key);return a.length===b.length&&timingSafeEqual(a,b);}
async function reconcile(db,game,result){
 const rows=result?.game_rollup?.player_reports||[];
 const reports=new Map(),unresolved=[];
 for(const row of rows){
  const name=typeof row.player==='string'?row.player:'';
  const identity=(await db.query('select public.vod_resolve_player_identity($1,$2) as x',[game.test_review_id,name])).rows[0].x;
  if(identity.status!=='resolved'){unresolved.push({source:row,identity});continue;}
  const key=JSON.stringify(identity.canonical_key);
  const item=reports.get(key)||{canonical_key:identity.canonical_key,lg_user_id:identity.lg_user_id,source_names:[],observations:[]};
  if(!item.source_names.includes(name))item.source_names.push(name);
  item.observations.push(row);reports.set(key,item);
 }
 const observed=new Set([...reports].filter(([,v])=>v.observations.some(o=>Array.isArray(o.evidence_timestamps)&&o.evidence_timestamps.some(t=>typeof t==='number'&&Number.isFinite(t)))).map(([k])=>k));
 return {expected_players:game.players.length,attributed_players:observed.size,resolved_player_rows:reports.size,unresolved_name_count:unresolved.length,
  canonical_reports:[...reports.values()],unresolved,
  coverage:game.players.map(p=>({...p,canonical_key:['LGCHL',55,String(p.lg_user_id)],evidence_status:observed.has(JSON.stringify(['LGCHL',55,String(p.lg_user_id)]))?'attributed_report':'no_attributed_observation'})),
  limitation:'Roster presence is not a performance assessment. Unresolved names are retained. Only final rollup reports are counted; raw period/chunk evidence remains in worker_result.'};
}
async function initialize(db){
 if(!(await db.query("select to_regclass('public.test_jobs') as t")).rows[0].t){
  await db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
  const identity=fs.readFileSync(fs.existsSync(path.join(__dirname,'identity.sql'))?path.join(__dirname,'identity.sql'):path.join(__dirname,'../docs/sql/vod_lg_identity.sql'),'utf8');
  await db.exec(identity);
  await db.exec('create table public.test_jobs(lg_game_id bigint primary key,job_id uuid not null,created_at timestamptz default now()); grant select on public.test_jobs to authenticated;');
 }
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[MANAGER]);
 for(const g of games){
  await db.query('insert into public.hitmen_schedule_games values($1,$2,55) on conflict do nothing',[gameKey(g.lg_game_id),TEAM]);
  await db.query('insert into public.vod_review_sessions(id,team_id,schedule_game_id,updated_at,source_start_seconds,source_end_seconds,duration_seconds) values($1,$2,$3,now(),$4,$5,$6) on conflict do nothing',[g.test_review_id,TEAM,gameKey(g.lg_game_id),g.source_start_seconds,g.source_end_seconds,g.source_end_seconds-g.source_start_seconds]);
  for(const p of g.players){
   await db.query('insert into public.team_player_lockers values($1,$2,55,$3,$4,$5) on conflict do nothing',[locker(p.lg_user_id),TEAM,p.lg_user_id,p.player,p.position]);
   const proof='LG client final game sheet '+g.lineup_source.url+'; '+p.team+' '+p.position;
   await db.query("insert into public.vod_verified_game_players(schedule_game_id,team_id,league,season,lg_user_id,locker_id,evidence,verified_by) values($1,$2,'LGCHL',55,$3,$4,$5,$6) on conflict do nothing",[gameKey(g.lg_game_id),TEAM,String(p.lg_user_id),locker(p.lg_user_id),proof,MANAGER]);
   await db.query("select public.vod_verify_player_alias($1,$2,$3,'gamertag',$4)",[g.test_review_id,p.player,locker(p.lg_user_id),proof]);
  }
 }
 // All resolver/alias operations below execute as the RLS-constrained test manager.
 await db.exec('set role authenticated');
}
async function main(){
 checkIsolation(process.env);
 const data=process.env.DATA_DIR||path.join(__dirname,'data');fs.mkdirSync(data,{recursive:true});
 const db=new PGlite(path.join(data,'identity'));await initialize(db);
 const worker=spawn(process.env.PYTHON||'python3',[path.join(__dirname,'worker/test_bootstrap.py')],{env:{...process.env,DATA_DIR:path.join(data,'worker'),REPLAY_ADMIN_TOKEN:process.env.TEST_ACCESS_TOKEN},stdio:'inherit'});
 let workerExited=false;worker.on('exit',()=>{workerExited=true;});worker.on('error',()=>{workerExited=true;});
 const workerFetch=async(url,body)=>{
  const r=await fetch('http://127.0.0.1:8081'+url,{method:body?'POST':'GET',headers:{'X-Test-Key':process.env.TEST_ACCESS_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const result=await r.json();if(!r.ok)throw Object.assign(Error(result.error||'Test worker request failed'),{status:r.status});return result;
 };
 const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 let queue=Promise.resolve();
 const server=http.createServer((req,res)=>{
  const run=async()=>{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/health'&&req.method==='GET'){
    let w=null;try{w=await workerFetch('/health');}catch{}
    return reply(res,w&&!workerExited?200:503,{status:w&&!workerExited?'ok':'starting',isolated:true,database:'PGlite on dedicated test volume',productionDatabaseConfigured:false,revision:process.env.RAILWAY_GIT_COMMIT_SHA||'local',worker:w});
   }
   if(url.pathname==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(__dirname,'index.html')));}
   if(!authorized(req.headers.authorization,process.env.TEST_ACCESS_TOKEN))return reply(res,401,{error:'Test access required'});
   if(url.pathname==='/api/games'&&req.method==='GET')return reply(res,200,{games,scope:'Two games with final LG client captures; no production report writes.'});
   const m=url.pathname.match(/^\/api\/games\/(\d+)(?:\/(start|aliases))?$/),g=m&&games.find(g=>String(g.lg_game_id)===m[1]);
   if(!g)return reply(res,404,{error:'Test game not found'});
   let body={};if(req.method==='POST'){
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return reply(res,413,{error:'Request too large'});}body=JSON.parse(raw||'{}');
   }
   if(m[2]==='aliases'&&req.method==='POST'){
    const p=g.players.find(p=>String(p.lg_user_id)===String(body.lg_user_id));
    if(!p||!['gamertag','chel_character','broadcast'].includes(body.kind)||typeof body.name!=='string'||body.name.trim().length>80||typeof body.evidence!=='string'||body.evidence.trim().length<12)return reply(res,400,{error:'A verified participant, alias type, name and evidence are required'});
    await db.query('select public.vod_verify_player_alias($1,$2,$3,$4,$5)',[g.test_review_id,body.name,locker(p.lg_user_id),body.kind,body.evidence]);return reply(res,201,{verified_for_test_game:true});
   }
   const jobs=(await db.query('select job_id from public.test_jobs where lg_game_id=$1',[g.lg_game_id])).rows;
   if(m[2]==='start'&&req.method==='POST'){
    if(jobs.length)return reply(res,409,{error:'This test already has a job. Existing results are preserved.',job_id:jobs[0].job_id});
    const lineup=g.players.map(p=>`${p.position} ${p.player}`).join('\n');
    const seeded=await workerFetch('/test/jobs',{...g,review_id:g.test_review_id,owner:MANAGER,players:lineup,game_format:'6s',force_new_job:true});
    await db.exec('reset role');try{await db.query('insert into public.test_jobs(lg_game_id,job_id) values($1,$2)',[g.lg_game_id,seeded.job_id]);}finally{await db.exec('set role authenticated');}
    return reply(res,202,seeded);
   }
   if(!m[2]&&req.method==='GET'){
    if(!jobs.length)return reply(res,200,{game:g,status:'not_started'});
    const job=await workerFetch('/test/jobs/'+jobs[0].job_id);
    return reply(res,200,{game:g,job,identity_audit:await reconcile(db,g,job.result)});
   }
   return reply(res,405,{error:'Method not allowed'});
  };
  // PGlite role/session changes must never interleave across HTTP requests.
  queue=queue.then(run,run).catch(error=>{console.error('Test request failed:',error.name);if(!res.headersSent)reply(res,error.status||500,{error:error.status?error.message:'Test request failed'});else res.end();});
 });
 server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>{
  if(process.env.RUN_INITIAL_TESTS!=='1')return;
  // Loopback-only automated tests work without a public Railway domain.
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const local=async(suffix,body)=>{
   const r=await fetch('http://127.0.0.1:'+Number(process.env.PORT||8080)+suffix,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.TEST_ACCESS_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
   const data=await r.json();if(!r.ok&&r.status!==409)throw Error('Local test HTTP '+r.status);return data;
  };
  (async()=>{
   let healthy=false;for(let n=0;n<90;n++){try{await workerFetch('/health');healthy=true;break;}catch{await pause(1000);}}
   if(!healthy)throw Error('Private worker startup timed out');
   for(const g of games){const started=await local('/api/games/'+g.lg_game_id+'/start',{});console.log('IDENTITY_TEST_STARTED',JSON.stringify({lg_game_id:g.lg_game_id,job_id:started.job_id}));}
   const terminal=new Set(['ready_for_review','failed','expired','needs_periods','awaiting_ai']),previous=new Map();
   for(let n=0;n<240;n++){
    let done=true;for(const g of games){
     const d=await local('/api/games/'+g.lg_game_id),a=d.identity_audit;
     const snapshot={lg_game_id:g.lg_game_id,status:d.job?.status||d.status,error:d.job?.error||'',expected_players:a?.expected_players,attributed_players:a?.attributed_players,unresolved_names:a?.unresolved_name_count,stage:d.job?.result?.stage};
     const key=JSON.stringify(snapshot);if(previous.get(g.lg_game_id)!==key){console.log('IDENTITY_TEST_STATUS',key);previous.set(g.lg_game_id,key);}
     if(!terminal.has(snapshot.status))done=false;
    }
    if(done)return;await pause(30000);
   }
   console.log('IDENTITY_TEST_MONITOR_TIMEOUT');
  })().catch(error=>console.error('IDENTITY_TEST_MONITOR_ERROR',error.message));
 });
 for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{worker.kill();server.close();db.close().finally(()=>process.exit(0));});
}
module.exports={checkIsolation,authorized,reconcile,initialize,games};
if(require.main===module)main().catch(error=>{console.error('Test startup failed:',error.message);process.exit(1);});
