(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SRC = { lgchl: 'data/transactions/lgchl-s55.json', lg3s: 'data/transactions/lg3s-s1.json' };
  const cache = {};
  let league = new URLSearchParams(location.search).get('league') === 'lg3s' ? 'lg3s' : 'lgchl';
  const tname = t => (t && t.name) ? t.name : 'Team TBD';
  const logo = (lg, t) => t && t.lg_team_id && lg === 'lgchl' ? '<img src="assets/lgchl/s55/team' + Number(t.lg_team_id) + '.png" width="44" height="44" alt="" loading="lazy" onerror="this.remove()">' : '<span class="tx-tbd" aria-hidden="true">?</span>';
  const fmt = d => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/.exec(d || ''); if (!m) return esc(d || ''); const dt = new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + (m[4] ? ' · ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ET' : ''); };
  const list = (assets, cls) => '<ul class="' + cls + '">' + (assets && assets.length ? assets.map(a => '<li>' + esc(a) + '</li>').join('') : '<li class="tx-none">Nothing listed</li>') + '</ul>';
  const side = (lg, t, gets, sends) => '<div class="tx-side' + (t && t.name ? '' : ' is-tbd') + '"><div class="tx-team">' + logo(lg, t) + '<b>' + esc(tname(t)) + '</b></div><p class="tx-lab">RECEIVES</p>' + list(gets, 'tx-get') + '<p class="tx-lab">SENDS</p>' + list(sends, 'tx-send') + '</div>';
  function card(lg, x) {
    return '<article class="tx-card"><header><time>' + fmt(x.date_et) + '</time>' + (x.lg_notes ? '<span class="tx-flag">' + esc(x.lg_notes) + '</span>' : '') + '</header>' +
      '<div class="tx-sides">' + side(lg, x.team1, x.team1_receives, x.team2_receives) + '<div class="tx-mid" aria-hidden="true">TRADE</div>' + side(lg, x.team2, x.team2_receives, x.team1_receives) + '</div>' +
      '<footer>' + (x.notes ? '<p>' + esc(x.notes) + '</p>' : '') + (x.source_url && /^https:\/\/www\.leaguegaming\.com\//.test(x.source_url) ? '<a class="tx-src" href="' + esc(x.source_url) + '" target="_blank" rel="noopener noreferrer">Source ↗</a>' : '') + '</footer></article>';
  }
  async function load(lg) { if (!cache[lg]) { const r = await fetch(SRC[lg], { cache: 'no-store' }); if (!r.ok) throw Error(r.status); cache[lg] = await r.json(); } return cache[lg]; }
  function teamsOf(d) { const s = new Set(); (d.trades || []).forEach(x => [x.team1, x.team2].forEach(t => s.add(tname(t)))); return [...s].sort(); }
  async function render() {
    document.querySelectorAll('.tx-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.league === league)));
    $('pane').setAttribute('aria-labelledby', 'tab-' + league); document.body.dataset.league = league;
    let d; try { d = await load(league); } catch (e) { $('pane').innerHTML = '<p class="tx-empty">Transactions are unavailable right now.</p>'; $('txCount').textContent = ''; return; }
    const sel = $('fTeam'), cur = sel.value; sel.innerHTML = '<option value="">All teams</option>' + teamsOf(d).map(t => '<option' + (t === cur ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const team = sel.value, from = $('fFrom').value, to = $('fTo').value;
    const all = (d.trades || []).slice().sort((a, b) => String(b.date_et).localeCompare(String(a.date_et)));
    const rows = all.filter(x => (!team || tname(x.team1) === team || tname(x.team2) === team) && (!from || String(x.date_et).slice(0, 10) >= from) && (!to || String(x.date_et).slice(0, 10) <= to));
    $('txFilters').hidden = !all.length;
    if (!all.length) {
      $('txCount').textContent = '';
      $('pane').innerHTML = league === 'lg3s' ? '<div class="tx-empty"><b>No verified LG3S transactions yet</b><p>Roster moves will appear here once LeagueGaming records them.</p></div>'
        : '<div class="tx-empty"><b>LGCHL Season 55 trades are coming</b><p>We only post trades with verified teams. This wire fills in as soon as the LeagueGaming trade list is confirmed.</p></div>';
      return;
    }
    $('txCount').textContent = rows.length + ' of ' + all.length + ' trades' + (d.status_note ? ' · ' + d.status_note : '');
    $('pane').innerHTML = rows.length ? rows.map(x => card(league, x)).join('') : '<p class="tx-empty">No trades match these filters.</p>';
  }
  document.querySelectorAll('.tx-tabs button').forEach(b => b.addEventListener('click', () => { league = b.dataset.league; $('fTeam').value = ''; history.replaceState(null, '', league === 'lg3s' ? '?league=lg3s' : location.pathname); render(); }));
  ['fTeam', 'fFrom', 'fTo'].forEach(id => $(id).addEventListener('change', render));
  render();
})();
