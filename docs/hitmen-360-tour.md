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

Two AI-generated 2:1 environment textures, each 1774 × 887 pixels. Manually counted six left + five centre + six right bays in each accepted image. Generated drafts with wrong counts were rejected. The source files are `assets/lgchl/room-360/centre-branded-v1.png` and `entrance-branded-v1.png`.

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
