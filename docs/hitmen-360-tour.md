# Calgary Hitmen 360° public room prototype

Built November 7, 2026, on `feat/hitmen-find-my-stall`. The existing site and private War Room were not deployed or modified remotely.

## Open it

- Self-contained review copy: `Calgary-Hitmen-360-Tour.html`. Open in a modern browser. All art, viewer code and the saved roster are embedded; it works offline. Player-card links lead to the existing public website.
- Repository preview route, when served locally: `lgchl-team.html?team=412&room=360`.
- Existing roster view and earlier horizontal concept remain available at `?team=412` and `?team=412&room=concept`.

## What works

Drag or swipe to look around a spherical panorama. Native keyboard-accessible buttons turn left/right, zoom, reset and enter fullscreen. Entrance and centre panoramas form two view nodes, with clickable floor arrows and viewpoint buttons. Find My Stall reuses the existing public roster search; selecting a player turns to the mapped locker, highlights the corresponding hotspot, and provides the correct public player-card link. Each scene has exactly 17 player hotspots. Player names appear on hover/focus/selection, keeping the room uncluttered. A visible roster-card fallback is offered if the panorama viewer cannot load; users can also show the cards manually.

The visuals follow the supplied reference: circular ceiling lights, central table, skyline murals, white/red jerseys and red lighting. The room is explicitly branded PUBLIC LOCKER ROOM. No private management, scouting, tactics, availability, account or War Room data is included. Names are data-driven overlays, not generated text in the artwork. Jersey numbers were not invented.

## Public identity source

Same existing Season 55 / Calgary team 412 public main-roster snapshot dated November 5, 2026, containing 17 active-roster players. No TC, reserve or former players added. IDs and skater/goalie card links are preserved. No additional EA aliases were invented or fetched. The backdrop assignment is a prototype display arrangement of those 17 players, not a claim about a real-world locker assignment.

## Artwork and limits

Two AI-generated 2:1 environment textures, each 1774 × 887 pixels, with generated branding removed and real logo image layers added by the viewer. Manually counted six left + five centre + six right bays in each accepted image. Generated drafts with wrong counts were rejected. The source files are `assets/lgchl/room-360/centre-clean-v2.png` and `entrance-clean-v2.png` (earlier drafts remain available for reference).

This is a reviewable interactive concept, not final high-resolution production artwork. Zoom reveals softness. The rear-wall wrap join and some architectural details differ between the independently generated nodes; the camera positions are illustrative rather than a geometrically surveyed room. Rotation and floor-arrow transitions are functional, but the images still need professional seam/geometry polish before a claim of a fully seamless final tour. Vertical viewing is limited to ±65 degrees to avoid pole artifacts. It does not simulate continuous walking or true real-time 3D geometry.

## Verification actually performed

- Existing 62-team / 1,037-player public roster regression: passed, including Calgary's 17, public card links, missing stats and stats outages.
- JavaScript syntax checks and `git diff --check`: passed.
- Playwright with headless Microsoft Edge at desktop 1440px and mobile 390px, with reduced motion and mobile touch emulation: passed actual WebGL canvas rendering, 17 hotspot IDs per scene, all 17 player-to-card links, search selection, selected hotspot, real pointer-drag camera rotation, floor-arrow scene change (including touch tap), accessible turn/zoom controls, roster reveal, unknown-player rejection and no horizontal page overflow or browser page errors.
- Viewer dependency failure: passed fallback to 17 visible roster cards.
- Offline HTML opened from disk: passed both scene loads, 17 hotspots, player search/selection, zero HTTPS dependencies and no page errors.
- Desktop/mobile screenshots and the rear wrap join were visually reviewed. The visual limitations above were observed, not hidden.
- Existing horizontal concept and roster-layout browser checks also passed.

Stats reads were mocked unavailable for deterministic browser checks. The offline review copy labels live stats as disconnected. No physical phone, screen-reader session, real private authentication flow or deployed copy of this change was tested. Fullscreen control is implemented but a manual OS fullscreen session was not tested. The existing GitHub workflow syntax-checks the new module; Playwright remains an explicit local suite rather than an installed CI dependency.

## Viewer provenance

Self-hosted Pannellum 2.5.7 from its documented download URLs, with its licence in `vendor/pannellum/COPYING`. No tour-hosting service or new account is required. Official documentation: https://pannellum.org/documentation/overview/ and https://pannellum.org/documentation/api/ .

No push, merge or deployment was performed. The accompanying consolidated patch contains the public Find My Stall implementation, horizontal concept and this opt-in 360° prototype.


## Branding, lower panels and custom nameplates (revision 2)

The generated emblems and lettering were removed from the room sign, 17 jersey chests and tabletop. Real assets from the existing repository are now used without redrawing them: `assets/lgchl/s55/team412.png` for Calgary and `assets/brand/ecm-logo.webp` / `ecm-crest.webp` for Elite Chel Media. The sign, jerseys and table use camera-linked image overlays; the same assets appear in the header, player console and publisher footer. They remain sharp as separate UI image layers, though the underlying environment still has the previously documented visual limits. These overlays are illustrative decals rather than fully modelled 3D materials.

The room console, camera buttons, selected-player area, recent-finals cards, upcoming-game cards and follow-team section share black/chrome surfaces, red accent borders and consistent type. Game cards display both clubs' existing crest assets, abbreviations/names, ET dates, real scores for finals and public Game Centre links. Production code retains the existing public live-read flow and adds the two public team-ID fields to the game projection. Other teams keep their existing presentation.

For the offline review copy, six real finals and six upcoming games were captured from the existing `lgchl_games_board` public projection, stored with source/retrieval metadata in `assets/lgchl/room-360/public-games-preview.json`. For example, game 918480 is Calgary 7, Everett 2; crest IDs 412 and 380. The saved schedule is a snapshot, not a live feed. No results or opponent identities were invented. Live player totals are still disconnected in the offline copy.

Clicking a jersey or stall marker now selects it and reveals a brushed-metal nameplate with the actual Hitmen crest, exact public roster name, position, and display stall index. The plate has rivets, engraved-style lettering and an explicit public-player-card link. Its index is not a jersey number. Hover/focus can preview the plate; Escape dismisses it. Clicking the plate's link or the console's card button opens the public profile. Nameplate placement adjusts to keep the selected plate fully inside the room viewport on desktop and phone.

Additional verification passed in the actual browser at 1440px and 390px: 17 real-logo jersey layers; both real sign logos; real game IDs, score data and opponent crest IDs; correct selected name/position/index; clickable jersey hit area; Escape dismissal; custom plate content and public link; plate fully inside viewport; all prior tour, room, fallback and roster checks; offline two-scene rendering with no HTTPS dependencies. The updated standalone copy is `Calgary-Hitmen-360-Tour-v2.html`; the original standalone filename has also been refreshed. Screenshots of the plate, room console and game panels were visually inspected.

No remote push, merge or deployment was performed for this revision.
