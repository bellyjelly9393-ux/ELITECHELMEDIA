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
- Players can change the local display name on the stall plate and jersey back (1–18 characters) and choose a cosmetic 0–99 jersey number, including leading zeroes. The original LeagueGaming gamertag remains visible as a **verified** identity and the Hockey Card still uses its canonical player ID.
- Free appearance preferences are saved **only to the visitor's browser** using the shared `lg3s-basic-customization.js` module with key `ecm:lg3s:s1:team:<team ID>:player:<LG user ID>`. Japan's 3D view and Japan's 2D fallback share this key. The same free editor also appears in the other generic LG3s nation rooms. Clearing browser storage or changing devices resets the preference. It is NOT account-synced or team-wide published.
- The Hockey Card action uses `player-cards.html?league=lg3s&id=<LG ID>&kind=skater|goalie`.
- The public team-room router and LG3s nation selector route Japan to the 3D prototype **on this branch only**. `?fallback=1` preserves Japan's 2D stalls. Britain routes are unchanged.
- On touch devices, canvas starts with pointer events disabled to keep page scrolling working. Use **Enable touch view** to orbit, then **Return to page scrolling**.
- The scene needs a modern WebGL browser and CDN access to Three.js r162; the roster links remain usable when WebGL cannot load.
- Static source/assets and source-level logic checks are not the same as physical-device visual QA.

## Free vs purchased tier contract (not yet a checkout flow)

- **Free:** player selects a roster stall, chooses a local display name and a cosmetic number, saves or resets for this browser. The visual customization does not create a roster alias, an official number, or team-wide changes.
- **Future verified premium:** jersey/equipment sets, gloves, helmets, skates, goalie pads, stall interiors, personalized graphics and lighting, like the Hitmen custom locker concept.
- The 3D Japan scene on the feature branch is a **design preview**, not proof of an active subscription. Advanced customization remains locked in the UI.
- **Do not trust a frontend paid flag or localStorage purchase marker.** A real paid product must verify account sign-in, the LeagueGaming player-to-account claim, payment provider confirmation, entitlement state, refund/revocation, and server-enforced access checks before unlocking premium state or publishing stall customization.
- A premium purchase cannot confer control over another player's verified identity. The identity linkage must be owner-approved, separately from editable cosmetic labels.
- Great Britain's independently hosted 3D room remains untouched; its live 3D nameplates will not automatically follow the generic 2D browser-local preference until the GB app adopts the shared contract.
- Prices, checkout pages, and entitlement IDs are not invented or enabled here.

## Acceptance checklist before any merge
1. Open protected preview at `lg3s-japan-locker.html`, confirm actual WebGL scene renders on phone and desktop. Inspect any console/network errors.
2. Select all 11 players using 3D stalls and accessible roster. Confirm exact names, correct positions, and card destinations.
3. Verify the black/red jersey matches the supplied Japan reference closely enough for initial approval; inspect front/back, sleeve stripes, chest emblem, nameplate, and absence of fabricated numbers.
4. Check both goalie stalls have pads and the other nine stalls show skater gear. No private data.
5. On mobile, scroll vertically past the scene before entering touch mode, then toggle touch view, orbit and exit without trapping the user.
5a. Save a free nameplate and #00 or #99, refresh, verify the selected stall and jersey back persist on the same browser; reset and confirm the verified name returns. Check team/player isolation in the other generic LG3s rooms. Do not interpret the free local preference as a publicly saved player profile.
6. Test an unavailable Three.js CDN / blocked WebGL situation: the 2D roster fallback must still work.
7. Compare Great Britain's existing 3D locker and router functionality; no changed GB files.
8. Performance: check low-end phone; if frame rate stutters, reduce DPR, texture dimensions and shadows before release.
9. Only after explicit owner approval merge the PR to main and validate Vercel production alias.

## Longer-term architecture
Great Britain's public 3D scene lives in a **separate standalone app**. Its renderer source is not in this repository. The Japan prototype reuses the *public roster, stall, card, and routing contracts*, not the unretrieved private model source. Once owners validate the first nation, refactor Japan's renderer into a shared asset-pipeline project rather than copying eleven diverging 3D scenes.
