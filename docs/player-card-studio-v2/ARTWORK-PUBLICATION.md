# Artwork preparation, review and publication

Players submit an image plus explicit permission for its public display after manager approval. The browser prepares a cutout using U2NetP in a Web Worker, preserves transparency, trims empty borders, and retains the original privately. The worker has a 60-second deadline; download or inference failures retain the original and mark the submission `original-fallback`. The player must keep the page open until submission completes. This is not a background chat task or an unattended server job.

The hidden Management artwork queue refreshes every 30 seconds while visible and idle. Reviewers open the actual card renderer, compare prepared/original images, adjust scale/position/finish, and explicitly approve and publish. Only the existing trusted manager allowlist can publish. Private uploads do not verify the submitter owns the named player: reviewers must check the association. Earlier submissions without explicit publication consent must be resubmitted.

Publication stores only the immutable selected object and whitelisted appearance settings. It never accepts player statistics or OVR. The full card page, reached through team stalls and leaderboard profiles, loads the approved artwork and latest available season data. Personal edits stay private. Public visitors cannot read pending submissions or unselected originals. Rejecting/revoking an approved submission removes the publication atomically. Previously issued image links may remain valid until their five-minute expiry; already downloaded images cannot be recalled.

## Dependencies

- ONNX Runtime Web 1.20.1 (MIT): https://github.com/microsoft/onnxruntime/tree/v1.20.1
- U2NetP, U²-Net authors Xuebin Qin et al. (Apache-2.0): https://github.com/xuebinqin/U-2-Net ; license https://github.com/xuebinqin/U-2-Net/blob/master/LICENSE
- ONNX export mirrored from rembg at https://huggingface.co/edgetools/u2netp/tree/25dee37ab19c5b6ad64ba6578eba63f1ae07720c ; verified SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` before inference.
- The runtime and model download from CDN/Hugging Face; player image pixels remain on device during inference. No external paid image-processing API is used. Hosting/storage/network charges remain governed by the existing hosting plans.

## Verification

The actual submitted Setty screenshot was processed in browser in approximately 11.7 seconds. The output retained the player and stick; small background remnants and edge halos still require manager judgement. This is not a guarantee for every screenshot or phone.

Database transaction tests verify private prepared/original uploads, owner isolation, manager-only publication, source selection, whitelisted placement, no manual OVR, anonymous access only after approval, unselected original privacy, stale decisions, immutable objects, replacement review, consent and revocation. All fixture records roll back. Frontend review interactions are tested with a local QA account fixture; live signed-in human approval is intentionally not performed on a real submission by the agent.
