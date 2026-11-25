(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const pregame = byId('czechiaPregameTab');
  const gameplay = byId('czechiaGameplayTab');
  const matchSelect = byId('czechiaMatch');
  const player = byId('czechiaPregamePlayer');
  const status = byId('czechiaPregameStatus');
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
      return;
    }
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

  function setMatch(match) {
    byId('czechiaMatchTitle').textContent = 'Czechia vs ' + match.opponent;
    byId('czechiaMatchDay').textContent = dateLabel.format(new Date(match.date + 'T12:00:00Z')) + ' · ' + match.time;
    player.title = 'Czechia vs ' + match.opponent + ' pregame · 3D rink and hockey cards';
    player.src = '/czechia-obs.html?' + new URLSearchParams({game: match.key, view: 'live-hub'});
    status.hidden = true;
    byId('czechiaPregameFrame').hidden = false;
  }

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
    const gameDate = ordered.find(match => match.key === requested)?.date ??
      ordered.find(match => match.date >= today)?.date ?? ordered.at(-1).date;
    const fixtures = ordered.filter(match => match.date === gameDate);
    const now = gameTime.format(new Date());
    const selected = fixtures.find(match => match.key === requested) ??
      (gameDate === today ? fixtures.find(match => scheduledTime(match) >= now) ?? fixtures.at(-1) : fixtures[0]);

    matchSelect.replaceChildren(...fixtures.map(match =>
      new Option(match.time + ' · ' + match.opponent, match.key)));
    matchSelect.value = selected.key;
    byId('czechiaMatchLabel').hidden = fixtures.length < 2;
    matchSelect.addEventListener('change', () => {
      const match = fixtures.find(item => item.key === matchSelect.value);
      if (match) setMatch(match);
    });
    setMatch(selected);
  }

  pregame.addEventListener('click', () => showGameplay(false));
  gameplay.addEventListener('click', () => showGameplay(true));
  loadPregame().catch(() => { status.textContent = 'Czechia pregame is temporarily unavailable.'; });
})();
