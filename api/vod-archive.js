import { supabaseRest } from "./_mux.js";
import { presignGet } from "./_s3presign.js";

// Staff-only VOD archive. Row access is enforced by Supabase RLS on vod_archive_files
// (is_vvhl_staff() or team management): the caller's own JWT is used, so a non-staff
// user gets zero rows and therefore can never obtain a download link.
const COLUMNS = "id,twitch_vod_id,streamer,game_date,teams,team_id,review_session_id,file_name,bytes,duration_seconds,sha256,verified_at,uploaded_at";

function storageConfig() {
  const c = {
    endpoint: process.env.VOD_ARCHIVE_S3_ENDPOINT,
    bucket: process.env.VOD_ARCHIVE_S3_BUCKET,
    accessKeyId: process.env.VOD_ARCHIVE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.VOD_ARCHIVE_S3_SECRET_ACCESS_KEY,
    region: process.env.VOD_ARCHIVE_S3_REGION || "auto",
  };
  return c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey ? c : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const id = String(req.query?.download || "").trim();
    if (!id) {
      const rows = await supabaseRest(req, `/rest/v1/vod_archive_files?select=${COLUMNS}&order=game_date.desc.nullslast,uploaded_at.desc&limit=1000`);
      return res.status(200).json({ files: rows || [], downloadsEnabled: Boolean(storageConfig()) });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid file id" });
    const rows = await supabaseRest(req, `/rest/v1/vod_archive_files?id=eq.${id}&select=id,file_name,bucket_key`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return res.status(404).json({ error: "Archive file not found or not authorized" });
    const cfg = storageConfig();
    if (!cfg) return res.status(503).json({ error: "Archive storage is not configured" });
    const expiresIn = 900;
    const url = presignGet({ ...cfg, key: row.bucket_key, filename: row.file_name, expiresIn });
    return res.status(200).json({ url, expiresIn });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Archive request failed" });
  }
}
