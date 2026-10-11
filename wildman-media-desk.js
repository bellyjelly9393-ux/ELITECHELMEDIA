/* Wildman Media desk (wildman-media.html): network channels and the network wire.
   Public reads only: tournament_automation_sources (active, public_visible) and published
   media_posts that are not Calgary Hitmen team posts. Hitmen coverage lives on hitmen-media.html. */
(() => {
  'use strict';
  const D = window.WMDesk; if (!D) return;
  const { $, esc, F, read, tint } = D;
  D.menu();

  async function channels() {
    const rail = $('rail');
    try {
      const sources = await read('tournament_automation_sources', { select: 'url,display_label,provider,metadata,slot_order', active: 'eq.true', public_visible: 'eq.true', order: 'slot_order.asc', limit: '12' });
      const valid = sources.filter(s => { try { const u = new URL(s.url); return u.protocol === 'https:' && ['twitch.tv', 'www.twitch.tv', 'youtube.com', 'www.youtube.com', 'youtu.be'].includes(u.hostname); } catch { return false; } });
      if (!valid.length) { $('lvStatus').textContent = 'No public channels assigned yet · Multiview is open'; return; }
      const prov = s => new URL(s.url).hostname.includes('twitch') ? ['Twitch', '145,70,255'] : ['YouTube', '230,30,30'];
      const icon = s => /hitmen|calgary|cgy/i.test((s.display_label || '') + ' ' + (s.metadata?.channel_key || '')) ? 'assets/lgchl/s55/team412.png' : 'assets/wildman/home/wildman-crest.webp';
      rail.insertAdjacentHTML('afterbegin', valid.map(s => {
        const [p, c] = prov(s), ic = icon(s);
        return '<a class="tile card tinted" href="game-center.html?channel=' + encodeURIComponent(s.metadata?.channel_key || 'hitmen') + '" style="--tc:' + c + '"><span class="wm" aria-hidden="true" style="--logo:url(\'' + ic + '\')"></span><span class="tile-ic"><img src="' + ic + '" width="48" height="48" alt=""></span><span class="tile-txt"><b>' + esc(s.display_label || 'Network broadcast') + '</b><small>' + p + ' · channel ready</small></span><span class="go" aria-hidden="true">→</span></a>';
      }).join(''));
      $('lvStatus').textContent = valid.length + ' configured channel' + (valid.length === 1 ? '' : 's') + ' · live status unverified';
    } catch { $('lvStatus').textContent = 'Channel feed unavailable · Multiview remains available'; }
  }

  const TYPE = { preview: 'Preview', announcement: 'News', recap: 'Recap', feature: 'Feature' };
  async function wire() {
    try {
      const posts = await read('media_posts', { select: 'id,title,body,post_type,published_at', published: 'eq.true', 'source_metrics->>team': 'is.null', order: 'published_at.desc', limit: '8' });
      if (!posts.length) { $('wireSub').textContent = 'New network stories appear here as the desk publishes them.'; return; }
      $('wireSub').textContent = posts.length + ' latest network posts';
      $('wireGrid').innerHTML = posts.map(p => {
        const body = String(p.body || '').trim();
        return '<article class="rt card tinted wire-row" style="--tc:200,210,225"><span class="wm" aria-hidden="true" style="--logo:url(\'assets/wildman/home/elitechel-media.webp\')"></span><img class="logo" src="assets/wildman/home/elitechel-media.webp" width="52" height="52" loading="lazy" alt="">' +
          '<div><h3>' + esc(p.title) + '</h3><small>' + esc(body.length > 160 ? body.slice(0, 158) + '…' : body) + '</small></div>' +
          '<div class="score"><b>' + esc(F.md.format(new Date(p.published_at))) + '</b><small>' + esc(TYPE[p.post_type] || 'Story') + '</small></div></article>';
      }).join('');
      tint($('wireGrid'));
    } catch { $('wireSub').textContent = 'Network stories could not load right now. Refresh to try again.'; }
  }

  channels(); wire();
})();
