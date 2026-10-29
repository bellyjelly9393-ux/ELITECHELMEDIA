/* Hitmen Radio — "Name That Line" fan poll, beside the main episode video on the homepage.
   Self-contained: remove this file, hitmen-radio-poll.css and the <aside id="hrPoll"> block in index.html to revert.
   Votes go through two Supabase RPCs (docs/sql/hitmen_radio_poll_DRAFT.sql). Until that SQL is applied the
   RPC call fails and the poll shows the options with "Voting opens soon"; nothing is written anywhere. */
(function () {
  'use strict';
  var URL_ = 'https://lrgllzvwgvqagcpiyvfd.supabase.co', KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
  var box = document.getElementById('hrPoll'); if (!box) return;
  var POLL = box.dataset.poll, LS = 'hrPoll:' + POLL, VID = 'hrPoll:voter';
  var opts = [].slice.call(box.querySelectorAll('[data-opt]'));
  var status = box.querySelector('[data-hrp-status]');

  function voter() {
    var v = null; try { v = localStorage.getItem(VID); } catch (e) {}
    if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); try { localStorage.setItem(VID, v); } catch (e) {} }
    return v;
  }
  function mine() { try { return localStorage.getItem(LS); } catch (e) { return null; } }
  function rpc(fn, body) {
    return fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('rpc ' + r.status); return r.json(); });
  }
  function say(t) { status.textContent = t; }
  function closed() { box.classList.add('hrp-soon'); opts.forEach(function (b) { b.disabled = true; }); say('Voting opens soon'); }
  function show(rows, picked) {
    var tot = 0, m = {}; (rows || []).forEach(function (r) { m[r.option_id] = +r.votes || 0; tot += +r.votes || 0; });
    box.classList.add('hrp-done'); box.classList.remove('hrp-soon');
    opts.forEach(function (b) {
      var n = m[b.dataset.opt] || 0, pct = tot ? Math.round(n * 100 / tot) : 0;
      b.disabled = true; b.setAttribute('aria-pressed', b.dataset.opt === picked ? 'true' : 'false');
      b.style.setProperty('--hrp-w', pct + '%'); b.querySelector('.hrp-pct').textContent = pct + '%';
    });
    say(tot + (tot === 1 ? ' vote' : ' votes') + (picked ? ' · Your pick is in' : ''));
  }

  opts.forEach(function (b) {
    b.addEventListener('click', function () {
      if (mine() || box.classList.contains('hrp-soon')) return;
      opts.forEach(function (x) { x.disabled = true; }); say('Sending your vote…');
      rpc('hitmen_radio_poll_vote', { p_poll: POLL, p_option: b.dataset.opt, p_voter: voter() }).then(function (rows) {
        var st = rows && rows[0] && rows[0].status;
        if (st === 'limit') { show(rows, null); say('Vote limit reached on this network'); return; }
        try { localStorage.setItem(LS, b.dataset.opt); } catch (e) {}
        show(rows, b.dataset.opt);
      }).catch(closed);
    });
  });

  // Initial state: results if already voted here, otherwise open voting if the backend exists.
  rpc('hitmen_radio_poll_results', { p_poll: POLL }).then(function (rows) {
    if (!rows || !rows.length) return closed();
    box.classList.remove('hrp-soon');
    if (mine()) show(rows, mine()); else { opts.forEach(function (b) { b.disabled = false; }); say('Tap a name to vote · one vote per fan'); }
  }).catch(closed);

  // Placement: sit beside the main video. The nightly player swaps .hn-in for a featured "solo"/"dual" layout
  // once episodes.json loads, so follow it there.
  var sec = document.getElementById('hitmanNightly');
  function place() {
    if (!sec) return;
    var grid = sec.querySelector('.hn-dual-grid');
    if (grid && !grid.contains(box)) { grid.appendChild(box); grid.classList.add('hrp-host'); grid.parentNode.classList.add('hrp-has'); }
  }
  place();
  if (sec && window.MutationObserver) { var mo = new MutationObserver(place); mo.observe(sec, { childList: true }); setTimeout(function () { mo.disconnect(); }, 15000); }
})();
