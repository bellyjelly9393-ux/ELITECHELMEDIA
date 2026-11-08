# Calgary public Find My Stall

Implemented November 7, 2026 on local branch `feat/hitmen-find-my-stall`, based on `77f36d7`. No push, merge, or deployment was performed.

## Scope and identities

The public page is `lgchl-team.html?team=412`. The similarly named `hitmen-team-locker.html` and `hitmen-locker-room.html` are protected team/management pages and were not changed. The live public page was inspected in headless Edge: HTTP 200, title Calgary Hitmen Team Room, 17 stalls.

Uses the existing public `assets/lgchl/rosters/main-rosters-s55.json` snapshot, dated November 5, 2026, season 55, team 412. Only `active_roster` entries with valid unique LG IDs qualify. Calgary must have exactly 17 qualifying entries; malformed/duplicate/expanded rosters fail closed rather than introducing extra stalls. An empty roster has its own disabled empty state. No roster memberships or identity mappings were edited. The saved snapshot's source is the LeagueGaming public Season 55 roster URL; a direct web-tool attempt returned the forum index, so this work does not claim a fresh independent LeagueGaming roster scrape.

The snapshot contains these 17 names: l Setty l; gtcoop73; offtheyrk; SmokoLi; Stevens-I4I-; thenny32; Gullyrr; l danks l; WhiteoutI8I; imona_plain; WhyKayWins; xSalda-; FerdaLettuce; Koldex Bands; matt_0_5; Kudolken; XxPASTRNAK88.

Search tolerates case, spaces, punctuation and Unicode compatibility forms. It does not guess similar-looking I/l identities or invent real names. Optional `ea_alias` / `ea_aliases` strings are supported only if supplied by the same public roster object. The current snapshot contains no EA alias mapping; therefore no additional EA identities were added or queried.

## Behavior and integration

Calgary search lists matching players without removing or rebuilding the 17 room stalls. Selection focuses and scrolls to the existing stall keyed by LG user ID, adds a red outline/glow and marks it current. Enter/click on that stall opens its existing public player card with the original skater/goalie kind. Previous/next buttons follow the existing roster display order and stop at either end. Other clubs retain their existing filter behavior, team chooser, cards, stats and games.

The default room remains the existing responsive grid. An opt-in dark modern arena concept is available at `lgchl-team.html?team=412&room=concept`, using the same public stalls in a horizontal room scene, with red lighting, a ceiling sign, branded floor, left/right controls and touch scrolling. It uses CSS layers and no 3D engine. Smooth scrolling is disabled when reduced motion is requested. Controls have visible labels, 44px minimum targets, focus outlines and a live status. Search supports Enter, Arrow Down, Escape; results support Up/Down, Tab, Enter and Escape.

Future left/right scenes can call `window.HitmenPublicRoom.focusStall(lgUserId)` (returns false for IDs absent from the roster). The room emits a bubbling `hitmen-stall-selected` event with `{lg_user_id, index, stallId}`. Stall number/index means current public display order, not an invented real-world locker assignment. Existing public cards are reused; no private reports, accounts, availability, scouting or locker tables are read.

## Validation actually run

- JavaScript syntax checks for the room, finder and browser test: passed.
- `node test-public-team-rosters.cjs`: passed across 62 teams / 1,037 main-rostered players, Calgary 17, public links, kind joins, missing stats and stats outages.
- `node test-hitmen-find-stall.cjs` using installed Playwright and headless Microsoft Edge: passed at 1280px and 390px, including touch emulation. Covered all 17 ID/stall/card mappings, normalized name search, unchanged stall count, result keyboard controls, previous/next boundaries, excluded name BODFUSION, unknown ID rejection, clear, no horizontal overflow, public alias matching contract, loading, empty, 503 roster failure, duplicate roster rejection, stats-service 503, other-team filtering, reduced motion, smooth-scroll option and integration event. Checked public-card navigation and no browser page errors. Network stats were mocked for deterministic checks; live private flows were not exercised.
- `node test-lgchl-locker-chooser.cjs`: initial Windows checkout failed because its existing markup regex assumes LF while Git checked out CRLF. Re-running the unchanged test with read-time CRLF-to-LF normalization passed. No navigation source/test was modified for this environment issue.
- `git diff --check`: passed.
- Visually inspected desktop/mobile screenshots of the controls and highlighted stall. No screen-reader session, physical phone, authenticated War Room workflow, or deployed version of this change was tested.

The existing GitHub workflow now syntax-checks the new files when relevant files change. The browser suite is included as an explicit local check; CI does not install/run Playwright automatically. To rerun, install Playwright/Chromium and run `node test-hitmen-find-stall.cjs`; optional environment variables `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`, `SCREENSHOT_DIR` and `LIVE_SITE` select an existing installation, capture screenshots, or inspect the live public page read-only.

Review/apply the accompanying Git patch in the repository. The code remains local because pushing to a hosting-connected repository may trigger deployment; no remote publication was attempted.


## Room concept added after visual direction was chosen

The selected direction is **dark modern arena with red lighting**. `hitmen-room-concept.js` and `.css` provide the opt-in preview, while the existing grid and all other teams retain their default layout. The scene reuses the existing Hitmen locker bay, jersey and crest artwork; there are no new invented player names, numbers or private data. Default camera position is around player 9 so a desktop view shows a full bank of lockers. Phone view centres one locker with adjacent stalls visible at the edges.

Find My Stall now centres the selected stall horizontally inside the concept. Left/right controls, Home/End and Arrow Left/Right share its public identity hook. Touch/native horizontal scrolling updates the position indicator. `hitmen-stalls-ready` announces when the existing stalls finish rendering, including empty/error outcomes. Reduced motion is respected.

Additional browser checks passed at 1440px and 390px: all 17 stalls retained; scene arrow boundaries; Home/End; search-to-centred-stall geometry; horizontal-scroll location tracking; no page overflow or browser errors. The original roster-layout suite still passes. No physical mobile device was tested.

`Calgary-Hitmen-Room-Concept.html` is a self-contained offline review copy, with artwork and the saved 17-player roster embedded. It was opened from disk and tested for search, selection and zero network dependencies. Live statistics are explicitly disconnected in this review copy; public player-card and navigation links lead to the existing website. The repo's opt-in concept uses the existing live public data flow. No push, merge or deployment was performed.
