# Three Stars art layers

The Three Stars generator (`three-stars.html`) builds the graphic from layers. Drop art here and it
is picked up automatically; no code changes needed.

## Background

`assets/three-stars/background.png` (or `.webp`)

- 1200 × 1312 px (same shape as the original graphic). Other sizes are scaled to cover.
- Either plain empty stalls (the generator draws the title, nameplates and card frames itself), or
  art with those already painted in, like the current one. `layout.json` says which.
- Leave the nameplates and stat-card frames empty and the stalls bare (hangers are fine).

## layout.json (what's in the art, and where)

`layout.json` tells the generator which parts are already painted into the background (`baked`) and
where to draw names, jerseys and stats. The current art has the title, logos, nameplate frames,
bench stars and stat-card frames built in, so the generator only fills them. The date line goes
in the strip under the cards (`kicker`).

New art with different positions only needs new numbers here, not code. Slots: `1` = first star
(centre), `2` = second (right), `3` = third (left). `plate` and `jersey` use a centre x (`cx`);
`card` uses its top-left corner. All on the 1200 × 1312 canvas.

Because the title is part of the art, week posts still say "TONIGHT'S". For those, make a second
background with the week wording and swap it in with the tool's "Background (one-off)" field.

## Jerseys

`assets/three-stars/jerseys/team<lg_team_id>.png` (or `.webp`)

- One per LGCHL team, named by LG team ID, e.g. `team412.png` for the Calgary Hitmen.
  The IDs match the logo files in `assets/lgchl/s55/` (same `team<id>` names).
- Transparent background (PNG/WebP with alpha), jersey facing front, on its hanger if you want one.
- About 620 × 660 px (or anything that shape); the slot is 310 × 330 and hangs from the hanger
  at y ≈ 380. Include the hanger in the cut-out if you want it to cover the painted one.
- Crop tight to the jersey so every team hangs at the same height.

Missing jerseys show a dashed placeholder with the exact filename to add.
