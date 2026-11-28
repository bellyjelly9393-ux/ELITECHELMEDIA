# Live Hub · This Week board

`elite-live-hub-week.js` draws one box per Memorial Cup series and one per World Juniors and
LG Threes game on `elite-live-hub.html#week`.

| Event | Source | Updates |
| --- | --- | --- |
| Memorial Cup | `/api/lgchl-playoffs` (current round; pending sides filled from the previous round's winners) | Every 2 minutes |
| World Juniors | `data/live/wjhc-week.json` (all 8 nations, read from LG team schedule pages, league 77, season 33) | Replace the file each week |
| LG Threes | Supabase view `lg3s_public_games`, next 7 days | Every 2 minutes |

Times are Eastern. LG lists World Juniors games in EST (UTC-5).

## Game night: adding a stream link

Add a public row to `tournament_automation_sources`. The hub turns it into a channel, and the
matching box shows **Watch** and **+ Multi**:

```sql
insert into public.tournament_automation_sources
  (event_id, source_type, provider, url, active, public_visible, display_label, metadata)
values
  ((select id from public.esports_events where slug = 'calgary-hitmen-lgchl-s55'),
   'stream', 'twitch', 'https://www.twitch.tv/CHANNEL', true, true, 'Czechia vs Canada',
   '{"league": "World Juniors", "lg_game_id": 923956, "game_night": "2026-11-29"}');
```

`event_id` is required. Until World Juniors, LG3s and Memorial Cup have their own rows in
`esports_events`, game-night links sit under the LGCHL Season 55 event as above.

- One game: `"lg_game_id": 923956`. Several games on one stream: `"lg_game_ids": [923956, 923960]`.
- A whole Memorial Cup series: `"series_key": "377-413"` (the two LGCHL team IDs, any order).
- `league` must say `World Juniors`, `LG3s` or `LGCHL` / `Memorial Cup` so the channel is listed.
- Set `active = false` after the game to take the link down.
