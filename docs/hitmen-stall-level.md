# Stall close-up and games backdrop (revision 4)

Added November 8, 2026 on local branch `feat/hitmen-find-my-stall`. No merge, remote push or deployment.

## Two levels

The public 360° room continues to contain the same 17 verified Season 55 main-rostered Calgary players. Clicking a jersey, activating a stall marker with the keyboard, or selecting a roster-card link in tour mode opens a separate dedicated stall level. Search continues to find/highlight the room stall; searching while already in a stall switches its verified player identity. The regular non-tour team pages retain their existing public-card navigation.

The stall level uses `hitmen-stall-view.js` and `assets/lgchl/room-360/stall-master-v4.png`, a dedicated 1254 × 1254 image derived from the user-supplied close-up reference. It devotes far more pixels to one sweater than the panorama; it is not an enlarged panorama, a new 4K capture, or a verified replica of an official retail jersey. The original McKenna / 92 nameplate and generated brand marks were removed. The real data-driven nameplate displays position (LW/C/RW/LD/RD/G) in its left field and the selected roster name in the right field. No jersey number is invented.

All 17 public names, positions and skater/goalie card links come from the same existing main-roster objects. The full-size crest is a vector matched to the same primary Hitmen identity already used in the room. Both Hitmen and Elite Chel Media marks are separate native image layers so they remain clear. The jersey master has no baked-in player identity. Its white/red/black stars/flame treatment is a concept based on the supplied visual reference.

The image is loaded on demand in the repository version. Back to room and Escape return to the existing viewer; the original camera pose is restored when returning to the same player. Previous/next controls cycle only the 17 main-rostered players. Switching players keeps the shared image loaded and updates the name, position and public profile link. Unknown IDs are rejected. A failed image load leaves the back control, player identity and public profile link usable. The downloadable single-file preview embeds the assets for offline use, so its file is larger than the on-demand repository route.

## Games background

Recent games and upcoming matchups share an understated dark arena/rink graphic, faint red face-off/centre lines, soft red perimeter light and a muted Hitmen crest. The graphic is `games-rink.svg`, authored as simple code-native rink geometry. Existing score rows, team logos and game links remain on top. This adds a background rather than bringing back nested cards or the previous dashboard-style console. The saved-public-data caveat for the offline games remains in the source-information disclosure.

## Validation

The actual Edge browser suite passed at 1440px and 390px, including:

- Clicking the jersey and using Enter on the marker to open the dedicated level.
- All 17 roster names, positions and exact skater/goalie profile links in the new view.
- Rejecting an unknown ID, next/previous navigation, the final-player boundary, and keeping McKenna out of displayed player text.
- Loading the dedicated image at its native width, Back and Escape, restoring room orientation, and showing a usable error state if the stall image fails.
- Offline close-up rendering with zero HTTPS dependencies.
- Existing room rendering, search, keyboard controls, scene/floor navigation, logo layers, game mapping, fallback roster and no horizontal overflow.

The 62-team / 1,037-player roster regression, JavaScript syntax checks and diff whitespace check were also run. Desktop/mobile stall and games screenshots were visually inspected. No physical phone, screen-reader session or deployed copy was tested. The panorama retains its previously documented resolution and seam limitations; this change improves the selected-player experience through a separate image level.

## Artwork sources

- Master scene: user's supplied locker reference, edited to remove example identity and brand approximations.
- Hitmen vector: https://logotyp.us/file/calgary-hitmen.svg ; visually matched against the existing repository crest and the team identity shown on https://chl.ca/whl-hitmen/ . SVG was parsed and checked for scripts/active embedding before use; it has no script, foreignObject, JavaScript URL or onload handler. Brand ownership remains with the respective team/organization.
- Elite Chel Media: existing repository `assets/brand/ecm-logo.webp`.
- Rink backdrop: new local SVG geometry with no external references.

Current review file: `Calgary-Hitmen-360-Tour-v4.html`. The unversioned review file is updated; prior versioned review files are retained.
