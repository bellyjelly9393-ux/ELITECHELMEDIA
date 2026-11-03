# LGCHL public highlights

The Game Centre reads only `lgchl_game_highlights` rows with verified and published timestamps. It constructs MP4 URLs in the dedicated `lgchl-public-highlights` bucket. It never queries private scouting reports, signs private video URLs, or reads the War Room bucket. That bucket remains private.

## Prepare a goal

Use a downloaded recording with a verified game ID and source timestamp:

```sh
python scripts/prepare-lgchl-highlight.py --source /path/game.mp4 --game-id 918286 --start 430 --duration 20 --title 'Goal highlight' --source-url https://www.twitch.tv/videos/SOURCE_ID --output /path/review-goal
```

The example timestamp is illustrative, not a verified goal. FFmpeg creates an H.264/AAC MP4 with faststart, a JPG poster and a draft JSON registry row. The helper has no network access or upload behavior. It refuses to overwrite output files.

## Publish a reviewed clip

1. Watch the output and confirm game, player identities, score/event and permission to publish the source.
2. Upload the reviewed MP4 and poster to the exact paths from the JSON in `lgchl-public-highlights` using an administrator connection. Objects in this dedicated bucket are public immediately; do not upload drafts or private files.
3. Insert the JSON record into `lgchl_game_highlights`, setting `verified_at` and `published_at` only after review. Optionally add period, clock label and official LG user IDs. Client roles cannot insert/update/delete these records or upload to this bucket.
4. Open `lgchl-game.html?id=GAME_ID` and verify playback. Set `published_at` to NULL to hide the listing; deleting the storage object is also required to retract its public URL.

No clips were imported automatically. Existing private clips require a separately reviewed public copy. No goal scorer, sequence or turning point is inferred from final scores alone. The initial recap is explicitly a result summary, with a link to the official box score.

## Hockey cards

Media Desk, leaderboard quick views and full player pages share the collectible card renderer. The card links to the existing `player-cards.html` studio using official LG ID, league and player kind. No inferred overall rating or user-private portrait is displayed publicly. The current dated verified capture overrides older leaderboard records when that player is present. The builder preserves requested players beyond the initial 500-option list.

## Checks

`node --test tests/lgchl-highlights.test.cjs` validates identity links, unsafe clip paths, unpublished/wrong-game/future records, factual summaries and feed outages. The FFmpeg helper was exercised with a synthetic one-second video; that test footage was not uploaded.
