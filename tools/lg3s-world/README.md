# LG3s Great Britain in Broadcast Studio

Open `/obs-control.html?channel=lg3s-gbr` while signed in as an authorized EliteChel Media operator. Select **LG3s Team Great Britain** to publish the gameplay feed, score, clock, and period on its own `lg3s-gbr` channel. Use a three-letter opponent code in the Away name field. The existing Studio tenant and permissions back this channel. Use **Trigger GBR Goal Horn** to play the animation and synthesized horn from the dedicated source.

The desk keeps scene switching and graphics cues beside the Program monitor. Open **Graphics** to select the rink camera, formation, and highlighted player. **Show Three Stars** uses the live ballot. The Program, Graphics, and Sample monitors are muted.

In **OBS setup**, use **Copy GBR OBS URL** to add `/lg3s-gb?mode=obs` as a Browser Source above gameplay. Set **1920 × 1080**, **60 FPS**, and **Control audio via OBS**. The separate Gameplay Only source can carry the Twitch or YouTube stream. The Combined Preview stays in the browser for monitoring. The viewer hub is `/lg3s-gb`, and the sample graphics URL is `/lg3s-gb?mode=obs&preview=true`.

The overlay and viewer can use the existing Broadcast Studio score and running clock immediately after the operator publishes. The standalone director and Three Stars voting use the additive `20261118120000_lg3s_obs_world.sql` migration. The OCR state takes precedence for 20 seconds after a saved OCR update. The viewer falls back to the Studio when the OCR worker is inactive. The rink preview uses Three.js with a Canvas fallback when WebGL2 is unavailable.

## Updating the bundle

Run `npm ci`, `npm run build`, and `node build-site.mjs` in this directory. The main Vercel project serves the generated files under `assets/lg3s-world/` and rewrites `/lg3s-gb` to the viewer entry point. The bundle reads the existing public Supabase connection settings from `backend.js`. Keep application code changes here and commit the refreshed static bundle with them.

## OCR and ballot

Apply the migration on the site's Supabase project before starting the local director. Use the example environment file and put the OBS WebSocket password, Gemini key, and Supabase server credential in the director machine's local `.env`. Run `npm run director` there. The source configured as `OBS_GAMEPLAY_SOURCE` must be the clean game capture. To use automatic vote-driven lower-thirds, set `AUTO_PUSH_STARS=true`. The manual Three Stars push requires the server-managed `lg3s_director` app metadata flag. Guest voting uses Supabase Anonymous Sign-Ins when enabled. Staff can supply boxscore data and multiview embed IDs on the match record.

National flag vectors come from FlagCDN. Fonts are distributed with their SIL Open Font Licenses. The standby arena image is generated.

## Pregame world and lineup feed

In the GBR Broadcast Studio channel, use the **Pregame** monitor tab to review the loop off air. Choose the **Pregame** scene button to send it to the existing GBR OBS Browser Source. It runs continuously until a different scene is selected. A separate browser source is also available at `/lg3s-gb/pregame?mode=obs`.

The loop rotates the next game night's matchups, uses Toronto puck-drop times, and pairs wing, center, defense, and goalie cards. Player links are keyed by LeagueGaming ID. The existing public skater and goalie views provide verified season totals. An unposted team or roster fallback is labeled accordingly. The three November 18 games were seeded from the supplied LeagueGaming lineup screenshots. The import excludes matchmaking details and all other game-page fields.

The weekly GitHub import runs Wednesday at 2:00 a.m. America/Toronto after the repository secret `LG3S_LINEUP_FEED_URL` points at an approved HTTPS JSON export. The importer accepts the existing LeagueGaming game-sheet parser output shape with game IDs, team IDs and linked player IDs, or the normalized `data/lg3s/pregame-lineups.json` shape. The scheduled job publishes only this validated data file to `lg3s-pregame-data`. The viewer uses the site seed while the feed is unavailable. The desktop LG Client currently has no hosted lineup export. It must export or publish a lineup snapshot through its supported signed-in session before the scheduled import can pull one.

To validate a local export without configuring the weekly job, run `node tools/lg3s-world/import-pregame.mjs path/to/export.json path/to/sanitized.json` from the repository root.
