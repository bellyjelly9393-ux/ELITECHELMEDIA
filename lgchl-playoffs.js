// Homepage LGCHL Season 55 playoff bracket. Renders /api/lgchl-playoffs and falls back to
// the last saved snapshot if that request fails. Polls once a minute; the API itself
// re-reads LeagueGaming at most every two minutes.
(function () {
  const BOARD = document.getElementById('poBoard');
  const STAMP = document.getElementById('poStamp');
  const NOTE = document.getElementById('poNote');
  if (!BOARD) return;

  const SNAPSHOT = 'assets/lgchl/playoffs/s55.json';
  const LIVE = '/api/lgchl-playoffs';
  const POLL_MS = 60000;
  let shown = null;
  let liveDown = false;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function cityOf(team) {
    if (!team?.name || !team.nick) return '';
    const parts = team.name.split(/\s+/);
    const nickWords = team.nick.split(/\s+/).length;
    if (parts.length <= nickWords) return '';
    return parts.slice(0, -nickWords).join(' ');
  }

  function whenLabel(iso) {
    const t = Date.parse(iso || '');
    if (!Number.isFinite(t)) return '';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(t);
  }

  function pipWhen(game) {
    const t = Date.parse(game.at || '');
    if (!Number.isFinite(t)) return esc((game.label || '').replace(/\s+EST$/, ''));
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h12',
    }).formatToParts(t).map((p) => [p.type, p.value]));
    const min = parts.minute === '00' ? '' : ':' + parts.minute;
    const ap = (parts.dayPeriod || '').slice(0, 1).toLowerCase();
    return `${parts.weekday.slice(0, 2)} ${parts.hour}${min}${ap}`;
  }

  function gameState(game, now) {
    if (game.status === 'cancelled') return 'cancelled';
    if (game.away_score != null && game.home_score != null) return 'final';
    if (game.winner) return 'final';
    const t = Date.parse(game.at || '');
    if (!Number.isFinite(t)) return 'scheduled';
    if (now < t) return 'scheduled';
    if (now < t + 35 * 60 * 1000) return 'live';
    return 'pending';
  }

  function sideLine(side, score, slot, index) {
    const team = side.team_id ? shown.teams[side.team_id] : null;
    const hit = team?.hitmen ? ' is-hitmen' : '';
    const lead = slot.clinched && slot.winner_id && slot.winner_id === side.team_id ? ' is-winner' : '';
    const num = slot.kind === 'series' && side.team_id && score ? `<b class="po-wins">${score[index]}</b>` : '';
    if (!team) {
      return `<div class="po-side is-tbd"><span class="po-tbd">${esc(side.from || 'To be decided')}</span>${num}</div>`;
    }
    const seed = side.seed || team.seed;
    const city = cityOf(team);
    const inner = `<img src="${esc(team.logo)}" width="44" height="44" alt="" loading="lazy"><span class="po-id"><i>${seed ? '#' + esc(seed) : ''}</i><b>${esc(team.nick)}</b>${city ? `<em>${esc(city)}</em>` : ''}</span>${num}`;
    const label = `${seed ? 'Seed ' + seed + ', ' : ''}${team.name}`;
    if (slot.url && slot.kind !== 'pending') {
      return `<a class="po-side${hit}${lead}" href="${esc(slot.url)}" title="${esc(label)}">${inner}</a>`;
    }
    return `<div class="po-side${hit}${lead}" title="${esc(label)}">${inner}</div>`;
  }

  function gamesHtml(slot, now) {
    if (!slot.games?.length) return '';
    const items = slot.games.map((game) => {
      const state = gameState(game, now);
      const a = slot.sides[0]?.team_id;
      let top = game.away_score;
      let bot = game.home_score;
      if (a && game.home === a) { top = game.home_score; bot = game.away_score; }
      let body = pipWhen(game);
      if (state === 'final' && top != null && bot != null) body = `${top}–${bot}`;
      else if (state === 'final') body = 'Final';
      else if (state === 'live') body = 'Live';
      else if (state === 'pending') body = 'Awaiting';
      else if (state === 'cancelled') body = 'Off';
      const title = game.url ? '' : '';
      const tag = game.url ? 'a' : 'div';
      const href = game.url ? ` href="${esc(game.url)}"` : '';
      return `<${tag} class="po-pip is-${state}"${href} title="${esc(game.label || 'Game ' + game.n)}"><b>${esc(game.n)}</b><span>${esc(body)}</span></${tag}>`;
    }).join('');
    return `<div class="po-pips">${items}</div>`;
  }

  function slotHtml(slot, now) {
    if (!slot) return '';
    const kicker = slot.kind === 'bye'
      ? `${esc(slot.label || 'R1')} · Bye`
      : slot.kind === 'series'
        ? `${esc(slot.label)} · Best of ${esc(slot.best_of || 7)}`
        : `${esc(slot.label || '')}${slot.title ? ' · ' + esc(slot.title) : ''}`;
    const seedLine = slot.kind === 'series' && slot.sides?.every((s) => s.seed)
      ? `<span>Seed ${esc(slot.sides[0].seed)} vs ${esc(slot.sides[1].seed)}</span>` : '';
    const score = slot.kind === 'bye' ? null : slot.score;
    const sides = (slot.sides || []).map((side, i) => sideLine(side, score, slot, i)).join('<i class="po-vs" aria-hidden="true">vs</i>');
    const bye = slot.kind === 'bye' ? '<span class="po-adv">Advances</span>' : '';
    const adv = slot.clinched && slot.kind === 'series' ? '<span class="po-adv">Advances</span>' : '';
    return `<article class="po-slot is-${esc(slot.kind)}${slot.clinched ? ' is-clinched' : ''}">
      <header class="po-kicker"><span>${kicker}</span>${seedLine}</header>
      <div class="po-sides">${sides}</div>
      ${bye}${adv}
      ${slot.kind === 'series' ? gamesHtml(slot, now) : ''}
    </article>`;
  }

  function roundCol(round, now) {
    if (!round?.slots?.length) return '';
    return `<div class="po-col"><p class="po-round"><b>${esc(round.label)}</b><span>${esc(round.title)}</span></p>${round.slots.map((s) => slotHtml(s, now)).join('')}</div>`;
  }

  function conferenceHtml(conf, now) {
    const rounds = conf.rounds || [];
    const r1 = rounds[0]?.slots || [];
    const r2 = rounds[1]?.slots || [];
    const r3 = rounds[2]?.slots || [];
    const pairs = [];
    for (let i = 0; i < r1.length; i += 2) {
      pairs.push(`<div class="po-pair">
        <div class="po-pair-in">${slotHtml(r1[i], now)}${r1[i + 1] ? slotHtml(r1[i + 1], now) : ''}</div>
        <i class="po-elbow" aria-hidden="true"></i>
        <div class="po-pair-next">${r2[i / 2] ? slotHtml(r2[i / 2], now) : ''}</div>
      </div>`);
    }
    return `<section class="po-conf">
      <h3 class="po-conf-name">${esc(conf.name)}</h3>
      <div class="po-tree">
        <div class="po-pairs">${pairs.join('')}</div>
        ${r3[0] ? `<div class="po-r3"><i class="po-elbow po-elbow-lg" aria-hidden="true"></i>${slotHtml(r3[0], now)}</div>` : ''}
      </div>
    </section>`;
  }

  function leagueHtml(league, now) {
    return `<section class="po-league" id="po-${esc(league.id)}" data-league="${esc(league.id)}">
      <header class="po-league-head"><span class="po-rule" aria-hidden="true"></span><h3>${esc(league.name)}</h3></header>
      <div class="po-league-grid">${(league.conferences || []).map((c) => conferenceHtml(c, now)).join('')}</div>
      ${league.final ? `<div class="po-league-final">${slotHtml(league.final, now)}</div>` : ''}
    </section>`;
  }

  function champHtml(champ, now) {
    if (!champ?.semi && !champ?.final) return '';
    return `<section class="po-champ" id="po-cup" data-league="CUP">
      <header class="po-league-head"><span class="po-rule" aria-hidden="true"></span><h3>Championship</h3></header>
      <div class="po-champ-row">
        ${slotHtml(champ.semi, now)}
        <i class="po-elbow" aria-hidden="true"></i>
        ${slotHtml(champ.final, now)}
      </div>
      <p class="po-champ-note">The WHL and OHL champions meet in the semifinal. The winner plays the QMJHL champion in the final.</p>
    </section>`;
  }

  function render(data, flags = {}) {
    shown = data;
    const now = Date.now();
    const down = flags.liveDown || liveDown;
    BOARD.innerHTML = `${(data.leagues || []).map((l) => leagueHtml(l, now)).join('')}${champHtml(data.championship, now)}`;
    const when = whenLabel(data.fetched_at);
    if (STAMP) {
      STAMP.dateTime = data.fetched_at || '';
      STAMP.textContent = when ? 'Updated ' + when : '';
    }
    const live = document.getElementById('poLive');
    if (live) {
      const stale = !!(data.stale || down);
      live.classList.toggle('is-stale', stale);
      live.querySelector('b').textContent = stale ? 'Saved' : 'Live';
    }
    if (NOTE) {
      if (data.stale || down) {
        NOTE.hidden = false;
        NOTE.textContent = when
          ? 'Live update is unavailable. Showing the last saved bracket from ' + when + '.'
          : 'Live update is unavailable. Showing the last saved bracket.';
      } else {
        NOTE.hidden = true;
        NOTE.textContent = '';
      }
    }
  }

  function usable(data) {
    return !!(data && data.ok !== false && data.leagues?.length && data.teams);
  }

  function consider(data) {
    if (!usable(data)) return;
    if (shown && !data.stale && shown.stale) { render(data); return; }
    if (shown && Date.parse(shown.fetched_at || 0) > Date.parse(data.fetched_at || 0)) return;
    render(data);
  }

  async function pull() {
    try {
      const res = await fetch(LIVE, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!usable(data)) throw new Error('empty');
      liveDown = !!data.stale;
      consider(data);
    } catch {
      liveDown = true;
      if (shown) render(shown, { liveDown: true });
      else {
        BOARD.innerHTML = '<p class="po-empty">The playoff bracket is temporarily unavailable. <a href="https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=playoffs&leagueid=39&seasonid=55">Open the official LeagueGaming bracket</a>.</p>';
      }
    }
  }

  document.querySelectorAll('[data-po-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-po-tab');
      document.querySelectorAll('[data-po-tab]').forEach((el) => {
        const on = el === btn;
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const root = document.getElementById('playoffs');
      if (root) root.setAttribute('data-view', id);
      const target = document.getElementById(id === 'CUP' ? 'po-cup' : 'po-' + id);
      if (target && window.matchMedia('(min-width: 860px)').matches) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  fetch(SNAPSHOT, { cache: 'no-cache' })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => { if (usable(data)) consider(data); })
    .catch(() => {})
    .finally(pull);

  setInterval(() => { if (!document.hidden) pull(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
})();
