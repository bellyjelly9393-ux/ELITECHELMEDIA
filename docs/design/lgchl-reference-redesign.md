# LGCHL reference implementation — November 2, 2026

The live UI uses reusable scenery with HTML data layers. Player names, rankings, records, and statistics are not baked into pictures.

## Visual assets

- `assets/lgchl/studio/podium-stage-v2.webp`: blank physical silver/gold/bronze pennant stage, derived with the built-in image tool from the approved rankings reference. Prompt: preserve the material, spotlights and physical pennant frames; remove all crests, words and numbers; leave blank black leather faces for live overlays.
- `assets/lgchl/studio/broadcast-frame-v2.webp`: empty polished gold frame with black leather interior and small blue corner accents, derived with the built-in image tool from the approved race reference. Prompt: continuous rectangular bevels, chamfered corners, blank interior, no words/logos; intended for CSS nine-slice rendering.
- `assets/lgchl/jerseys/team{447,448,449,455}.webp`: transparent illustrative cutouts based on real product-photo references. Prompt: preserve the club crest, colours, striping and realistic chest scale, remove the background and hanger, use a straight hanging front view and warm locker lighting. Cape Breton sleeve placeholder zeros were removed. These are image-tool derivatives, not claims about the uniform worn in a specific LG game.
- `assets/lgchl/studio/goalie-equipment-v2.webp`: photorealistic goalie equipment display generated with the built-in image tool: two pads, catcher, blocker, mask, goalie stick, black/white/gold, central transparent jersey space, no brands or text.
- Approved booth and jumbotron assets remain reusable backgrounds.
- Stick-rack scenery uses a CSS-clipped area of the approved artwork; its baked example data is outside the visible crop.

Jersey references: Barrie team shop `https://barrie-colts.myshopify.com/products/adult-navy-replica-jersey`; North Bay team shop `https://online-quartermaster-retail.myshopify.com/products/youth-north-bay-battalion-replica-sweater-green-2`; Sudbury arena retailer `https://greatersports.ca/products/wolves-authentic-ua-replica-game-jersey-green-copy`; Cape Breton product reference already supplied in the project workspace.

## Data and limitations

- Scores and team power index continue to use public Supabase views. All 93 November 1 finals were present at verification, with 604 total goals. No privileged browser keys or private War Room records are added.
- The verified November 2 leaderboard capture supersedes older remote rows only for the exact captured category. It contains top 20 points, top 15 goals/assists and smaller other category boards, not a complete 1,570-player export. A newer remote import wins automatically.
- `data/lgchl/night-current.json` aggregates the 78 available official November 1 game sheets by LG player ID and player kind. Points reconcile with goals plus assists; goalie saves plus goals against reconcile with shots faced; duplicate player-game entries are rejected. It is explicitly incomplete and the page labels its leaders provisional.
- Fifteen game sheets remain unavailable because the source pull stopped at a Cloudflare check. The disabled background scraper was not restarted to bypass that restriction.
- Historical breakout/movement comparisons remain explicitly dated archives while their updated source is unavailable.
- Future jersey asset mapping is by team ID. Unavailable jerseys use a real team crest rather than an invented official uniform.

## Validation

`node --test tests/lgchl-fresh-data.test.cjs` checks capture freshness precedence, November 1 reconciliation, partial coverage, and correct selection of nightly/weekly leaders. Browser review uses the real page at 390px and 900px widths before production publication.
