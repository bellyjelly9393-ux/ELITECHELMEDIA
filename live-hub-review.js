// Staff review of games people add to the Live Hub's All Games channel.
// The database only lets Elitechel Media staff (admins, commissioners and Elitechel Media
// owner/GM/AGM) see or change submissions; this page only shows what it allows.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const LEAGUES = { lgchl: 'LGCHL', lg3s: 'LG Threes', wjhc: 'World Juniors', other: 'Other league' };
  const db = () => window.VVHLBackend?.db;
  let loading = false;

  const when = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const ago = (iso) => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return Math.max(mins, 1) + ' min ago';
    const hours = Math.round(mins / 60);
    return hours < 48 ? hours + ' h ago' : Math.round(hours / 24) + ' days ago';
  };
  const left = (iso) => {
    const hours = Math.round((new Date(iso) - Date.now()) / 3600000);
    return hours < 48 ? 'comes off in ' + Math.max(hours, 1) + ' h' : 'comes off in ' + Math.round(hours / 24) + ' days';
  };

  function notice(text) {
    const el = $('lhrNotice');
    el.hidden = !text;
    el.textContent = text || '';
  }

  function row(game, actions) {
    const card = document.createElement('article');
    card.className = 'lhr-row';
    const info = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = game.home_name + ' vs ' + game.away_name;
    const meta = document.createElement('span');
    meta.textContent = [LEAGUES[game.league] || LEAGUES.other, game.note, game.starts_at && 'Starts ' + when(game.starts_at)].filter(Boolean).join(' · ');
    const link = document.createElement('a');
    link.href = game.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = game.url.replace('https://www.', '') + ' ↗';
    const time = document.createElement('small');
    time.textContent = game.status === 'approved' && new Date(game.expires_at) > Date.now()
      ? 'Added ' + ago(game.created_at) + ' · ' + left(game.expires_at)
      : 'Added ' + ago(game.created_at);
    info.append(title, meta, link, time);
    const buttons = document.createElement('div');
    buttons.className = 'lhr-actions';
    actions.forEach(([label, status, primary]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = primary ? 'va-btn' : 'lhr-btn';
      button.textContent = label;
      button.addEventListener('click', () => setStatus(game, status, button));
      buttons.append(button);
    });
    card.append(info, buttons);
    return card;
  }

  function fill(id, games, empty, actions) {
    const root = $(id);
    root.replaceChildren();
    if (!games.length) {
      const p = document.createElement('p');
      p.className = 'va-empty';
      p.textContent = empty;
      root.append(p);
      return;
    }
    games.forEach((game) => root.append(row(game, actions)));
  }

  async function load() {
    const client = db();
    if (!client || loading) return;
    loading = true;
    try {
      const { data: session } = await client.auth.getSession();
      if (!session.session) return;
      const allowed = await client.rpc('ecm_live_hub_can_review');
      if (allowed.error) throw allowed.error;
      if (allowed.data !== true) {
        notice('Your account can sign in, but only Elitechel Media staff can review added games.');
        ['lhrWaiting', 'lhrLive', 'lhrRejected'].forEach((id) => $(id).replaceChildren());
        return;
      }
      const { data, error } = await client
        .from('live_hub_game_links')
        .select('id,url,league,home_name,away_name,note,starts_at,status,created_at,expires_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      notice('');
      const now = Date.now();
      const waiting = data.filter((g) => g.status === 'pending' && new Date(g.expires_at) > now);
      const live = data.filter((g) => g.status === 'approved' && new Date(g.expires_at) > now);
      const done = data.filter((g) => !waiting.includes(g) && !live.includes(g)).slice(0, 30);
      $('lhrWaitingCount').textContent = waiting.length;
      $('lhrLiveCount').textContent = live.length;
      $('lhrRejectedCount').textContent = data.filter((g) => g.status === 'rejected').length;
      fill('lhrWaiting', waiting, 'Nothing waiting. New games people add show up here.', [['Approve', 'approved', true], ['Turn down', 'rejected']]);
      fill('lhrLive', live, 'No added games are on the site right now.', [['Take down', 'rejected']]);
      fill('lhrRejected', done, 'Nothing here yet.', [['Approve for 7 days', 'approved']]);
    } catch (err) {
      notice('Added games could not be loaded. ' + (err?.message || 'Please try again.'));
    } finally {
      loading = false;
    }
  }

  async function setStatus(game, status, button) {
    button.disabled = true;
    const { error } = await db().from('live_hub_game_links').update({ status }).eq('id', game.id);
    if (error) {
      button.disabled = false;
      notice('That change did not save. ' + error.message);
      return;
    }
    load();
  }

  window.addEventListener('vvhl-auth-change', load);
  setInterval(() => { if (!document.hidden) load(); }, 30000);
  load();
})();
