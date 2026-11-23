/* LG3S browser-captured game sheets. Uses the user's signed-in LG tab and the
   existing restricted Supabase verifier; never sends LG cookies or tokens. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const LG_ORIGIN = /^https:\/\/(?:[a-z0-9-]+\.)?leaguegaming\.com$/i;
  const LIMIT = 12;
  const SYNC_FUNCTION = 'lg3s-auth-browser-sync';
  let lgWindow = null, lgOrigin = null, busy = false;
  let accepted = 0, provisional = 0, rejected = 0, failures = 0;
  let queue = Promise.resolve();

  const setStatus = value => { const el = $('lg3sAuthStatus'); if (el) el.textContent = value; };
  const setMessage = (value, isError = false) => {
    const el = $('lg3sAuthMessage');
    if (!el) return;
    el.textContent = value;
    el.style.color = isError ? '#ff9a9a' : '#9ff4bc';
  };

  // This is serialized into a bookmarklet and executes ONLY in a LeagueGaming tab.
  function collector(target) {
    try {
      if (location.protocol !== 'https:' || !/(^|\.)leaguegaming\.com$/i.test(location.hostname)) {
        alert('Open LeagueGaming and sign in before starting LG3S Browser Sync.');
        return;
      }
      const TARGET = String(target || '').replace(/\/+$/, '');
      const bridge = window.open(TARGET + '/lg-capture.html?mode=lg3s',
        'ecmLg3sBrowserBridge', 'width=820,height=850');
      if (!bridge) {
        alert('Allow pop-ups for LeagueGaming, then click LG3S Browser Sync again.');
        return;
      }
      const allowedUrl = raw => {
        try {
          const u = new URL(raw, location.href);
          if (u.protocol !== 'https:' || !/(^|\.)leaguegaming\.com$/i.test(u.hostname)) return '';
          u.username = ''; u.password = ''; u.hash = '';
          const keep = new Set(['leaguegaming/league','action','page','leagueid','seasonid','teamid','gameid','userid','user_id','week','games']);
          for (const k of [...u.searchParams.keys()]) if (!keep.has(k)) u.searchParams.delete(k);
          return u.toString();
        } catch { return ''; }
      };
      const sanitize = doc => {
        const original = doc.querySelector('main,.p-body-main,#content,.mainContent,.pageContent') || doc.body;
        if (!original) throw Error('LG page content is missing.');
        const root = original.cloneNode(true);
        root.querySelectorAll('script,style,iframe,textarea,input,button,select,option,meta,link,form,canvas,video,audio,noscript').forEach(n => n.remove());
        const allowed = new Set(['href','src','title','alt','class','id','colspan','rowspan','style']);
        for (const el of root.querySelectorAll('*')) {
          for (const attr of [...el.attributes]) {
            const name = attr.name.toLowerCase();
            if (!allowed.has(name)) { el.removeAttribute(attr.name); continue; }
            if (name === 'href' || name === 'src') {
              const url = allowedUrl(attr.value);
              if (url) el.setAttribute(attr.name, url);
              else el.removeAttribute(attr.name);
            }
            if (name === 'style') {
              // The existing LG3S parser reads the FINAL label from its 40px header.
              // Keep only this harmless style marker; discard all other inline CSS.
              if (/font-size\s*:\s*40px/i.test(attr.value)) el.setAttribute('style', 'font-size:40px;');
              else el.removeAttribute('style');
            }
          }
        }
        return root.outerHTML;
      };
      const send = payload => { try { bridge.postMessage(payload, TARGET); } catch {} };
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      let fetching = false;

      window.addEventListener('message', async event => {
        if (event.origin !== TARGET || event.source !== bridge) return;
        if (event.data?.type !== 'ECM_LG3S_FETCH' || fetching) return;
        const incoming = Array.isArray(event.data.gameIds) ? event.data.gameIds : [];
        const ids = [...new Set(incoming.map(Number).filter(n =>
          Number.isSafeInteger(n) && n >= 921000 && n < 930000))].slice(0, 12);
        if (!ids.length) return;
        fetching = true;
        try {
          for (const gameId of ids) {
            const sourceUrl = location.origin + '/forums/index.php?leaguegaming/league&action=league&page=game&gameid=' + gameId;
            try {
              const response = await fetch(sourceUrl, {
                credentials: 'include', cache: 'no-store', headers: { accept: 'text/html' }
              });
              if (!response.ok) throw Error('LeagueGaming returned HTTP ' + response.status);
              const text = await response.text();
              if (text.length > 3_000_000 || /<title>\s*(?:Just a moment|Attention Required)|cf-mitigated|_cf_chl_opt/i.test(text))
                throw Error('LeagueGaming access challenge or oversized response.');
              const doc = new DOMParser().parseFromString(text, 'text/html');
              const html = sanitize(doc);
              if (html.length > 1_400_000 || html.length < 2000)
                throw Error('Source game HTML was incomplete or too large.');
              send({ type: 'ECM_LG3S_GAME', gameId, sourceUrl, html });
            } catch (e) {
              send({ type: 'ECM_LG3S_ERROR', gameId, error: String(e?.message || e).slice(0, 240) });
            }
            // User-initiated, modest cadence. Do not hammer LG or bypass challenges.
            await sleep(2100);
          }
        } finally {
          fetching = false;
          send({ type: 'ECM_LG3S_DONE', attempted: ids.length });
        }
      });
      // The window may need a moment to load, so announce without navigating LG.
      let attempts = 0;
      const connect = () => {
        send({ type: 'ECM_LG3S_CONNECTED' });
        if (++attempts < 16) setTimeout(connect, 500);
      };
      connect();
    } catch (e) {
      alert('LG3S Browser Sync could not start: ' + String(e?.message || e));
    }
  }

  const bookmarklet = 'javascript:(' + collector.toString() + ')(' + JSON.stringify(location.origin) + ')';

  async function client() {
    const db = window.VVHLBackend?.db;
    if (!db) throw Error('Elitechel sign-in service is unavailable.');
    const { data, error } = await db.auth.getSession();
    if (error || !data.session?.access_token) throw Error('Sign in to Elitechel management before syncing.');
    return db;
  }
  async function call(body) {
    const db = await client();
    const {data, error} = await db.functions.invoke(SYNC_FUNCTION, {body});
    if (error) {
      let message = error.message || 'LG3S import failed.';
      try {
        const details = await error.context?.json?.();
        if (details?.error) message = details.error;
      } catch {}
      throw Error(message);
    }
    if (!data?.ok) throw Error(data?.error || 'LG3S game was rejected.');
    return data;
  }
  function updateCounts() {
    setStatus('VERIFIED ' + accepted + '  ·  AWAITING SECOND PASS ' + provisional +
      '  ·  NEEDS REVIEW ' + rejected + '  ·  ERRORS ' + failures);
  }
  async function ingestCapturedGame(data) {
    try {
      const result = await call({ sourceUrl: data.sourceUrl, html: data.html });
      if (result.action === 'verified' || result.action === 'corrected' ||
          result.action === 'unchanged' || result.action === 'reparsed') accepted++;
      else if (result.needsSecondPass) provisional++;
      else rejected++;
      setMessage('Game ' + data.gameId + ': ' + (result.action || result.status) +
        (result.needsSecondPass ? '. Capture again after 10 minutes to verify.' : '.'));
    } catch (e) {
      rejected++;
      setMessage('Game ' + data.gameId + ': ' + String(e?.message || e), true);
    }
    updateCounts();
  }
  async function requestMissing() {
    if (busy) return;
    if (!lgWindow || !lgOrigin) {
      setMessage('Open LeagueGaming, sign in there, and click the LG3S Browser Sync bookmark first.', true);
      return;
    }
    busy = true;
    $('lg3sFetchMissing').disabled = true;
    try {
      const {pending} = await call({action:'pending'});
      const ids = (Array.isArray(pending) ? pending : []).map(x => Number(x.gameId))
        .filter(x => Number.isSafeInteger(x)).slice(0, LIMIT);
      if (!ids.length) {
        setMessage('No overdue unverified LG3S games were found in the last 14 days.');
        return;
      }
      setStatus('Fetching ' + ids.length + ' LG3S game sheets from your signed-in LeagueGaming tab…');
      setMessage('First captures are provisional. Repeat after 10 minutes for the stability check.');
      lgWindow.postMessage({type:'ECM_LG3S_FETCH',gameIds:ids},lgOrigin);
    } catch (e) {
      setMessage(String(e?.message || e), true);
    } finally {
      busy = false;
      $('lg3sFetchMissing').disabled = false;
    }
  }
  function receive(event) {
    if (!LG_ORIGIN.test(event.origin)) return;
    if (event.data?.type === 'ECM_LG3S_CONNECTED') {
      lgWindow = event.source;
      lgOrigin = event.origin;
      setStatus('SIGNED-IN LG BROWSER LINKED · Ready to request missing LG3S game sheets');
      setMessage('Click Fetch Missing LG3S Games. The browser stays on LeagueGaming.');
      return;
    }
    if (!lgWindow || event.source !== lgWindow) return;
    if (event.data?.type === 'ECM_LG3S_GAME') {
      // Process one at a time. Never forward source HTML to unrelated site features.
      queue = queue.then(() => ingestCapturedGame(event.data));
    } else if (event.data?.type === 'ECM_LG3S_ERROR') {
      failures++;
      updateCounts();
      setMessage('Game ' + event.data.gameId + ': ' + event.data.error, true);
    } else if (event.data?.type === 'ECM_LG3S_DONE') {
      queue = queue.then(() => setMessage(
        'Browser collection finished. Verified results are now included automatically; ' +
        'provisional games require a second capture after 10 minutes.'));
    }
  }
  function install() {
    const link = $('lg3sBrowserBookmarklet');
    if (link) link.href = bookmarklet;
    $('lg3sCopyBookmarklet')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bookmarklet);
        setMessage('Bookmark copied. Save it as LG3S Browser Sync.');
      } catch {
        setMessage('Drag the LG3S Browser Sync link to your bookmarks bar instead.', true);
      }
    });
    $('lg3sFetchMissing')?.addEventListener('click', requestMissing);
    updateCounts();
  }
  window.addEventListener('message',receive);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install);
  else install();
})();
