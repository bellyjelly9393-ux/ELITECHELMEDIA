# ECM article + scouting narration (draft)

This feature adds optional **Listen to recap** and **Listen to scouting report** controls.
It deliberately does not alter Hitmen Radio, produce synthetic voices, upload the reference clips, or publish any reports.

## Public content

Narration is enabled per item **only** after an editor adds a reviewed MP3 under `assets/narration/` and marks it approved.

LGCHL Night in Review: attach to the corresponding game object in `assets/lgchl-recaps/<date>.json`.
LGCHL weekly features: attach to an item in `assets/lgchl-writeups/writeups.json`.
Published Hitmen recap articles: attach under `media_posts.source_metrics.narration`.

Example:

```json
{
  "narration": {
    "approved": true,
    "src": "assets/narration/recaps/2026-11-08-918575.mp3",
    "voice_label": "ECM Original Analyst"
  }
}
```

The user sees no player when `approved` is missing/false, the MP3 is missing, or `src` is outside the approved same-origin directory.
An approved audio entry must match the published article facts and be listened to by an editor first.
Publication in a **public GitHub repo** makes public MP3 files accessible to everyone. Never put private audio or the supplied third-party celebrity-style sample clips there without explicit rights and publication approval.

## Private Hitmen scouting reports

On the existing gated `hitmen-scouting-report.html`, the frontend can request a short-lived signed MP3 URL via Supabase Storage.
The report must already be accessible to the logged-in Hitmen team member.
The report's `evidence_summary` can carry:

```json
{
  "narration": {
    "approved": true,
    "storage_path": "s55/<report-uuid>.mp3",
    "voice_label": "ECM Scouting Analyst"
  }
}
```

The frontend expects a **private** Supabase Storage bucket named `hitmen-report-narration`.
This bucket is **not created by this PR**. Set it up separately with storage RLS policies that require the same verified team access as report reads, and restrict uploads to authorized staff. Do not create a public bucket or assume a frontend check replaces Storage authorization. Verify policy by testing a team member, logged-out client, and unrelated account before connecting real scouting audio.

Signed URLs expire after 600 seconds, but signed links can be shared until expiry; private media access cannot be made truly copy-proof.

## Voice rights and publishing

The two user-supplied ChelScout files are examples only. Their file metadata does not identify the synthesis provider or establish permission to create new speech or publicly redistribute the audio. Do not upload, regenerate, or publish them using this feature without necessary rights.
If a narrator's voice resembles an identifiable real person, obtain authorization before generating or monetizing new readings in that voice; otherwise use licensed, original hockey-commentator voices.
AI-generated narration is labeled as such in the player.

## Next phase (not implemented)

Add authenticated editorial upload + review/approval UI, a licensed TTS provider, narration generation from final fact-checked copy, playback QA, and a single publish step that links the MP3 to the immutable article/report version. When the article changes, invalidate its old audio approval rather than presenting an out-of-date narration as current.
