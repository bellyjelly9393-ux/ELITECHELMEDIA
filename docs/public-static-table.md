# Public room static tabletop correction

The former tabletop was a camera-facing SVG/logo hotspot with a CSS perspective transform. Its apparent plane could separate from the photographed table while dragging, turning or zooming.

This revision removes that hotspot and its decorative DOM/SVG branch. The rink markings and supplied Hitmen/Elite Chel Media logo references are part of the versioned panorama textures: entrance-table-v9.png and centre-table-v9.png. They now share the table's projected pixels at every camera pose. The old backgrounds remain available as prior versions; no private-room files are changed.

Built-in image editing was used on each corresponding room background, with the existing team412.png and ecm-logo.webp as supporting inserts. Prompt: change only the central tabletop, put red hockey rink lines and the supplied logos flat inside the oval rim, foreshortened and under the surface reflections; preserve wide panorama projection, locker positions, gear, signage and framing; no floating boards or player identities. Selected outputs were copied into assets/lgchl/room-360 with sibling versioned filenames. Image-rendered logo detail is illustrative; the change eliminates runtime floating layers.

Player names/jerseys, searches, 17 roster mappings, dedicated stall view and all game-board data remain separate live layers. The static tabletop contains no scores, roster names or private information. Navigation controls remain normal interactive hotspots.

Validation passed in headless Edge at desktop/mobile widths: both panorama scenes, dragging and camera controls, floor navigation, search, all 17 public identities and profile links, close-up/goalie artwork, games/logo mapping, empty upcoming response, changed scores and offline artifact. A new assertion verifies there are no table-overlay DOM elements. The 62-team/1037-player roster regression, syntax and whitespace checks passed. Both edited backgrounds were visually inspected. No deployed copy or physical device was tested for this correction.

Review: Calgary-Hitmen-Static-Table-v9.html. Branch fix/public-room-static-table. This correction has not been merged or deployed.
