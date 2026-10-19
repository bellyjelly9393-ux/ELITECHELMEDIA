// Sticky VOD player-name links: real PostgreSQL semantics in an isolated in-memory database.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const T='00000000-0000-4000-8000-0000000000aa',U='00000000-0000-4000-8000-000000000001';
const L55='00000000-0000-4000-8000-000000000055',L56='00000000-0000-4000-8000-000000000056',OTHER='00000000-0000-4000-8000-000000000057';
const R1='00000000-0000-4000-8000-0000000000b1',R2='00000000-0000-4000-8000-0000000000b2';
const G55='00000000-0000-4000-8000-0000000000c5',G56='00000000-0000-4000-8000-0000000000c6';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role authenticated; create role anon; create role service_role;
   create schema auth; create schema private;
   create table auth.users(id uuid primary key); insert into auth.users values('${U}');
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function private.vvhl_can_manage_team(uid uuid,team uuid) returns boolean language sql security definer as $$select uid='${U}'::uuid$$;
   create table public.teams(id uuid primary key); insert into public.teams values('${T}');
   create table public.team_player_lockers(id uuid primary key,team_id uuid,season integer,gamertag text,position text,lg_user_id bigint,user_id uuid,player_id uuid);
   create table public.hitmen_schedule_games(id uuid primary key,team_id uuid,season integer,week smallint);
   create table public.vod_review_sessions(id uuid primary key,team_id uuid,schedule_game_id uuid,updated_at timestamptz,review_document jsonb,full_game_summary text,tactical_report text,player_report text,status text,game_date timestamptz,opponent_label text,vod_url text,source_start_seconds integer,source_end_seconds integer,created_by uuid,worker_status text,worker_result jsonb);
   create table public.vod_review_segments(id uuid primary key default gen_random_uuid(),review_id uuid,archived_at timestamptz,status text,start_seconds integer);
   create table public.vod_review_markers(id uuid default gen_random_uuid(),segment_id uuid,timestamp_seconds integer);
   create table public.vod_game_publications(review_id uuid primary key,team_id uuid,report jsonb,active boolean default true,published_by uuid,published_at timestamptz default now());
   create table public.team_player_game_reports(id uuid default gen_random_uuid(),team_id uuid,season integer,locker_id uuid,schedule_game_id uuid,game_date timestamptz,opponent_name text,position_played text,ai_review_id uuid,stats jsonb,visibility text,created_by uuid,strengths text,improvements text,tactical_notes text,coach_summary text,updated_at timestamptz,evidence jsonb,week integer);
   create unique index on public.team_player_game_reports(ai_review_id,locker_id) where ai_review_id is not null;
   create table public.lineups(id uuid,team_id uuid,schedule_game_id uuid,is_active boolean);
   create table public.lineup_slots(lineup_id uuid,player_id uuid);
   create table public.hitmen_discord_player_links(locker_id uuid,season integer,roster_alias text);
   create table private.vod_player_aliases(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.teams(id) on delete cascade,season integer not null,
     locker_id uuid not null references public.team_player_lockers(id) on delete cascade,source_alias text not null,created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
   create unique index vod_player_aliases_unique on private.vod_player_aliases(team_id,season,lower(btrim(source_alias)));
   grant usage on schema public,private,auth to authenticated,anon;
   grant select,insert,update on all tables in schema public to authenticated;
   grant execute on function auth.uid() to authenticated,anon;
   insert into public.team_player_lockers values('${L55}','${T}',55,'Gullyrr','C',777,null,null),('${L56}','${T}',56,'Gullyrr','C',777,null,null),('${OTHER}','${T}',55,'thenny32','LW',null,null,null);
   insert into public.hitmen_schedule_games values('${G55}','${T}',55,1),('${G56}','${T}',56,1);
   insert into private.vod_player_aliases(team_id,season,locker_id,source_alias,created_at) values('${T}',55,'${OTHER}','HENNY',now()-interval '1 day');
   insert into public.vod_review_sessions(id,team_id,schedule_game_id,updated_at,review_document) values
    ('${R1}','${T}','${G55}',now(),'{"players":[{"player":"I Gully I"},{"player":"Opp Guy"}]}'),
    ('${R2}','${T}','${G56}',now(),'{"players":[{"player":"i gully i"},{"player":"Opp Guy"},{"player":"Henny"}]}');`);
  const routing=fs.readFileSync(__dirname+'/docs/sql/vod_structured_report_routing.sql','utf8');
  await db.exec(routing);
  await db.exec(fs.readFileSync(__dirname+'/docs/sql/20261018_vod_player_aliases_persist.sql','utf8'));
  await db.exec(`create trigger route_vod_player_reports_after_result after update of worker_result,worker_status on public.vod_review_sessions for each row execute function public.route_vod_player_reports();`);
  const q=async(sql,args)=>(await db.query(sql,args)).rows;
  await db.exec(`select set_config('request.jwt.claim.sub','${U}',false); set role authenticated;`);
  const ctx=async id=>(await q('select public.vod_player_match_context($1) c',[id]))[0].c;
  const publish=async(id,doc)=>{const at=(await q('select updated_at from public.vod_review_sessions where id=$1',[id]))[0].updated_at;return (await q('select public.publish_vod_review($1,$2,$3) r',[id,at,JSON.stringify(doc)]))[0].r;};
  let c=await ctx(R1);
  assert.deepEqual(c.saved,{henny:OTHER},'existing alias rows are exposed as saved links');
  assert.ok(Array.isArray(c.candidates)&&Array.isArray(c.suggestions)&&c.matches,'existing response keys preserved');
  await publish(R1,{players:[{player:'I Gully I',strengths:'a'},{player:'Opp Guy'}],player_matches:{'i gully i':L55,'opp guy':'ignore'}});
  await db.exec('reset role;');
  const rows=await q('select lower(source_alias) a,season,locker_id,ignored from private.vod_player_aliases order by 1');
  assert.deepEqual(rows.map(r=>[r.a,r.season,r.locker_id,r.ignored]),[['henny',55,OTHER,false],['i gully i',55,L55,false],['opp guy',55,null,true]]);
  await db.exec('set role authenticated;');
  // A new season's VOD: the season-55 link maps to the same player's season-56 locker.
  c=await ctx(R2);
  assert.equal(c.saved['i gully i'],L56);assert.equal(c.saved['opp guy'],'ignore');assert.equal(c.saved.henny,undefined,'no season-56 locker for henny');
  const res=await publish(R2,{players:[{player:'i gully i',strengths:'b'},{player:'Opp Guy'}]});
  assert.equal(res.player_reports,1);assert.deepEqual(res.unmatched_players,[]);
  const pub=(await q('select report from public.vod_game_publications where review_id=$1',[R2]))[0].report;
  assert.equal(pub.player_matches['i gully i'],L56,'saved link applied without re-linking');assert.equal(pub.player_matches['opp guy'],'ignore');
  // Explicit choice in this review beats the saved link; clearing forgets it.
  await publish(R2,{players:[{player:'i gully i'},{player:'Opp Guy'}],player_matches:{'opp guy':''}});
  c=await ctx(R2);assert.equal(c.saved['opp guy'],undefined);assert.equal(c.saved['i gully i'],L56);
  await db.exec('reset role;');
  assert.equal((await q("select season from private.vod_player_aliases where lower(source_alias)='i gully i'"))[0].season,56,'latest link wins');
  // Routing trigger compiles, maps across seasons, and skips excluded names.
  await db.exec(`insert into private.vod_player_aliases(team_id,season,source_alias,ignored) values('${T}',56,'Opp Guy',true)`);
  const chunk=n=>({label:'P1',start:0,end:1,review:{player_evaluations:[{player:n,evidence_timestamps:[5],strengths:'x'}],observations:[{player:n,source:'gameplay'}]}});
  await db.exec(`insert into public.vod_review_sessions(id,team_id,schedule_game_id,updated_at) values('00000000-0000-4000-8000-0000000000b3','${T}','${G56}',now())`);
  await db.query("update public.vod_review_sessions set created_by=$1,worker_status='ready_for_review',worker_result=$2 where id='00000000-0000-4000-8000-0000000000b3'",[U,JSON.stringify({chunks:[chunk('I Gully I'),chunk('Opp Guy')]})]);
  const drafts=await q(`select locker_id from public.team_player_game_reports where ai_review_id='00000000-0000-4000-8000-0000000000b3'`);
  assert.deepEqual(drafts.map(d=>d.locker_id),[L56],'alias routed to the season-56 locker; nothing for excluded/unknown names');
  // Grants and security mode are preserved.
  const fns=await q("select proname,prosecdef from pg_proc where proname in ('publish_vod_review','vod_player_match_context','route_vod_player_reports','vod_saved_player_matches','vod_remember_player_matches','vod_alias_locker_for_season') order by 1");
  assert.deepEqual(Object.fromEntries(fns.map(f=>[f.proname,f.prosecdef])),{publish_vod_review:false,route_vod_player_reports:false,vod_alias_locker_for_season:false,vod_player_match_context:false,vod_remember_player_matches:true,vod_saved_player_matches:true});
  await db.exec('set role authenticated;');
  await assert.rejects(q('select * from private.vod_player_aliases'),/permission denied/);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',false)`);
  await assert.rejects(q(`select private.vod_saved_player_matches('${T}',56)`),/Management access/);
  await assert.rejects(q(`select private.vod_remember_player_matches('${R2}','{"x":"ignore"}')`),/Management access/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(q(`select private.vod_saved_player_matches('${T}',56)`),/permission denied/);
  console.log('PASS: saved links exposed, publish remembers links/excludes (latest wins), cross-season mapping, explicit override and clear, routing skips excluded names, definer helpers guarded');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
