# Three Stars art layers

The Three Stars generator (`three-stars.html`) builds the graphic from layers. Drop art here and it
is picked up automatically; no code changes needed.

## Background

`assets/three-stars/background.png` (or `.webp`)

- 1200 × 1312 px (same shape as the original graphic). Other sizes are scaled to cover.
- The locker room only: **empty stalls, no jerseys, no text, no stat boxes, no logos.**
  Title, nameplates and stat cards are drawn live on top.
- Keep the top ~200 px and the bottom ~380 px (y 930 to 1312) fairly dark and plain; that is where
  the title and stat cards sit.
- Stall centres the layout expects: x = 268 (third star), 600 (first star), 932 (second star).
  Nameplates sit at y ≈ 244–294, jerseys hang from y ≈ 312 down to ≈ 712.
  If your stalls land elsewhere, use "Line up jerseys with the stalls" in the tool.

## Jerseys

`assets/three-stars/jerseys/team<lg_team_id>.png` (or `.webp`)

- One per LGCHL team, named by LG team ID, e.g. `team412.png` for the Calgary Hitmen.
  The IDs match the logo files in `assets/lgchl/s55/` (same `team<id>` names).
- Transparent background (PNG/WebP with alpha), jersey facing front, on its hanger if you want one.
- Roughly 660 × 800 px; anything with that shape fits the 330 × 400 slot.
- Crop tight to the jersey so every team hangs at the same height.

Missing jerseys show a dashed placeholder with the exact filename to add.
