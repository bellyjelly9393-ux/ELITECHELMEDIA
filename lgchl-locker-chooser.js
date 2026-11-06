/* Searchable public LGCHL locker pull-down.
   Clubs come from the Season 55 main-roster snapshot, so the list works
   when standings are unavailable. League groups are the Season 55
   assignments already recorded with that roster; a club missing from the
   map still appears under LGCHL. Private rooms are never listed. */
(() => {
  'use strict';
  const ORDER = ['WHL', 'OHL', 'QMJHL', 'LGCHL'];
  const LEAGUE = {306:'OHL',364:'QMJHL',365:'QMJHL',370:'OHL',375:'OHL',377:'WHL',379:'WHL',380:'WHL',381:'OHL',382:'QMJHL',383:'OHL',385:'WHL',386:'WHL',397:'QMJHL',398:'WHL',399:'WHL',400:'WHL',401:'OHL',402:'OHL',408:'OHL',409:'WHL',411:'WHL',412:'WHL',413:'WHL',414:'WHL',415:'WHL',416:'WHL',418:'WHL',419:'WHL',420:'WHL',421:'WHL',422:'WHL',423:'WHL',444:'OHL',445:'OHL',446:'OHL',447:'OHL',448:'OHL',449:'OHL',450:'OHL',451:'OHL',452:'OHL',453:'OHL',454:'OHL',455:'QMJHL',457:'QMJHL',458:'QMJHL',459:'QMJHL',460:'QMJHL',461:'QMJHL',462:'QMJHL',463:'QMJHL',465:'QMJHL',466:'QMJHL',467:'QMJHL',468:'QMJHL',469:'QMJHL',514:'OHL',2604:'WHL',2981:'WHL',2982:'QMJHL',2983:'WHL'};
  const SNAPSHOT = 'assets/lgchl/rosters/main-rosters-s55.json?v=20261105';

  function validId(id) {
    return Number.isSafeInteger(Number(id)) && Number(id) > 0;
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function isPublicClub(club) {
    const name = String(club && club.name || '');
    return name.length > 0 && !/war\s*room|training\s*camp|private/i.test(name);
  }
  function clubsFromSnapshot(snapshot) {
    if (!snapshot || snapshot.season !== 55 || !snapshot.teams) return [];
    return Object.entries(snapshot.teams).filter(([id, club]) => validId(id) && isPublicClub(club)).map(([id, club]) => ({
      id: Number(id),
      name: club.name === 'Calgary Hitman' ? 'Calgary Hitmen' : club.name,
      league: LEAGUE[Number(id)] || 'LGCHL'
    })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }
  function filterClubs(clubs, query) {
    const q = String(query || '').trim().toLocaleLowerCase();
    if (!q) return clubs.slice();
    return clubs.filter(club => club.name.toLocaleLowerCase().includes(q) || club.league.toLocaleLowerCase().includes(q));
  }
  function roomHref(id) {
    return 'lgchl-team.html?team=' + Number(id);
  }
  function ordered(clubs) {
    const rows = [];
    ORDER.forEach(league => {
      clubs.filter(club => club.league === league).forEach(club => rows.push(club));
    });
    return rows;
  }
  function renderList(clubs, currentId, activeIndex, idPrefix) {
    const rows = ordered(clubs);
    const current = Number(currentId);
    const active = rows.length ? Math.max(0, Math.min(activeIndex, rows.length - 1)) : -1;
    let html = '';
    let last = '';
    rows.forEach((club, index) => {
      if (club.league !== last) {
        last = club.league;
        html += '<div class="lg-locker-league" role="presentation">' + esc(club.league) + '</div>';
      }
      const here = club.id === current;
      html += '<a role="option" class="lg-locker-option' + (index === active ? ' is-active' : '') + '" id="' + esc(idPrefix) + '-opt-' + club.id + '" href="' + roomHref(club.id) + '" aria-selected="' + (index === active ? 'true' : 'false') + '"' + (here ? ' aria-current="page"' : '') + '><span>' + esc(club.name) + '</span>' + (here ? '<span class="lg-locker-here">Current</span>' : '') + '</a>';
    });
    return html;
  }
  function activeOptionId(clubs, activeIndex, idPrefix) {
    const rows = ordered(clubs);
    if (!rows.length) return '';
    const index = Math.max(0, Math.min(activeIndex, rows.length - 1));
    return idPrefix + '-opt-' + rows[index].id;
  }

  const api = {ORDER, LEAGUE, clubsFromSnapshot, filterClubs, roomHref, renderList, activeOptionId};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  function loadClubs() {
    if (!loadClubs.promise) {
      loadClubs.promise = fetch(SNAPSHOT, {headers:{accept:'application/json'}}).then(response => {
        if (!response.ok) throw Error('roster');
        return response.json();
      }).then(clubsFromSnapshot).catch(error => {
        loadClubs.promise = null;
        throw error;
      });
    }
    return loadClubs.promise;
  }

  let serial = 0;
  function mount(root, clubs) {
    if (root.dataset.lockerReady === '1') return;
    const variant = root.dataset.lockerVariant || 'nav';
    const caption = root.dataset.lockerLabel || 'Locker rooms';
    const prefix = 'lgLocker' + (++serial);
    const params = new URLSearchParams(location.search);
    const requested = Number(params.get('team'));
    const currentId = variant === 'room' ? (validId(requested) ? requested : 412) : (validId(requested) ? requested : 0);
    const current = clubs.find(club => club.id === currentId);
    const value = variant === 'room' ? (current ? current.name : 'Choose a team') : caption;
    root.classList.add('lg-locker-chooser');
    root.dataset.variant = variant;
    root.hidden = false;
    root.innerHTML = '<button type="button" class="lg-locker-trigger" id="' + prefix + '-button" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + prefix + '-list" aria-label="' + esc(variant === 'room' ? caption + ', ' + value : caption) + '"><span class="lg-locker-value">' + esc(value) + '</span><span class="lg-locker-chevron" aria-hidden="true"></span></button><div class="lg-locker-panel" id="' + prefix + '-panel" hidden><p class="lg-locker-meta">Season 55 · Public locker rooms</p><label class="lg-locker-search"><span class="lg-locker-sr">Find a team locker room</span><input id="' + prefix + '-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + prefix + '-list" aria-activedescendant="" placeholder="Hitmen, Oshawa, Steelheads…" autocomplete="off" spellcheck="false" enterkeyhint="go"></label><p class="lg-locker-status lg-locker-sr" role="status"></p><div class="lg-locker-list" id="' + prefix + '-list" role="listbox" aria-label="Public LGCHL locker rooms"></div><p class="lg-locker-empty" hidden>No public locker room matches.</p></div>';
    const button = root.querySelector('.lg-locker-trigger');
    const panel = root.querySelector('.lg-locker-panel');
    const input = root.querySelector('input');
    const list = root.querySelector('.lg-locker-list');
    const empty = root.querySelector('.lg-locker-empty');
    const status = root.querySelector('.lg-locker-status');
    let open = false;
    let active = 0;
    let shown = clubs;

    function inline() {
      return !!(root.closest('.ecm-public-nav') && window.matchMedia('(max-width:1080px)').matches);
    }
    function place() {
      const flow = inline();
      root.classList.toggle('is-inline', flow);
      if (flow) {
        panel.style.cssText = '';
        return;
      }
      const rect = button.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < 220 && above > below;
      const maxH = Math.max(160, Math.min(480, upward ? above : below));
      const top = upward ? Math.max(8, rect.top - maxH - 6) : rect.bottom + 6;
      panel.style.position = 'fixed';
      panel.style.top = top + 'px';
      panel.style.left = left + 'px';
      panel.style.width = width + 'px';
      panel.style.maxHeight = maxH + 'px';
      panel.style.zIndex = '500';
    }
    function draw() {
      shown = filterClubs(clubs, input.value);
      if (active >= shown.length) active = 0;
      list.innerHTML = renderList(shown, currentId, shown.length ? active : -1, prefix);
      list.hidden = !shown.length;
      empty.hidden = !!shown.length;
      input.setAttribute('aria-activedescendant', shown.length ? activeOptionId(shown, active, prefix) : '');
      status.textContent = shown.length ? shown.length + (shown.length === 1 ? ' locker room' : ' locker rooms') : 'No public locker room matches.';
      const node = shown.length ? document.getElementById(activeOptionId(shown, active, prefix)) : null;
      if (node) {
        const listRect = list.getBoundingClientRect();
        const rect = node.getBoundingClientRect();
        if (rect.top < listRect.top) list.scrollTop -= listRect.top - rect.top;
        else if (rect.bottom > listRect.bottom) list.scrollTop += rect.bottom - listRect.bottom;
      }
    }
    function openPanel() {
      open = true;
      root.classList.add('is-open');
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-expanded', 'true');
      input.value = '';
      const start = ordered(clubs).findIndex(club => club.id === currentId);
      active = start > -1 ? start : 0;
      place();
      draw();
      input.focus();
    }
    function closePanel(focusButton) {
      open = false;
      root.classList.remove('is-open', 'is-inline');
      panel.hidden = true;
      panel.style.cssText = '';
      button.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-expanded', 'false');
      if (focusButton) button.focus();
    }
    button.addEventListener('click', () => open ? closePanel(false) : openPanel());
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) openPanel();
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      }
    });
    input.addEventListener('input', () => { active = 0; draw(); });
    input.addEventListener('keydown', event => {
      const last = shown.length - 1;
      if (event.key === 'ArrowDown' && shown.length) {
        event.preventDefault();
        active = Math.min(last, active + 1);
        draw();
      } else if (event.key === 'ArrowUp' && shown.length) {
        event.preventDefault();
        active = Math.max(0, active - 1);
        draw();
      } else if (event.key === 'Home' && shown.length) {
        event.preventDefault();
        active = 0;
        draw();
      } else if (event.key === 'End' && shown.length) {
        event.preventDefault();
        active = last;
        draw();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = shown.length ? document.getElementById(activeOptionId(shown, active, prefix)) : null;
        if (target) location.href = target.getAttribute('href');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      } else if (event.key === 'Tab') closePanel(false);
    });
    document.addEventListener('click', event => {
      if (open && !root.contains(event.target)) closePanel(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && open && !panel.contains(event.target) && event.target !== button) closePanel(false);
    });
    window.addEventListener('resize', () => { if (open) place(); });
    window.addEventListener('scroll', () => { if (open && !root.classList.contains('is-inline')) place(); }, true);
    if (variant === 'room') {
      const native = document.getElementById('roomTeam');
      if (native) {
        native.classList.add('lg-locker-native-hidden');
        native.tabIndex = -1;
        native.setAttribute('aria-hidden', 'true');
        const captionNode = document.getElementById('roomTeamLabel');
        if (captionNode) captionNode.htmlFor = '';
      }
    }
    root.dataset.lockerReady = '1';
  }

  function boot() {
    const nodes = [...document.querySelectorAll('[data-locker-chooser]')].filter(node => node.dataset.lockerReady !== '1' && node.dataset.lockerReady !== 'pending');
    if (!nodes.length) return;
    nodes.forEach(node => { node.dataset.lockerReady = 'pending'; });
    loadClubs().then(clubs => {
      if (!clubs.length) throw Error('empty');
      nodes.forEach(node => mount(node, clubs));
    }).catch(() => {
      nodes.forEach(node => { delete node.dataset.lockerReady; });
    });
  }
  api.boot = boot;
  window.LGLockerChooser = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
