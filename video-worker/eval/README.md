# Offline accuracy eval (no AI calls)

`python video-worker/eval/run_hud_eval.py --vod <path to the Lethbridge 480p VOD> --benchmark <benchmark-001 dir>`

* Runs the deterministic HUD reader on the recording (local FFmpeg + Tesseract only).
* `lethbridge_hud_labels.csv`: 48 timestamps (seeded random sample of abs 397-1731, every
  second sample point) hand-labelled from zoomed score-bug crops: HUD visible?, score,
  clock, power-play row. Blank = not labelled (ambiguous to the labeller).
* Compares goals / power plays / period faceoffs / final score to the audited timeline
  (`audit_lethbridge_2026-10-13_timestamps.md`).
* Re-checks the saved benchmark model answers (`results/raw/*/*.json`, already paid for)
  against the HUD timeline and reports how many of the scored hallucinations the
  validators would have caught.
