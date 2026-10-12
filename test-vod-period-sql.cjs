// Real PostgreSQL semantics in an isolated, in-memory database; no production connection.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create schema auth; create schema private;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function private.vvhl_can_manage_team(uid uuid,team uuid) returns boolean language sql as $$select uid='00000000-0000-0000-0000-000000000001'::uuid$$;
   create table public.vod_review_sessions(id uuid primary key,team_id uuid,updated_at timestamptz,status text,source_start_seconds integer,source_end_seconds integer,duration_seconds integer,skip_ranges jsonb,overtime_count integer);
   create table public.vod_review_segments(id uuid default gen_random_uuid(),review_id uuid,team_id uuid,segment_type text,segment_index integer,label text,start_seconds integer,end_seconds integer,status text,confidence text,updated_at timestamptz,archived_at timestamptz,archived_by uuid);
   insert into public.vod_review_sessions(id,team_id,status,updated_at) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','queued',now());`);
  const source=fs.readFileSync(__dirname+'/docs/sql/vod_period_temp_cleanup.sql','utf8');
  assert.match(source,/delete from pg_temp\.vd where true;/);
  await db.exec(source);
  await db.query("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
  const periods=[1,2,3].map((n)=>({segment_type:'period',segment_index:n,label:'Period '+n,start_seconds:2070+(n-1)*400,end_seconds:2070+n*400}));
  const save=async(p=periods,skips=[])=>db.query("select public.set_vod_period_windows($1,null,2070,3270,$2::jsonb,$3::jsonb) as result",['00000000-0000-0000-0000-000000000003',JSON.stringify(p),JSON.stringify(skips)]);
  const first=await save();assert.equal(first.rows[0].result.added,3);
  const again=await save();assert.equal(again.rows[0].result.kept,3);assert.equal(again.rows[0].result.added,0);
  await db.exec("update public.vod_review_segments set status='complete' where segment_index=1");
  const changed=periods.map(p=>({...p}));changed[0].end_seconds=2400;changed[1].start_seconds=2400;
  await assert.rejects(save(changed),/Approved periods are protected/);
  await assert.rejects(save(periods,[{start:2000,end:2100}]),/Invalid skipped section/);
  assert.equal((await db.query('select count(*)::int as n from public.vod_review_segments where archived_at is null')).rows[0].n,3);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(save(),/Management access is required/);
  console.log('PASS: isolated PostgreSQL period save, qualified temporary cleanup, no-op re-save, approved period protection, skip validation and authorization guard');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
