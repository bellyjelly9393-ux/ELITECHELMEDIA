// Authenticated LeagueGaming browser bridge. Isolated from the scheduled cloud scraper.
// Only verified stats enter the existing stability-window state machine.
// No raw HTML, session cookies, or browser credentials are stored.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildPayload, sha256, urls, ParseError } from "./lib.ts";

const ORIGIN = "https://wildmanhockey-elitechelmedia.app";
const json = (req: Request, body: unknown, status = 200) => {
  const origin = req.headers.get("origin");
  return new Response(JSON.stringify(body), {
    status, headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": origin === ORIGIN ? ORIGIN : "",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, x-client-info, content-type",
      "vary": "Origin"
    }
  });
};
const fail = (req: Request, status: number, error: string) => json(req, { ok: false, error }, status);
const supportedUrl = (raw: unknown) => {
  if (typeof raw !== "string") throw new Error("Missing LeagueGaming source URL.");
  const u = new URL(raw);
  if (u.protocol !== "https:" || !["leaguegaming.com", "www.leaguegaming.com"].includes(u.hostname) ||
      u.pathname !== "/forums/index.php" || u.searchParams.get("page") !== "game" ||
      u.searchParams.get("action") !== "league") throw new Error("Only official LeagueGaming game pages are accepted.");
  const gameId = Number(u.searchParams.get("gameid"));
  if (!Number.isSafeInteger(gameId) || gameId < 921000 || gameId >= 930000) throw new Error("Invalid LG3S game ID.");
  return gameId;
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, {ok:true});
  if (req.method !== "POST") return fail(req, 405, "Use POST.");
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "")?.[1];
  if (!bearer) return fail(req, 401, "Elitechel sign-in required.");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: auth, error: authError } = await db.auth.getUser(bearer);
  if (authError || !auth.user) return fail(req, 401, "Invalid Elitechel session.");
  const {data: profile, error: profileError} = await db.from("profiles").select("role").eq("id",auth.user.id).maybeSingle();
  if (profileError) return fail(req, 503, "Could not check access.");
  if (!["admin","commissioner"].includes(String(profile?.role || "").toLowerCase()))
    return fail(req, 403, "Elitechel admin or commissioner access required.");

  const rawBody = await req.text();
  if (rawBody.length > 1_500_000) return fail(req, 413, "Capture exceeds 1.5 MB.");
  let input: {sourceUrl?:string, html?:string};
  try { input = JSON.parse(rawBody); } catch { return fail(req, 400, "Malformed capture JSON."); }
  if ((input as {action?:string}).action === "pending") {
    const now = Date.now();
    const from = new Date(now - 14 * 86400000).toISOString();
    const to = new Date(now + 15 * 60000).toISOString();
    const rows = await db.from("lg3s_games")
      .select("lg_game_id,scheduled_at,last_fetched_at,status,verification_status")
      .gte("scheduled_at", from).lte("scheduled_at",to)
      .not("verification_status","in","(verified,corrected)")
      .not("status","in","(postponed,cancelled)")
      .order("scheduled_at",{ascending:false}).limit(100);
    if (rows.error) return fail(req,503,"Could not read pending LG3S games.");
    const games = (rows.data || []).sort((a,b)=>
      String(a.last_fetched_at || "").localeCompare(String(b.last_fetched_at || "")) ||
      String(b.scheduled_at).localeCompare(String(a.scheduled_at))
    ).slice(0,40);
    return json(req,{ok:true,action:"pending",pending:games.map(g=>({
      gameId:g.lg_game_id,scheduledAt:g.scheduled_at,lastFetchedAt:g.last_fetched_at,
      status:g.status,verificationStatus:g.verification_status
    }))});
  }
  let id: number;
  try { id = supportedUrl(input.sourceUrl); } catch(e) { return fail(req, 400, String((e as Error).message)); }
  const html = input.html;
  if (typeof html !== "string" || html.length < 2000 || html.length > 1_400_000)
    return fail(req, 422, "Missing or truncated LeagueGaming game HTML.");
  if (/<(?:script|input|textarea|iframe|form)\b|(?:auth|csrf|token|password)\s*=/i.test(html))
    return fail(req, 422, "Capture contains form or session fields. Run the sanitized browser collector.");

  const {data: game, error: dbError} = await db.from("lg3s_games")
    .select("lg_game_id,away_lg_team_id,home_lg_team_id,scheduled_at,verification_status")
    .eq("lg_game_id", id).maybeSingle();
  if (dbError) return fail(req, 503, "Could not check the official LG3S schedule.");
  if (!game) return fail(req, 422, "Game is not in the stored LG3S schedule; capture the schedule first.");
  let built;
  try {
    built = await buildPayload(html, id);
  } catch(e) {
    return fail(req, 422, e instanceof ParseError ? "LG page rejected: "+e.code : "Could not parse the source game.");
  }
  const {parsed, verification, payload} = built;
  if (parsed.away_lg_team_id !== game.away_lg_team_id || parsed.home_lg_team_id !== game.home_lg_team_id)
    return fail(req, 422, "LG page matchup conflicts with stored schedule.");
  if (parsed.scheduled_at && game.scheduled_at &&
      Math.abs(Date.parse(parsed.scheduled_at) - Date.parse(game.scheduled_at)) > 24*60*60*1000)
    return fail(req, 422, "LG game date conflicts with stored schedule.");
  if (!parsed.is_final || !verification.passed)
    return json(req, { ok:false, gameId:id, action:"needs_review",
      error:"Not a complete and consistent final box score. Nothing was imported.",
      failedChecks: verification.checks.filter(c=>c.blocking && !c.ok).map(c=>c.id),
      flags: verification.flags }, 422);

  // An accepted snapshot holds only hashes and provenance, never the captured HTML.
  const source = urls.game(id);
  const digest = await sha256(html);
  const snap = await db.from("lg3s_source_snapshots").insert({
    kind:"browser_game",source_id:String(id),url:source,
    http_status:200,sha256:digest,payload_hash:verification.payload_hash,bytes:html.length
  }).select("id").single();
  if (snap.error || !snap.data) return fail(req, 503, "Source evidence could not be recorded.");
  const applied = await db.rpc("lg3s_ingest_game", {p:{...payload,snapshot_id:snap.data.id}});
  if (applied.error) return fail(req, 503, "Game validation was not committed.");
  return json(req, {ok:true,gameId:id,action:applied.data?.action,status:applied.data?.status,
    stable:applied.data?.status==="verified"||applied.data?.status==="corrected",
    flags:verification.flags,source:"authenticated_browser",needsSecondPass:applied.data?.action==="provisional"||applied.data?.action==="correction_pending"});
});