# GBR Carbon Arena OBS Browser Source

In the GBR OBS Desk, open **Pregame** to preview the arena off air. In **OBS setup**, use **Copy Carbon Arena OBS URL**, then paste the private link into the GBR Browser Source above gameplay. Set the source to 1920 × 1080 at 60 FPS and enable **Control audio via OBS**. The link is valid for 90 days. The browser source uses the Desk's published scene, so changing the preview tab is safe while on air.

The hosted arena is built from the original Elite Labs `carbon-arena` broadcast at `bcb50cf`. The packaging script allowlists the rink renderer, broadcast rig, textures, and Three.js dependencies. It reads the existing geometry and assets directly. The Playbook and Replay pages, data, and server are outside the package.

To refresh the bundle, generate the models with `npm run build:skater` in the private arena directory. Run `node tools/carbon-broadcast-pack.mjs <carbon-arena directory> <key file> api/_lg3s-carbon-pack.cjs` from this repository. The key file contains the 32-byte hex key mirrored in the sensitive `ICEVISION_CARBON_KEY` Vercel variable. Keep the key file outside Git and share it through the team's secret store. Changing the key requires repacking the bundle and generating fresh OBS links.
