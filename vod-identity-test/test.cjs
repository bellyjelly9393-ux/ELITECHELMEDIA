const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {initialize,reconcile,authorized,checkIsolation,games}=require('./server.cjs');
test('test deployment refuses production credentials and unauthenticated access',()=>{
 const e={TEST_ACCESS_TOKEN:'x'.repeat(40)};checkIsolation(e);
 for(const field of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','WORKER_QUEUE_SECRET','HITMEN_GM_PROFILE_URL'])assert.throws(()=>checkIsolation({...e,[field]:'configured'}));
 assert.throws(()=>checkIsolation({}));assert.equal(authorized('Bearer '+e.TEST_ACCESS_TOKEN,e.TEST_ACCESS_TOKEN),true);assert.equal(authorized('Bearer wrong',e.TEST_ACCESS_TOKEN),false);
});
test('real installer resolves verified aliases, preserves ambiguity, counts all 12 without inventing evidence',async()=>{
 const db=new PGlite();try{
  await initialize(db);const game=games[0],p=game.players[0],q=game.players[1];
  const locker=uid=>'b0000000-0000-4000-8000-'+String(uid).padStart(12,'0');
  for(const name of ['MarkerAliasOne','MarkerAliasTwo'])await db.query("select public.vod_verify_player_alias($1,$2,$3,'broadcast','Synthetic regression marker at 00:10')",[game.test_review_id,name,locker(p.lg_user_id)]);
  const rows=[{player:p.player,evidence_timestamps:[10]},{player:'MarkerAliasOne',evidence_timestamps:[20]},{player:'MarkerAliasTwo',evidence_timestamps:[30]},{player:q.player,evidence_timestamps:[]},{player:'Unknown',evidence_timestamps:[40]}];
  const a=await reconcile(db,game,{game_rollup:{player_reports:rows}});
  assert.equal(a.expected_players,12);assert.equal(a.canonical_reports.length,2);assert.equal(a.attributed_players,1);assert.equal(a.unresolved.length,1);assert.equal(a.canonical_reports[0].source_names.length,3);assert.equal(a.coverage.filter(p=>p.evidence_status==='no_attributed_observation').length,11);
  assert.equal((await db.query('select public.vod_resolve_player_identity($1,$2) as x',[games[1].test_review_id,'MarkerAliasOne'])).rows[0].x.status,'unresolved');
  await db.query("select public.vod_verify_player_alias($1,'MarkerAliasOne',$2,'broadcast','Conflicting synthetic marker evidence')",[game.test_review_id,locker(q.lg_user_id)]);
  assert.equal((await db.query('select public.vod_resolve_player_identity($1,$2) as x',[game.test_review_id,'MarkerAliasOne'])).rows[0].x.reason,'ambiguous_alias');
  assert.equal((await db.query('select count(*)::int as n from public.team_player_game_reports')).rows[0].n,0);
 }finally{await db.close();}
});
