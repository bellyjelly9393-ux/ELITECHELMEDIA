# Controller Overlay integration

Target: bellyjelly9393-ux/ELITECHELMEDIA, main baseline 3295fddba14200c1b1f258ff4b32f1cc002ee378.
Confirmed by index.html canonical/og:url and obs-control.js PRODUCTION_ORIGIN matching https://wildmanhockey-elitechelmedia.app.

## Architecture and scope
The site serves static HTML/CSS/JavaScript, has Vercel API functions and vercel.json routing. obs-control.html is the management-gated Broadcast Studio. Existing obs-control.js publishes channel state; obs-stage.html combines gameplay with obs-overlay.html graphics. This change leaves those scripts, scene definitions, state storage, authentication, API routes and deployment configuration untouched.

The new panel integrates the external Keymap overlay; it is not a new local input capture engine. It generates an Xbox Browser Source URL, defaults to transparent/gold, supports dark/green backgrounds and arbitrary pressed-button colour, and recreates the supplied pink/green preset. A built-in SVG appearance preview always works without an external request and explicitly marks the A-button highlight as sample input. Optional Keymap live preview loads only on request, and follows configuration changes after loading. Copy failure selects the URL for manual copying. Settings live in the generated URL; changes must be pasted into OBS. No database or secrets are needed.

Files changed:
- obs-control.html: panel inside existing management gate; new stylesheet/script references.
- obs-controller.css: scoped gold/black styling and responsive preview.
- obs-controller.js: validated URL generation, presets, preview loading and clipboard handling.
- tests/obs-controller.test.cjs: five focused automated tests.
- docs/controller-overlay.md: integration, verification and deployment notes.

## Input boundary
Keymap documents that its Gamepad API reads the controller visible to OBS on the streaming computer. It cannot see a controller connected only to an Xbox Series X. A video capture card does not add a gamepad input path. No physical controller or user's OBS instance was available for verification. A rendered preview must not be presented as successful live capture.

Realistic paths: PC-connected controller for PC play; a separately verified console-compatible input forwarding bridge/hardware adapter; investigation of a PC-connected controller driving a compatible Remote Play client (not configured or guaranteed here); or a camera showing hands/controller. The panel implements no relay, Remote Play client or console pairing.

## External dependency
https://keymap.io/controller-overlay/ documents 600 x 400, transparent default, Gamepad API capture and console limitations. A live fetch on 2026-10-26 of https://keymap.io/overlay/?style=xbox&accent=d9a63b returned data-bg="transparent", data-style="xbox", data-accent="#d9a63b" and data-live="false" with no attached controller. The supplied pink/green URL likewise returned an Xbox drawing. Preview requests include gamepad permission delegation and no referrer. Keymap availability, framing policy and browser/OBS support remain external dependencies. Standalone Open Overlay is provided if embedding is blocked.

## Validation
- node --check obs-controller.js: passed.
- node tests/obs-controller.test.cjs: 5/5 passed (URL defaults, presets and preview updates, validation, clipboard success/failure, gate placement and warnings).
- Existing public-navigation.test.cjs: two failures in untouched files: index.html footer contains private management link; markup extraction expects LF but checkout is CRLF. These are unrelated to this panel.
- Headless Edge: real DOM presets verified; panel width 376px at a 390px viewport with no panel element overflow. Account scripts were blocked and the existing management container was revealed only in the local test fixture. Existing whole-page overflow was outside this panel. External Keymap iframe did not render within 15 seconds; standalone links and built-in appearance preview provide fallbacks. No authenticated production session or physical OBS/controller capture was tested.

## Deployment and rollback
No production deployment is performed by this change. Review the isolated branch/draft PR before merging. vercel.json indicates Vercel compatibility but a linked project and production branch configuration were not independently confirmed through a hosting account. A Git integration may create a preview on branch push; do not treat that as production deployment.

After preview/production deployment, sign into Broadcast Studio, configure the panel, load the preview and open standalone overlay. In OBS add a separate Browser Source above gameplay, paste the generated URL, set 600 x 400 and disable Shutdown source when not visible. Press a button on a PC-visible controller and verify face buttons, both sticks and analog triggers in OBS; disconnect and reconnect to check recovery. Verify existing scenes and feed controls still work. Only green background requires chroma key. Rollback by reverting this feature commit; existing scene/state data is unaffected.
