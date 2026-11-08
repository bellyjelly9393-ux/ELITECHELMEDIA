# Public Hitmen fixed room concept — revision 6

The opt-in route is `lgchl-team.html?team=412&room=angles`. It adds three normal-perspective camera banks to the public Calgary room: Left wing (stalls 1–6), Centre (7–11), Right wing (12–17). The view starts at Centre. Tabs, previous/next angle buttons and left/right arrow keys move between banks. Each bay displays a separate copy of the exact existing black jersey asset, `assets/lgchl/jerseys/team412.webp`, rather than a sweater stretched through a panorama texture.

Search uses the existing public Find My Stall service. Selection chooses the containing bank, highlights its metal nameplate, focuses the jersey and brings it into the mobile scroll viewport. Clicking a jersey or using Enter opens the existing dedicated stall level. Back/Escape returns to its containing bank. Search from an open stall changes the selected player. The public player-card link still uses the verified LG user ID and skater/goalie kind.

All 17 names, positions and links come from the same validated Season 55 main-roster snapshot already rendered on the public team page. There are no training-camp, former or reserve players; no jersey numbers are inferred. Public EA alias matching remains supported only when the public roster object supplies an alias. There are no new identity-table, management, scouting, private locker or War Room reads. The regular team grid, earlier horizontal concept and earlier 360 tour remain separate opt-in routes; private pages were not changed.

## Artwork and layout

The three backgrounds (`fixed-left-v6.png`, `fixed-centre-v6.png`, `fixed-right-v6.png`) are newly generated 1536 × 1024 architectural concept images, guided by the user's supplied red-lit room reference. They contain six, five and six empty locker bays, respectively. They are independent fixed views, not a mathematically continuous 360 capture or a complete 3D room. Architectural details can vary between views. The arena and skyline are illustrative concept scenery.

The existing photographic black jersey remains a native transparent image layer with its original crest, colours and cloth detail. It is not regenerated. Real roster names are text positioned over the background's brushed-metal nameplates and rivets. The centre sign uses the existing Hitmen and Elite Chel Media logo files and says Public Locker Room. There is no private tactics board. The shared rink-style background behind Recent games/Upcoming and their existing team-logo rows is reused.

On narrow screens, the room image retains an 850px-wide internal canvas to keep sweaters readable. Users can swipe horizontally within that view; the page itself does not overflow. Search scrolls directly to the selected bay. The dedicated stall view fits the phone normally. Controls have accessible names, selected/pressed states, keyboard operation and touch targets. Missing background artwork retains the native jersey buttons and public-card access. Loading, unavailable, empty and invalid roster states reuse the existing finder state; no guessed players are substituted.

Repository artwork loads per selected bank. The standalone review file embeds all assets and saved public roster/game fixtures so it can work offline. Its source disclosure identifies the saved roster and games and disconnected live player statistics. Links to public player/game pages still require the public site. The fixed view has no WebGL/3D engine requirement.

## Verification

Local browser checks are in `test-hitmen-fixed-room.cjs`, using Playwright with Chromium/Edge. Set `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` only if selecting an existing installation; optional `SCREENSHOT_DIR` saves view captures and `PORTABLE_FIXED` checks the standalone HTML.

The checks cover desktop 1440px and mobile 390px, 6+5+6 allocation, all 17 ID/name/position/profile mappings, the exact jersey source, search and bank selection, visible mobile search targets, keyboard and close-up navigation, boundaries and unknown IDs, loading/empty/invalid/unavailable rosters, failed background artwork, another team's isolation, public game-logo mappings and the offline artifact without HTTPS dependencies. API game responses are saved public fixtures and live player-statistic reads are deliberately unavailable in this suite. This does not validate a live database or a deployed copy. Physical phones and screen-reader software were not tested.

The existing public roster and full Find My Stall browser regressions are run alongside this suite. Browser output and visual screenshots are recorded in the working session; this document describes the scope rather than claiming a production rollout. CI includes JavaScript syntax checks for the new module/test; it does not install or run the optional browser suites.

Completed locally on November 8, 2026:

- `node test-hitmen-fixed-room.cjs` — PASS in headless Microsoft Edge, including the standalone revision 6 artifact. All three banks were visually inspected at desktop and phone widths.
- `node test-hitmen-find-stall.cjs` — PASS for the existing normal roster, horizontal concept, 360 tour and dedicated stall level, including the standalone revision 5 artifact.
- `node test-public-team-rosters.cjs` — PASS for 62 teams / 1,037 main-rostered players, including exactly 17 Calgary players.
- `test-lgchl-locker-chooser.cjs` — PASS with read-time CRLF-to-LF normalization for this Windows checkout. The existing source-format assertion assumes LF; no chooser implementation was modified.
- JavaScript syntax checks for the changed team module, fixed-room module and new browser test, plus `git diff --check` — PASS.

During implementation, a deferred return-to-room focus callback could steal focus from a newly opened search. The fixed-room callback now preserves an active search, while still restoring the selected jersey for ordinary Back/Escape navigation. Loading/unavailable bank controls remain disabled until the verified roster is ready.

Review file: `Calgary-Hitmen-Fixed-Room-v6.html`. Work remains on local branch `feat/hitmen-find-my-stall`; no push, merge or deployment is part of this change.
