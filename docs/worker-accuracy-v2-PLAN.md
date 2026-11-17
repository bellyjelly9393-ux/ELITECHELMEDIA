# VOD worker accuracy v2: plan and status

Branch `feature/worker-accuracy-v2`, based on `feature/video-review-worker`. Every new behaviour is behind a flag that defaults to OFF, so merging this changes no spend and no prompts.

## Current flow (before this branch)
- Uploads go through `process()`: `detect_periods` (Tesseract on 1/10 fps frames) then `needs_periods` confirmation. After that come 120 s chunks at a 6 s frame step, sent to `analyze()` on the basic model (`VOD_MODEL_BASIC`, Gemini Flash). Then `review_sequences` gives closer looks, and the period and game rollups run on the deep model.
- Twitch replays go through `process_streamed_replay`. `live_periods.scan_recording_periods` OCR locks P1/P2/P3, then `analyze_period_part` runs for each period.
- Deep model = **Gemini 4 Argon**: `VOD_MODEL_DEEP=gemini/gemini-4-argon`.
  - It uses the key in env var `GEMINI_DEEP_API_KEY` (`gemini_api_key()` in worker.py) and falls back to `GEMINI_API_KEY` when that is unset.
  - It uses the Agent Platform when the key starts with `AQ.`, or when `GEMINI_DEEP_PLATFORM=agent`.
  - `GEMINI_DEEP_THINKING` sets the thinking level.
  - Values live in Railway. I did not read them.

## Changes
1. `hud_reader.py` + `game_state.py`: a deterministic score-bug reader with no AI.
   - It reads glyph signatures for the scores and Tesseract for the clock, PP banner and abbreviations.
   - It builds a timeline: goals from score-row changes, PP team from the banner's row, and period faceoffs from the 20:00 clock.
   - Validators flag or reject model goal, PP and score claims that conflict with the HUD.
2. `roster.py`: roster sheet in the prompt, plus a post-filter for player names.
   - Our lineup comes from the existing `players` metadata.
   - The optional `opponent_players`, `roster_aliases` and `roster_sheet` come per game in the job metadata.
3. `VOD_HUD_PERIODS`: proposes period boundaries for uploads. Management still confirms them.
4. `accuracy.py`: routing and escalation.
   - The premium reviewer defaults to the existing `VOD_MODEL_DEEP` (Argon).
   - Optional DeepSeek cross-check.
   - Optional GPT-6 Astra spot-check slot: frames only, goals and penalties, Hitmen games only, with its own call and dollar caps.
   - Disagreements are marked `needs_human_review`.
   - Cost logging and a per-game cap.
5. `corrections.py`: few-shot examples from job metadata or a local JSONL file.
   - The durable table is a DRAFT only: `docs/sql/20261018_vod_ai_corrections_DRAFT.sql`. It is not applied.

## Not done
- The streamed-replay path does not use HUD period proposals. It keeps its existing scanner.
- No UI changes. Postgame Desk does not yet send opponent rosters or corrections, and does not display key moments.
- The roster filter and escalation have not been run on a real game. Those need paid calls.
