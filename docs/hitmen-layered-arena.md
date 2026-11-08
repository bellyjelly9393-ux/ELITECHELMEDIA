# Layered public arena schedule

Implemented on `feat/hitmen-layered-arena` from the released public room. Review artifact: `Calgary-Hitmen-Layered-Arena-v8.html`.

The user's supplied arena reference is reproduced using the existing `assets/lgchl/rooms/hitmen-games-arena.webp` scenery. No new generated image or flattened screenshot of game content was introduced. The scenery includes static arena signage, skyline, banners and ice branding. The schedule remains normal page content over that scenery:

1. Scenery/background and dark footer wash.
2. Independently sized CSS metal frames, red title plates, bevelled rows, score badges and accent lights.
3. Existing live HTML dates/statuses, opponent names, native team logo images, scores and public game links.
4. Existing Stories/Radio links, one roster/source disclosure and season footer.

`hitmen-arena-schedule.css` is scoped to `.hitmen-tour .public-room-schedule`. The Calgary panoramic room and click-through stalls are preserved. Other teams and private pages are unchanged. The two boards stack at narrow widths; all content remains selectable and keyboard accessible. Their height follows the data instead of relying on fixed screenshot coordinates.

The data renderer and requests are unchanged: `lgchl-team.js` reads the existing public `lgchl_games_board` projection, Season 55, team 412, up to six finals and six upcoming games. The upcoming query uses the current clock. Rows use real away/home LG team IDs for logos and game IDs for destinations. A real score of zero remains visible; missing values retain the existing unavailable marker. The existing loading, empty and failed-read messages remain inside the independently sized frames. No private data or new writes were introduced.

The standalone review embeds saved public fixtures and all assets/fonts; it explicitly labels the saved roster/game information. Production code continues to request current public data. The review file does not establish that a particular live game or date is current.

Validation: headless Edge at 1440px and 390px; both frames and six fixture rows per board, correct public card mappings and existing roster navigation, one source disclosure, actual arena background layer, no document overflow. A second intercepted response changes the displayed score to 19–18 and empties Upcoming to verify values come from the response and the empty state remains usable. Game links accept keyboard focus. The complete existing public room/search/stall suite and standalone offline dependency check are run alongside these additions. The 62-team/1,037-player roster regression and whitespace/syntax checks passed. Desktop and phone arena screenshots were visually reviewed. No production deployment or physical phone/screen-reader session was performed for this revision.
