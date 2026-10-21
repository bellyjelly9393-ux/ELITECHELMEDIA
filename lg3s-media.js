/* LG3s Media: isolated presentation-only behavior. No API writes, VOD endpoints, or credentials. */
(() => {
  'use strict';
  const menuBtn = document.getElementById('menuBtn');
  const nav = document.getElementById('nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
  const buttons = Array.from(document.querySelectorAll('.th-switch button[data-date]'));
  const games = Array.from(document.querySelectorAll('.th-game[data-game-date]'));
  if (buttons.length && games.length) {
    function choose(date) {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.date === date)));
      games.forEach(game => { game.hidden = date !== 'all' && game.dataset.gameDate !== date; });
    }
    buttons.forEach(button => button.addEventListener('click', () => choose(button.dataset.date)));
    choose('2026-10-21');
  }
})();