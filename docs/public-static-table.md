# Static table with original logo assets — revision 10

The generatively edited revision 9 table backgrounds redrew the logos. They are superseded by a deterministic browser-side texture compositor. No redesigned logo is used by this revision.

`hitmen-table-texture.js` starts with the unbranded `entrance-gear-v7.png` and `centre-gear-v7.png` backgrounds. It draws rink lines in a temporary canvas and inserts the unchanged `assets/lgchl/s55/team412.png` and `assets/brand/ecm-logo.webp` files using their intrinsic aspect ratios. A calibrated projective plane places that design within the photographed tabletop. The completed texture is passed to the panorama viewer. Source image/logo files are unchanged. There is no camera-facing tabletop element, floating graphic, new generated image or live player information in the texture.

The original logo pixels remain subject to the table's natural foreshortening and the panorama's viewing resolution. They are not redrawn by an image model. Texture composition is cached per scene and rendered at twice the background resolution to retain logo edge detail. If a source fails to load or canvas composition fails, the original plain table background is used instead of a distorted or invented logo. Header logos remain independent native assets. Jerseys, roster identities and live game boards remain independent layers.

The prior AI-edited table PNGs are removed from this branch's source tree; the earlier versioned offline review remains available for comparison. No private-room files are changed. Review artifact: Calgary-Hitmen-Exact-Logos-v10.html.

Validation: headless Edge desktop/mobile public-room suite, both scenes, dragging/zooming/navigation, all 17 roster/card mappings, exact skater/goalie assets, live game fixture updates and empty states, and standalone offline preview without HTTPS requests. Explicit browser checks confirm both scenes produce a composed PNG texture and there are zero tabletop overlay elements. The new compositor and main module passed syntax checks, and the diff whitespace check passed. The original-room view with the new logos was visually inspected. No production copy or physical device was tested for this revision.

Branch: fix/public-room-static-table. Not merged or deployed.
