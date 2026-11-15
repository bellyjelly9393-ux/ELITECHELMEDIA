/* EliteChel Media S55 Playoff Central. The LGCHL feed supplies hockey scores; only verified
   contest series in Supabase accept picks and award points. Never infer a final from the clock. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { bracket: null, league: 'ALL', round: 'R1', series: [], picks: new Map(), saved: new Map(), dbReady: false };
  // HTML data-* attributes are strings, while Supabase can return numeric series IDs.
  // Use one key type for draft picks and saved picks so rerenders preserve changes.
  const seriesKey = (id) => String(id);
  const db = () => window.VVHLBackend?.db;
  const user = () => window.VVHLBackend?.state?.user;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const team = (id) => state.bracket?.teams?.[String(id)] || { id, name: id ? 'Team #' + id : 'To be decided', nick: id ? 'Team #' + id : 'TBD', seed: null, logo: '' };
  const logo = (t) => /^assets\/[a-z0-9/_-]+\.(png|webp|jpg)$/i.test(t?.logo || '') ? '<img src="' + esc(t.logo) + '" alt="" loading="lazy">' : '';
  const safeLgUrl = (url) => {
    try { const u = new URL(url); return u.protocol === 'https:' && (u.hostname === 'leaguegaming.com' || u.hostname === 'www.leaguegaming.com') ? u.href : ''; } catch { return ''; }
  };
  const et = (value) => {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? new Intl.DateTimeFormat('en-CA', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/Toronto', timeZoneName:'short' }).format(ms) : 'Time TBD';
  };
  const number = (v) => Number.isInteger(Number(v)) && v !== null && v !== '' ? Number(v) : null;

  function slots() {
    const data = state.bracket;
    if (!data) return [];
    const list = [];
    for (const l of data.leagues || []) {
      for (const c of l.conferences || []) {
        for (const r of c.rounds || []) {
          for (const s of r.slots || []) list.push({ ...s, league:l.name, conference:c.name, round:r.label });
        }
      }
      if (l.final) list.push({ ...l.final, league:l.name, conference:'Championship', round:'FINAL' });
    }
    if (data.championship?.semi) list.push({ ...data.championship.semi, league:'CUP', conference:'Memorial Cup', round:'CUP' });
    if (data.championship?.final) list.push({ ...data.championship.final, league:'CUP', conference:'Memorial Cup', round:'CUP' });
    return list;
  }

  function gameTile(g, firstId) {
    const final = g.status === 'final' || !!g.winner || (g.away_score != null && g.home_score != null);
    const hasScores = g.away_score != null && g.home_score != null;
    const scheduled = Date.parse(g.at || '');
    let label = 'TBD';
    if (final) {
      if (hasScores) {
        const top = firstId === g.home ? g.home_score : g.away_score;
        const bottom = firstId === g.home ? g.away_score : g.home_score;
        label = top + '–' + bottom;
      } else label = 'Final';
    } else if (g.status === 'live') label = 'Live';
    else if (g.status === 'cancelled') label = 'Off';
    else if (g.status === 'postponed') label = 'PPD';
    else if (Number.isFinite(scheduled) && scheduled <= Date.now()) label = 'Await';
    else if (Number.isFinite(scheduled)) label = new Intl.DateTimeFormat('en-CA', { weekday:'short',hour:'numeric',hour12:true,timeZone:'America/Toronto' }).format(scheduled);
    const title = 'Game ' + esc(g.n) + ' · ' + esc(et(g.at)) + (final ? ' · Final' : '');
    const url = safeLgUrl(g.url);
    const inner = '<b>G' + esc(g.n) + '</b><span>' + esc(label) + '</span>';
    return url ? '<a class="pc-game" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="' + title + '" aria-label="' + title + '">' + inner + '</a>' :
      '<span class="pc-game" title="' + title + '">' + inner + '</span>';
  }

  function scoreCard(s) {
    const a = s.sides?.[0] || {}, b = s.sides?.[1] || {}, ta = team(a.team_id), tb = team(b.team_id);
    const winner = s.clinched ? s.winner_id : null;
    const wins = Array.isArray(s.score) ? s.score : [null,null];
    const describe = (side,t,i) => '<div class="pc-team' + (winner === side.team_id ? ' is-winner' : '') + '">' +
      logo(t) + '<span class="pc-team-name"><small class="pc-team-seed">' + (side.seed != null ? 'Seed #' + esc(side.seed) : 'Seed TBD') + '</small>' +
      esc(t.name || side.from || 'TBD') + '</span><b class="pc-team-score">' + (s.kind === 'series' && wins[i] != null ? esc(wins[i]) : '–') + '</b></div>';
    const games = (s.games || []).map(g => gameTile(g,a.team_id)).join('');
    const played = (s.games || []).some(g => g.status === 'final' || g.winner || (g.away_score != null && g.home_score != null));
    const live = (s.games || []).some(g => g.status === 'live');
    const seriesStatus = winner ? 'FINAL · ADVANCING' : s.kind === 'pending' ? 'MATCHUP TBD' :
      live ? 'GAME IN PROGRESS' : played ? 'SERIES UNDERWAY' : 'SERIES SCHEDULED';
    const safe = safeLgUrl(s.url);
    return '<article class="pc-score"><div class="pc-score-header"><span>' + esc(s.league) + ' · ' + esc(s.conference) + ' · ' + esc(s.round) +
      '</span><span class="pc-final-badge">' + esc(seriesStatus) + '</span></div>' +
      describe(a,ta,0) + describe(b,tb,1) +
      (games ? '<div class="pc-games">' + games + '</div>' : '<p class="pc-footnote">Schedule to be confirmed</p>') +
      '<div class="pc-score-footer"><span>' + (s.kind === 'series' ? 'BEST OF ' + esc(s.best_of || 7) : esc(s.title || 'Bracket position')) + '</span>' +
      (safe ? '<a class="pc-text-link" target="_blank" rel="noopener noreferrer" href="' + esc(safe) + '">Series details ↗</a>' : '<span>LGCHL S55</span>') + '</div></article>';
  }

  function renderScoreboard() {
    const result = slots().filter(s => {
      if (state.league !== 'ALL' && s.league !== state.league) return false;
      if (state.round !== 'ALL' && s.round !== state.round) return false;
      return s.kind === 'series' || (state.round !== 'R1' && s.kind === 'pending');
    });
    $('pcScoreGrid').innerHTML = result.length ? result.map(scoreCard).join('') :
      '<p class="pc-ballot-empty">Matchups for this view are not confirmed yet.</p>';
  }

  async function loadBracket() {
    const notice = $('pcScoreNotice');
    try {
      let res = await fetch('/api/lgchl-playoffs', {cache:'no-store'});
      if (!res.ok) throw new Error('live unavailable');
      const data = await res.json();
      if (!data.leagues?.length) throw new Error('no bracket');
      state.bracket = data;
      notice.textContent = data.stale ? 'Live updates unavailable. Showing the most recent saved bracket.' : '';
      $('pcUpdated').textContent = (data.stale ? 'Saved bracket' : 'Bracket refreshed') + ' · ' + et(data.fetched_at);
    } catch {
      try {
        const res = await fetch('assets/lgchl/playoffs/s55.json', {cache:'no-cache'});
        if (!res.ok) throw new Error('no snapshot');
        state.bracket = await res.json();
        $('pcUpdated').textContent = 'Saved bracket · ' + et(state.bracket.fetched_at);
        notice.textContent = 'League feed unavailable. Showing a saved snapshot, which may be out of date.';
      } catch {
        notice.textContent = 'Unable to load the league bracket. Use the official LeagueGaming link above.';
      }
    }
    renderScoreboard();
    renderBallot();
  }

  function setLeaderPlaceholder(text) { $('pcLeaders').innerHTML = '<tr><td colspan="8">' + esc(text) + '</td></tr>'; }
  async function loadSeries() {
    const client = db();
    if (!client) { $('pcEntryStatus').textContent = 'Account connection unavailable'; return; }
    const { data, error } = await client.from('ecm_playoff_series').select('id,season,round_no,league,conference,team_a,team_b,seed_a,seed_b,lock_at,is_open,confirmed_winner_id,actual_games').eq('season',55).order('round_no').order('id');
    if (error) {
      $('pcEntryStatus').textContent = 'Contest configuration pending';
      $('pcBallotStatus').textContent = 'Entries are not open yet. Scoreboard results remain available above.';
      return;
    }
    state.series = data || [];
    state.dbReady = true;
    renderBallot();
  }

  async function loadSaved() {
    state.saved.clear();
    const client=db(), who=user();
    if (!client || !who) { renderBallot(); return; }
    const [p,h] = await Promise.all([
      client.from('ecm_playoff_picks').select('series_id,winner_id,games').eq('user_id',who.id),
      client.from('ecm_playoff_handles').select('handle').eq('user_id',who.id).maybeSingle()
    ]);
    if (!p.error) (p.data || []).forEach(x => state.saved.set(seriesKey(x.series_id),x));
    if (!h.error && h.data?.handle) $('pcHandle').value=h.data.handle;
    else if (!$('pcHandle').value && window.VVHLBackend.state?.profile?.display_name) $('pcHandle').value=window.VVHLBackend.state.profile.display_name.slice(0,24);
    renderBallot();
  }

  function roundSeries() { return state.series.filter(s => s.round_no === Number($('pcPickRound').value)); }
  function canEnter(items) { return items.length>0 && !!user() && items.every(s => s.is_open && Date.parse(s.lock_at)>Date.now()); }

  function renderBallot() {
    const items = roundSeries();
    const ready = canEnter(items);
    const el = $('pcBallot');
    const button = $('pcSubmit');
    button.disabled = !ready;
    if (!items.length) {
      el.innerHTML='<p class="pc-ballot-empty">Matchups for this round are not ready for predictions yet. Check the live scoreboards above.</p>';
      $('pcEntryStatus').textContent = state.dbReady ? 'Round not published' : 'Preparing contest';
      return;
    }
    $('pcEntryStatus').textContent = ready ? 'Entries open · all series required' : !user() ? 'Sign in to predict' : 'Predictions locked or awaiting launch';
    el.innerHTML=items.map(s=>{
      const a=team(s.team_a),b=team(s.team_b);
      const selected = state.picks.get(seriesKey(s.id)) || state.saved.get(seriesKey(s.id)) || {};
      const locked = !s.is_open || Date.parse(s.lock_at) <= Date.now() || !user();
      const winner = number(selected.winner_id);
      const games = number(selected.games) || 6;
      const choice=(t,side,id,seed)=>{
        const checked=winner===id;
        return '<button type="button" class="pc-pick-option' + (checked?' is-selected':'') + '" data-series="' + esc(s.id) + '" data-winner="' + esc(id) + '"' + (locked?' disabled':'') + ' aria-pressed="' + checked + '">' + logo(t) + '<span>#' + esc(seed) + ' ' + esc(t.nick||t.name) + '</span></button>';
      };
      return '<div class="pc-series-pick"><div class="pc-pick-top">' + esc(s.league) + ' · ' + esc(s.conference) + ' · Lock: ' + esc(et(s.lock_at)) + '</div>' +
        '<div class="pc-pick-teams">' + choice(a,'a',s.team_a,s.seed_a) + '<strong>VS</strong>' + choice(b,'b',s.team_b,s.seed_b) + '</div>' +
        '<div class="pc-length" role="group" aria-label="Predicted series length for ' + esc(a.nick||a.name) + ' versus ' + esc(b.nick||b.name) + '">' +
        '<span>Series ends in</span><div class="pc-length-options">' +
        [4,5,6,7].map(v=>'<button type="button" class="pc-length-option' + (v===games?' is-selected':'') +
          '" data-series-length="' + esc(s.id) + '" data-games="' + v + '"' + (locked?' disabled':'') +
          ' aria-pressed="' + (v===games) + '">' + v + ' games</button>').join('') +
        '</div></div></div>';
    }).join('');
    const incomplete=items.filter(s => !(state.picks.get(seriesKey(s.id))||state.saved.get(seriesKey(s.id)))?.winner_id);
    $('pcBallotStatus').textContent = !user() ? 'Sign into your EliteChel account in the panel to enter.' :
      ready ? 'Choose the winner in every series, then submit. ' + incomplete.length + ' picks still needed.' :
      'This round is closed or is not yet officially open for entries.';
  }

  async function submitBallot() {
    const client=db(), items=roundSeries();
    if (!client || !canEnter(items)) return;
    const handle=$('pcHandle').value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{2,23}$/.test(handle)) {
      $('pcBallotStatus').textContent='Use a 3–24 character name starting with a letter or number. Letters, numbers, spaces, periods, underscores and dashes are allowed.';
      return;
    }
    const ballot=items.map(s=>{
      const v=state.picks.get(seriesKey(s.id))||state.saved.get(seriesKey(s.id))||{};
      return {series_id:s.id,winner_id:number(v.winner_id),games:number(v.games)||6};
    });
    if (ballot.some(x=>x.winner_id===null)) {
      $('pcBallotStatus').textContent='Pick a winner in every series before submitting.';
      return;
    }
    $('pcSubmit').disabled=true;
    $('pcBallotStatus').textContent='Saving your complete round ballot…';
    const {data,error}=await client.rpc('ecm_predictor_submit_ballot',{p_round:Number($('pcPickRound').value),p_handle:handle,p_ballot:ballot});
    if (error) $('pcBallotStatus').textContent='Unable to save: ' + (error.message||'Try again.');
    else {
      ballot.forEach(x=>state.saved.set(seriesKey(x.series_id),x));state.picks.clear();
      $('pcBallotStatus').textContent='Ballot saved for this round. You can revise it before the first game locks.';
      await loadLeaderboard();
    }
    renderBallot();
  }

  async function loadLeaderboard() {
    const client=db();if(!client)return;
    const raw=$('pcLeaderRound').value;
    const {data,error}=await client.rpc('ecm_predictor_leaderboard',{p_round:raw==='ALL'?null:Number(raw)});
    if(error){setLeaderPlaceholder('Leaderboard is being configured.');$('pcLeaderNotice').textContent='No public standings are available yet.';return;}
    if (!data?.length) {setLeaderPlaceholder('No scored entries yet. Be the first to predict.');$('pcLeaderNotice').textContent='Confirmed series results will populate this table.';return;}
    $('pcLeaderNotice').textContent='Leaderboard reflects confirmed outcomes only. Updated ' + et(new Date().toISOString()) + '.';
    $('pcLeaders').innerHTML=data.map(r=>'<tr><td>' + esc(r.rank) + '</td><td>' + esc(r.handle) + '</td><td>' +
      esc(r.points) + '</td><td>' + esc(r.correct_winners) + '</td><td>' + esc(r.exact_calls) + '</td><td>' +
      esc(r.upset_calls) + '</td><td>' + esc(r.perfect_rounds) + '</td><td>' + (r.grand_prize_eligible ? 'Eligible' : 'Missed round') + '</td></tr>').join('');
  }

  document.querySelectorAll('[data-league]').forEach(button=>button.addEventListener('click',()=>{
    state.league=button.dataset.league;
    document.querySelectorAll('[data-league]').forEach(b=>b.classList.toggle('is-on',b===button));
    renderScoreboard();
  }));
  $('pcScoreRound').addEventListener('change',e=>{state.round=e.target.value;renderScoreboard();});
  $('pcPickRound').addEventListener('change',()=>{state.picks.clear();renderBallot();});
  $('pcLeaderRound').addEventListener('change',loadLeaderboard);
  $('pcSubmit').addEventListener('click',submitBallot);
  $('pcBallot').addEventListener('click',e=>{
    const button=e.target.closest('button[data-winner]');if(!button||button.disabled)return;
    const s=seriesKey(button.dataset.series);const current=state.picks.get(s)||state.saved.get(s)||{};
    state.picks.set(s,{...current,winner_id:Number(button.dataset.winner)});
    renderBallot();
  });
  $('pcBallot').addEventListener('click',e=>{
    const button=e.target.closest('button[data-series-length]');if(!button||button.disabled)return;
    const games=Number(button.dataset.games);
    if(![4,5,6,7].includes(games))return;
    const s=seriesKey(button.dataset.seriesLength);
    const current=state.picks.get(s)||state.saved.get(s)||{};
    state.picks.set(s,{...current,games});
    // Update the active option without tearing down the DOM (and losing focus).
    button.closest('.pc-length-options')?.querySelectorAll('button[data-series-length]').forEach(option=>{
      const active=option===button;
      option.classList.toggle('is-selected',active);
      option.setAttribute('aria-pressed',String(active));
    });
  });
  window.addEventListener('vvhl-auth-change',loadSaved);
  Promise.allSettled([loadBracket(),loadSeries(),loadLeaderboard()]).then(loadSaved);
  setInterval(()=>{if(!document.hidden){loadBracket();loadLeaderboard();renderBallot();}},120000);
})();
