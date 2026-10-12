/* GM Connected page: header menu only (same behaviour as the homepage).
   Registration is handled by wildman-interest.js (program = franchise, table wildman_program_interest). */
(() => {
  'use strict';
  const nav = document.getElementById('nav'), mb = document.getElementById('menuBtn');
  if (!nav || !mb) return;
  const closeMenu = () => { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', 'Open menu'); };
  mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); mb.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); mb.focus(); } });
})();
