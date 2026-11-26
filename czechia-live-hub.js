(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const pregame = byId('czechiaPregameTab');
  const gameplay = byId('czechiaGameplayTab');
  const matchSelect = byId('czechiaMatch');
  const player = byId('czechiaPregamePlayer');
  const status = byId('czechiaPregameStatus');
  // On the Live Hub the Czechia players only run while the World Juniors channel is open.
  const section = player.closest('[data-channel]');
  const watching = () => !section || !section.hidden;
  const gameTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Toronto', hourCycle: 'h23', hour: '2-digit', minute: '2-digit'
  });
  const dateLabel = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric'
  });

  function showGameplay(show) {
    pregame.setAttribute('aria-pressed', String(!show));
    gameplay.setAttribute('aria-pressed', String(show));
    byId('czechiaPregamePanel').hidden = show;
    byId('czechiaGameplayPanel').hidden = !show;
    const live = byId('czechiaPlayer');
    if (!show) {
      live.removeAttribute('src');
      const match = currentFixtures.find(item => item.key === matchSelect.value);
      if (match) setMatch(match);
      return;
    }
    // Stop the 3D pregame while the gameplay feed is showing.
    clearTimeout(carbonTimer);
    player.removeAttribute('src');
    shown = '';
    if (live.hasAttribute('src')) return;
    const feed = new URL(byId('czechiaGameplayLink').href);
    const query = new URLSearchParams({channel:feed.pathname.slice(1), parent:location.hostname, autoplay:'false'});
    live.src = feed.hostname === 'www.youtube.com'
      ? 'https://www.youtube.com/embed/' + encodeURIComponent(feed.searchParams.get('v'))
      : 'https://player.twitch.tv/?' + query;
  }

  function scheduledTime(match) {
    const clock = /^(\d{1,2}):(\d{2}) (AM|PM) ET$/.exec(match.time);
    if (!clock) return '';
    const hour = Number(clock[1]) % 12 + (clock[3] === 'PM' ? 12 : 0);
    return String(hour).padStart(2, '0') + ':' + clock[2];
  }

  const frame = byId('czechiaPregameFrame');
  let shown = '';
  let carbonTimer = 0;

  function showPublicRink(match) {
    clearTimeout(carbonTimer);
    frame.classList.remove('is-carbon');
    player.src = '/czechia-obs.html?' + new URLSearchParams({game: match.key, view: 'live-hub'});
  }

  // Carbon Arena pregame for viewers: a short pregame-only pass for this matchup,
  // then the off-air Carbon view. If the device cannot render Carbon, or it does not
  // report ready in time, the public 3D rink and hockey cards are shown instead.
  async function showCarbon(match) {
    const base = '/czechia/arena/' + encodeURIComponent(match.key) + '/';
    try {
      const session = await fetch(base + 'viewer-session', {method: 'POST', cache: 'no-store'});
      if (shown !== match.key) return;
      if (!session.ok) throw new Error('Carbon unavailable');
      frame.classList.add('is-carbon');
      player.src = base + 'broadcast.html?' + new URLSearchParams({preview: 'desk', team: 'czechia', game: match.key});
      clearTimeout(carbonTimer);
      carbonTimer = setTimeout(() => { if (shown === match.key) showPublicRink(match); }, 25000);
    } catch {
      if (shown === match.key) showPublicRink(match);
    }
  }

  addEventListener('message', event => {
    const data = event.data;
    if (event.origin !== location.origin || event.source !== player.contentWindow ||
        data?.protocol !== 'icevision:desk-preview:1' || data.game !== shown) return;
    if (data.state === 'ready') clearTimeout(carbonTimer);
    if (data.state === 'renderer-error') {
      const match = currentFixtures.find(item => item.key === shown);
      if (match) showPublicRink(match);
    }
  });

  let currentFixtures = [];
  function setMatch(match) {
    if (shown === match.key) return;
    shown = match.key;
    byId('czechiaMatchTitle').textContent = 'Czechia vs ' + match.opponent;
    byId('czechiaMatchDay').textContent = dateLabel.format(new Date(match.date + 'T12:00:00Z')) + ' · ' + match.time;
    player.title = 'Czechia vs ' + match.opponent + ' pregame · Carbon Arena and hockey cards';
    status.hidden = true;
    frame.hidden = false;
    if (!watching()) { shown = ''; return; }
    showCarbon(match);
  }

  // The next matchup that has not started yet: between games this is the next game
  // tonight, and after the last game it is the first game of the next game day.
  function nextMatch(ordered, today) {
    const now = gameTime.format(new Date());
    return ordered.find(match => match.date === today && scheduledTime(match) > now) ??
      ordered.find(match => match.date > today) ??
      ordered.filter(match => match.date === today).at(-1) ?? ordered.at(-1);
  }

  let pickedByViewer = false;
  async function loadPregame() {
    const feed = window.ECMCzechiaPregame;
    if (!feed) throw new Error('Schedule module unavailable');
    const {games} = await feed.load();
    const ordered = [...games].sort((a, b) =>
      a.date.localeCompare(b.date) || scheduledTime(a).localeCompare(scheduledTime(b)));
    if (!ordered.length) {
      status.textContent = 'The next Czechia matchup will appear when the schedule is posted.';
      return;
    }
    const today = feed.today();
    const requested = new URLSearchParams(location.search).get('game');
    const asked = ordered.find(match => match.key === requested);
    if (asked) pickedByViewer = true;
    const selected = asked ?? nextMatch(ordered, today);
    const fixtures = ordered.filter(match => match.date === selected.date);
    currentFixtures = ordered;

    matchSelect.replaceChildren(...fixtures.map(match =>
      new Option(match.time + ' · ' + match.opponent, match.key)));
    matchSelect.value = selected.key;
    byId('czechiaMatchLabel').hidden = fixtures.length < 2;
    setMatch(selected);
  }

  matchSelect.addEventListener('change', () => {
    const match = currentFixtures.find(item => item.key === matchSelect.value);
    if (match) { pickedByViewer = true; setMatch(match); }
  });

  // Keep the page on the next matchup while it stays open between games,
  // unless the viewer picked a matchup themselves.
  setInterval(() => {
    if (pickedByViewer || document.hidden || !watching()) return;
    loadPregame().catch(() => {});
  }, 60000);

  // Leaving the channel stops Carbon and the gameplay player; coming back restarts the view that was open.
  document.addEventListener('livehub:channel', event => {
    if (event.detail.channel !== 'wjr') {
      clearTimeout(carbonTimer);
      player.removeAttribute('src');
      byId('czechiaPlayer').removeAttribute('src');
      shown = '';
      return;
    }
    if (gameplay.getAttribute('aria-pressed') === 'true') { showGameplay(true); return; }
    if (pickedByViewer) {
      const match = currentFixtures.find(item => item.key === matchSelect.value);
      if (match) setMatch(match);
      return;
    }
    loadPregame().catch(() => {});
  });

  pregame.addEventListener('click', () => showGameplay(false));
  gameplay.addEventListener('click', () => showGameplay(true));
  loadPregame().catch(() => { status.textContent = 'Czechia pregame is temporarily unavailable.'; });
})();
