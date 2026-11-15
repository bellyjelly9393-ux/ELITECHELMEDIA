# LG3s Japan 3D locker | Prototype review

**Scope:** Japan, LG3s Season 1, LeagueGaming team ID 591. Preview only, no production changes until owner approval.

## Ground truth
- Source: `data/lg3s/season1-active-roster-2026-11-14.json` (LeagueGaming main-roster-only snapshot).
- 11 active Japan players with distinct valid `lgUserId` identifiers, including two goalies.
- Every recorded `jerseyNumber` is `null`; the preview never assigns an official number.
- From the user-supplied Japan jersey image: black fabric, red horizontal sleeve bands, central red disc emblem, red shoulder accents, white back lettering/number design. The geometry and texture rendering are **original reference-inspired concepts**, not an official licensed uniform recreation. No Nike marks are copied.
- Great Britain is still `lg3s-gb-locker.html` with its independently hosted 3D app unchanged.

## What the preview actually does
- `lg3s-japan-locker.html` is a standalone prototype with an accessible player selection roster. It does not embed a private app.
- `lg3s-japan-3d.js` renders a real WebGL Three.js room: 5 back wall stalls, 3 left side and 3 right side, hockey jerseys, goalies' equipment, bench, nameplate textures, and stage lighting.
- Use mouse drag to orbit, click a player jersey/stall or choose a roster button, inspect the selected stall, and rotate the jersey to its back.
- Back features verified gamertag and optional **non-persistent cosmetic number preview** (0–99). An unassigned number is the default; no user input goes to Supabase or the server.
- The Hockey Card action uses `player-cards.html?league=lg3s&id=<LG ID>&kind=skater|goalie`.
- The public team-room router and LG3s nation selector route Japan to the 3D prototype **on this branch only**. `?fallback=1` preserves Japan's 2D stalls. Britain routes are unchanged.
- On touch devices, canvas starts with pointer events disabled to keep page scrolling working. Use **Enable touch view** to orbit, then **Return to page scrolling**.
- The scene needs a modern WebGL browser and CDN access to Three.js r162; the roster links remain usable when WebGL cannot load.
- Static source/assets and source-level logic checks are not the same as physical-device visual QA.

## Acceptance checklist before any merge
1. Open protected preview at `lg3s-japan-locker.html`, confirm actual WebGL scene renders on phone and desktop. Inspect any console/network errors.
2. Select all 11 players using 3D stalls and accessible roster. Confirm exact names, correct positions, and card destinations.
3. Verify the black/red jersey matches the supplied Japan reference closely enough for initial approval; inspect front/back, sleeve stripes, chest emblem, nameplate, and absence of fabricated numbers.
4. Check both goalie stalls have pads and the other nine stalls show skater gear. No private data.
5. On mobile, scroll vertically past the scene before entering touch mode, then toggle touch view, orbit and exit without trapping the user.
6. Test an unavailable Three.js CDN / blocked WebGL situation: the 2D roster fallback must still work.
7. Compare Great Britain's existing 3D locker and router functionality; no changed GB files.
8. Performance: check low-end phone; if frame rate stutters, reduce DPR, texture dimensions and shadows before release.
9. Only after explicit owner approval merge the PR to main and validate Vercel production alias.

## Longer-term architecture
Great Britain's public 3D scene lives in a **separate standalone app**. Its renderer source is not in this repository. The Japan prototype reuses the *public roster, stall, card, and routing contracts*, not the unretrieved private model source. Once owners validate the first nation, refactor Japan's renderer into a shared asset-pipeline project rather than copying eleven diverging 3D scenes.
