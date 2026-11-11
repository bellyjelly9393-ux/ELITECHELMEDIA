(() => {
  'use strict';
  const M = window.HitmenPostgame, db = window.VVHLBackend?.db;
  if (!M || !db) return;
  const $ = id => document.getElementById(id);
  const auth = () => window.VVHLBackend?.state || {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let games = [], game = null, post = null, epoch = 0, account = '', loading = false, saving = false, dirty = false, postReady = false, vodReady = false;
  const message = (id, text) => { $(id).textContent = text; };
  const current = token => token === epoch && M.canRead(auth());
  const vodHref = id => 'vod-lab.html?team=calgary-hitmen&review=' + encodeURIComponent(id);
  function controls() {
    const write = M.canPublish(auth()) && !!game && postReady && !loading && !saving;
    $('reportHeadline').disabled = $('reportAnalyst').disabled = !write;
    $('saveReportDraftBtn').disabled = !write;
    $('publishReportBtn').disabled = !write || !M.final(game);
    $('generateReportBtn').disabled = !write || !M.final(game) || !!post || dirty;
    $('createGameVodBtn').disabled = !M.canManageVOD(auth()) || !game || !vodReady || loading || saving;
    $('reportGameSelect').disabled = loading || saving || !games.length;
    $('refreshScheduleBtn').disabled = loading || saving;
    $('saveReportDraftBtn').textContent = post?.published ? 'Save Published Changes' : 'Save Draft';
    $('publishReportBtn').textContent = post?.published ? 'Update Published Report' : 'Publish Report';
  }
  function reset() {
    game = null; post = null; postReady = false; vodReady = false; dirty = false;
    $('reportHeadline').value = $('reportAnalyst').value = '';
    for (const id of ['vodReviewLinks','reportFactsPreview']) $(id).replaceChildren();
    for (const id of ['reportState','reportSaveMessage','vodMessage']) message(id, '');
    for (const id of ['lgGameLink','lgCaptureLink','publishedReportLink']) { $(id).hidden = true; $(id).removeAttribute('href'); }
    controls();
  }
  async function findPost(g) {
    const id = M.lgId(g);
    let q = db.from('media_posts').select('*').eq('post_type','recap')
      .eq('source_metrics->>team','Calgary Hitmen').eq('source_metrics->>season',String(g.season));
    q = id ? q.or('source_metrics->>schedule_game_id.eq.' + g.id + ',source_metrics->>lg_game_id.eq.' + id)
      : q.eq('source_metrics->>schedule_game_id',g.id);
    const {data,error} = await q.order('published',{ascending:false}).order('updated_at',{ascending:false}).limit(10);
    if (error) throw error;
    const rows = (data || []).filter(p => M.matches(p,g));
    if (rows.filter(p => p.published).length > 1) throw new Error('Multiple published recaps are linked to this game. Resolve the duplicates before editing.');
    return rows[0] || null;
  }
  async function findReviews(g) {
    const {data,error} = await db.from('vod_review_sessions')
      .select('id,title,status').eq('team_id',M.TEAM).eq('schedule_game_id',g.id).order('created_at');
    if (error) throw error;
    return data || [];
  }
  function showReviews(rows) {
    $('vodReviewLinks').innerHTML = rows.map(r => '<a class="small-btn" href="' + vodHref(r.id) + '">' + esc(r.title || 'Open VOD review') + (r.status === 'archived' ? ' (archived)' : '') + '</a>').join('');
    $('createGameVodBtn').hidden = rows.length > 0;
    message('vodMessage',rows.length ? 'Open the saved review to inspect periods and approved evidence.' : 'No VOD review is linked yet. Set one up, then add the recording and game window in VOD Lab.');
  }
  async function selectGame(id) {
    const token = ++epoch;
    reset();
    game = games.find(g => g.id === id) || null;
    if (!game) { message('reportState','Select a Hitmen game.'); return; }
    const g = game;
    const url = new URL(location.href); url.searchParams.delete('game'); url.searchParams.set('schedule',g.id);
    history.replaceState(null,'',url);
    $('reportFactsPreview').textContent = M.label(g);
    if (M.lgId(g)) {
      $('lgGameLink').href = g.source_url; $('lgGameLink').hidden = false;
      $('lgCaptureLink').href = 'lg-capture.html?mode=authsync&source=game&lg=' + encodeURIComponent(g.source_url) + '&return=' + encodeURIComponent('postgame-desk.html?schedule=' + g.id);
      $('lgCaptureLink').hidden = false;
    }
    message('reportState','Loading saved recap…'); message('vodMessage','Checking linked VOD reviews…');
    controls();
    await Promise.all([
      (async () => {
        try {
          const found = await findPost(g); if (!current(token)) return;
          post = found; postReady = true;
          $('reportHeadline').value = post?.title || ''; $('reportAnalyst').value = post?.body || '';
          message('reportState', (post ? post.published ? 'Published recap loaded. Saving preserves its publication status.' : 'Saved private draft loaded.' : M.final(g) ? 'No recap yet. Start a draft from the verified final.' : 'Scheduled game — postgame publishing unlocks once a final score is recorded.') +
            (M.canPublish(auth()) ? '' : ' Recap editing and publishing require an Admin or Commissioner.'));
          if (post?.published) { $('publishedReportLink').href = 'hitmen-recap.html?id=' + encodeURIComponent(post.id); $('publishedReportLink').hidden = false; }
        } catch (e) { if (current(token)) message('reportState','Recap could not load: ' + e.message + ' Reload the saved schedule to retry.'); }
        finally { if (current(token)) controls(); }
      })(),
      (async () => {
        try { const rows = await findReviews(g); if (!current(token)) return; vodReady = true; showReviews(rows); }
        catch (e) { if (current(token)) message('vodMessage','VOD links could not load: ' + e.message); }
        finally { if (current(token)) controls(); }
      })()
    ]);
  }
  async function loadSchedule() {
    const token = ++epoch, previous = game?.id;
    loading = true; games = []; reset();
    $('reportGameSelect').innerHTML = '<option value="">Loading Hitmen schedule…</option>';
    message('scheduleMessage','Loading all Season ' + M.SEASON + ' Hitmen games…');
    if (!M.canRead(auth())) { loading = false; controls(); return; }
    try {
      const rows = [];
      // Page the complete season; do not silently rely on the API row cap.
      for (let from = 0; ; from += 500) {
        const {data,error} = await db.from('hitmen_schedule_games').select('*').eq('team_id',M.TEAM).eq('season',M.SEASON)
          .order('scheduled_at').order('id').range(from,from + 499);
        if (error) throw error;
        if (!current(token)) return;
        rows.push(...(data || [])); if ((data || []).length < 500) break;
      }
      games = rows;
      $('reportGameSelect').innerHTML = games.length ? games.map(g => '<option value="' + esc(g.id) + '">' + esc(M.label(g)) + '</option>').join('') : '<option value="">No Hitmen games available</option>';
      message('scheduleMessage',games.length + ' Hitmen games · Season ' + M.SEASON + ' · Eastern time');
      const wanted = new URLSearchParams(location.search).get('schedule') || previous;
      const selected = games.find(g => g.id === wanted) || games.find(g => new Date(g.scheduled_at).getTime() >= Date.now()) || games.at(-1);
      loading = false;
      if (selected) { $('reportGameSelect').value = selected.id; await selectGame(selected.id); }
      else controls();
    } catch(e) {
      if (!current(token)) return;
      loading = false; $('reportGameSelect').innerHTML = '<option value="">Schedule unavailable</option>';
      message('scheduleMessage','Could not load the Hitmen schedule: ' + e.message); controls();
    }
  }
  async function save(publish) {
    if (!M.canPublish(auth()) || !game || !postReady || saving || loading) return;
    const g = game, existing = post, token = epoch, userId = auth().user.id;
    const title = $('reportHeadline').value.trim(), body = $('reportAnalyst').value.trim();
    if (!title || !body) return message('reportSaveMessage','Add a headline and report first.');
    if ((publish || existing?.published) && !M.final(g)) return message('reportSaveMessage','A verified final score is required for publication.');
    saving = true; controls(); message('reportSaveMessage','Saving…');
    try {
      // Check for an auto-writer or another editor before writing. Never replace an unseen report.
      const latest = await findPost(g);
      if (!current(token) || auth().user?.id !== userId) return;
      if ((latest?.id || null) !== (existing?.id || null) || (latest && latest.updated_at !== existing.updated_at))
        throw new Error('This recap changed elsewhere. Copy your edits, then reload the saved schedule before saving.');
      const published = Boolean(publish || existing?.published);
      const payload = { title, body, post_type:'recap', season:'S' + g.season,
        source_metrics: M.metadata(g,existing?.source_metrics), published, is_auto_draft:false,
        author_id: existing?.author_id || userId,
        published_at: existing?.published_at || (published ? new Date().toISOString() : null),
        updated_at: new Date().toISOString() };
      const query = existing ? db.from('media_posts').update(payload).eq('id',existing.id).eq('updated_at',existing.updated_at) : db.from('media_posts').insert(payload);
      const {data,error} = await query.select('*').single();
      if (error) throw error;
      if (!current(token)) return;
      post = data; dirty = false;
      message('reportSaveMessage',published ? 'Published to the Calgary Hitmen report archive.' : 'Private draft saved.');
      message('reportState',published ? 'Published recap loaded. Saving preserves its publication status.' : 'Saved private draft loaded.');
      if (published) { $('publishedReportLink').href = 'hitmen-recap.html?id=' + encodeURIComponent(data.id); $('publishedReportLink').hidden = false; }
    } catch(e) { if (current(token)) message('reportSaveMessage','Not saved: ' + e.message); }
    finally { saving = false; controls(); }
  }
  async function createVod() {
    if (!M.canManageVOD(auth()) || !game || !vodReady || loading || saving) return;
    const g = game, token = epoch, userId = auth().user.id;
    saving = true; controls(); message('vodMessage','Checking for an existing review…');
    try {
      const rows = await findReviews(g);
      if (!current(token) || auth().user?.id !== userId) return;
      if (rows.length) { showReviews(rows); return; }
      const {data,error} = await db.from('vod_review_sessions').insert({
        team_id:M.TEAM, schedule_game_id:g.id, title:'Calgary vs ' + g.opponent_name + ' · ' + M.date(g),
        opponent_label:g.opponent_name, game_type:'league', game_date:g.scheduled_at,
        status:'queued', intake_mode:'scout', game_format:'6s', created_by:userId
      }).select('id,title,status').single();
      if (error) throw error;
      if (!current(token)) return;
      showReviews([data]);
      message('vodMessage','Review created. Open it to add the recording and game window. Analysis has not started.');
    } catch(e) { if (current(token)) message('vodMessage','Could not set up the review: ' + e.message); }
    finally { saving = false; controls(); }
  }
  const discard = () => !dirty || window.confirm('Leave these unsaved recap edits?');
  $('reportGameSelect').addEventListener('change',() => {
    const id = $('reportGameSelect').value;
    if (!discard()) { $('reportGameSelect').value = game?.id || ''; return; }
    selectGame(id);
  });
  $('refreshScheduleBtn').addEventListener('click',() => { if (discard()) loadSchedule(); });
  for (const id of ['reportHeadline','reportAnalyst']) $(id).addEventListener('input',() => { dirty = true; controls(); });
  $('generateReportBtn').addEventListener('click',() => {
    if (!M.canPublish(auth()) || !game || !postReady || post || dirty || saving) return;
    try { const d = M.draft(game); $('reportHeadline').value = d.title; $('reportAnalyst').value = d.body; dirty = true; controls(); }
    catch(e) { message('reportSaveMessage',e.message); }
  });
  $('saveReportDraftBtn').addEventListener('click',() => save(false));
  $('publishReportBtn').addEventListener('click',() => save(true));
  $('createGameVodBtn').addEventListener('click',createVod);
  window.addEventListener('beforeunload',e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  function access() {
    const s = auth(), allowed = M.canRead(s);
    document.querySelectorAll('[data-management-content]').forEach(el => { el.hidden = !allowed; });
    $('managementLockedMessage').hidden = allowed;
    if (!allowed) message('managementLockedMessage','Calgary Hitmen management sign-in is required for this desk.');
    const key = JSON.stringify([s.user?.id, allowed, M.canPublish(s), M.canManageVOD(s)]);
    if (key === account) return; account = key;
    ++epoch; loading = false; games = []; reset();
    if (allowed) loadSchedule();
    else { $('reportGameSelect').innerHTML = '<option value="">Sign in to load Hitmen games</option>'; message('scheduleMessage',''); }
  }
  window.addEventListener('vvhl-auth-change',access);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',access);
  else access();
})();
