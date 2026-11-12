/* Seasonal decoration only. Set data-room-theme="regular" to retire this edition. */
(() => {
 'use strict';
 const body = document.body;
 const raw = new URLSearchParams(location.search).get('team');
 const team = raw === null ? 412 : Number(raw);
 if (!Number.isSafeInteger(team) || team <= 0) return;
 const league = window.LGLockerChooser?.LEAGUE[team];
 if (league) body.dataset.roomLeague = league;
 const label = document.querySelector('.room-season-label');
 if (label) label.hidden = body.dataset.roomTheme !== 's55-playoffs';
})();
