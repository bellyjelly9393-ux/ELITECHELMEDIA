# Hitmen Radio — Nightly Show episodes (homepage player)

The homepage section `#hitmanNightly` (index.html) reads `episodes.json` in this folder.
The newest `date` plays in the main player; every other entry appears under
"Catch up — past episodes", grouped by week (Mon–Sun). Older weeks sit behind "Show more".
Never delete entries: the archive is permanent.

## Add a new night (no code changes)
1. Encode the video to 720p H.264, faststart, ~30 MB:
   `ffmpeg -i nightly_video.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -b:v 600k -c:a aac -b:a 96k -movflags +faststart YYYY-MM-DD.mp4`
   (2-pass recommended: `-pass 1 -an -f mp4 /dev/null`, then `-pass 2`.)
2. Poster: `ffmpeg -i thumbnail.png -vf scale=1280:-2 -q:v 80 YYYY-MM-DD-poster.webp`
3. Drop both files here and add one entry to `episodes.json`:
   `{ "date": "YYYY-MM-DD", "label": "Oct 20 games", "headline": "One line", "video": "assets/hitman-radio/nightly/YYYY-MM-DD.mp4", "poster": "assets/hitman-radio/nightly/YYYY-MM-DD-poster.webp", "credits": "optional, plain text; twitch.tv/x becomes a link" }`

Shareable link to an episode: `/#ep-YYYY-MM-DD`.

Optional: `data-default="YYYY-MM-DD"` on a section pins which episode it opens on (lgchl-media.html uses this); without it the newest plays.

When replacing an existing video/poster file in place, bump the `?v=` tag on its `video`/`poster` URLs in episodes.json so browsers drop the cached copy.
