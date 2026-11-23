(() => {
  const button = document.getElementById('broadcastRehearsalOpen');
  const mount = document.getElementById('broadcastRehearsal');
  const status = document.getElementById('broadcastRehearsalStatus');
  let request;
  let account;

  function close() {
    request?.abort();
    request = undefined;
    account = undefined;
    mount.replaceChildren();
    button.textContent = 'Open Broadcast Rehearsal';
    button.disabled = false;
    button.setAttribute('aria-expanded', 'false');
    status.textContent = '';
  }

  button.setAttribute('aria-expanded', 'false');
  window.addEventListener('vvhl-auth-change', ({ detail }) => {
    if (!window.VVHLManagementGuard?.hasAccess(detail) || account !== detail?.user?.id) {
      close();
    }
  });

  button.addEventListener('click', async () => {
    if (mount.firstChild) return close();
    const backend = window.VVHLBackend;
    if (!window.VVHLManagementGuard?.hasAccess(backend?.state)) return;
    account = backend.state.user.id;
    const current = new AbortController();
    request = current;
    button.disabled = true;
    status.textContent = 'Checking management access…';
    try {
      const { data } = await backend.db.auth.getSession();
      const session = data.session;
      if (!session?.access_token || session.user.id !== account || current.signal.aborted) return;
      const response = await fetch('/api/broadcast-rehearsal', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + session.access_token },
        signal: current.signal,
      });
      if (current.signal.aborted) return;
      if (!response.ok) {
        status.textContent = [401, 403].includes(response.status)
          ? 'Sign in with an authorized management account to open rehearsal.'
          : 'Broadcast Rehearsal is temporarily unavailable. Try again.';
        return;
      }
      const html = await response.text();
      if (current.signal.aborted) return;
      const frame = document.createElement('iframe');
      frame.title = 'Broadcast Rehearsal';
      frame.allow = 'microphone; camera; clipboard-write';
      frame.referrerPolicy = 'no-referrer';
      frame.style.cssText = 'display:block;width:100%;height:82vh;min-height:570px;border:0;border-radius:12px';
      frame.srcdoc = html;
      mount.replaceChildren(frame);
      button.textContent = 'Close Broadcast Rehearsal';
      button.setAttribute('aria-expanded', 'true');
      status.textContent = 'Rehearsal open. Draft settings save to this browser.';
    } catch {
      if (!current.signal.aborted) status.textContent = 'Could not open rehearsal. Try again.';
    } finally {
      if (request === current) {
        request = undefined;
        button.disabled = false;
      }
    }
  });
})();
