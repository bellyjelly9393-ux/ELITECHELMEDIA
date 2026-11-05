# Hitmen War Room V3 — approved visual contract

**Status:** Design locked for implementation review. Do not merge until the interactive page passes visual and data checks.

## Reference
The approved visual is the *latest* ELITE CHEL MEDIA / Calgary Hitmen **MY STALL** concept image in the November 4, 2026 conversation, file `calgary_hitmen_my_stall_war_room.png` (1086 × 1448). This image is the visual target, **not** a licence to serve a baked UI screenshot as the functional page. If an implementation visually departs from it, stop and correct the difference.

## Exact layout and artwork to preserve
1. Existing Elite Chel Media / Calgary Hitmen War Room identity, logos and black/red/gold navigation.
2. One **two-bay metallic locker**, containing **both front and back black Hitmen jerseys simultaneously**, each on a hanger.
3. The jersey look: black fabric, pink-red flames/trim, crest and shoulder details, red shelf backlighting, framed locker, helmet/gloves on upper shelf and skates on outer hooks.
4. One metal nameplate across the locker; **one player name and number** drives the back jersey nameplate, back number, sleeve numbers, top plate and player info.
5. Back number scaled appropriately to jersey panel, not the entire locker; avoid double-printed or oversized number overlays and text burned into the reusable artwork.
6. Below the locker: player identity strip, heavy angled metallic tabs for Overview / Stats / Scouting / Settings, individually inset metallic stat tiles, recessed Recent Stats / Scouting Notes / Development modules, bottom Player Tools bar.
7. Realistic bevels, edges, screws, shadow and LED accents; **do not** replace with rounded pastel cards, generic neon gradients or a flattened dashboard.
8. Preserve existing War Room role-based access, player URLs, existing LG-derived statistics, scout notes, game and weekly reports, editable jersey fields and asset uploads. Reference image numbers, dates and scouting notes are **illustrative only**, not valid backend data.

## Engineering approach
- Build as proper responsive HTML/CSS/JS components; never embed the entire mockup as the functional page.
- Separate the front/back jersey and equipment image layers from editable text. Source/prepare true blank jersey masters before connecting production data.
- Keep persistent player identity and source data (LG ID / approved reviews) distinct from jersey presentation settings.
- Use image uploads for the player's equipment initially; optional detection later, with confirmation.
- Keep uploaded equipment private to authorized team members under existing Supabase permissions. No new public data endpoints.
- Preserve goalie-specific stats and equipment layout. Show unknown/missing stats as pending, **not fake zeroes**.
- Ship on a **preview branch**. Compare desktop and 390px mobile screenshots with the reference, exercise editable name/number including short and long names, check 00–99, goalie/skater and unauthenticated access. No production merge without approval.

## Acceptance checks
- Visually matches the approved reference at hero and information panel level, not merely similar colours.
- Both jerseys visible without flipping; name/number synchronize on all locations and persist per existing permissions.
- Existing actual stats, scouting and evidence remain unchanged in database.
- Mobile layout does not crop jerseys or hide actions; names and number stay readable.
- Restoring prior design is a single revert of this branch's commits.
