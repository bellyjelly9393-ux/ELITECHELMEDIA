// AUTO-BUNDLED from parse.ts, verify.ts, fetcher.ts, core.ts (lg3s-build). Do not edit; edit sources.
// ---- parse.ts
// LG3S (LeagueGaming leagueid=154) public HTML parsers. Pure functions, no I/O.
// Attribution rule: every player/goalie line is credited to the team shown IN THAT GAME's
// box score (team_bar section + row crest), never via roster lookup.
export const LEAGUE_ID = 154;
export const SEASON_ID = 1;
export const LG_TZ = "America/New_York"; // verified: EA submit stamps ~25 min after listed start

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const clean = (s: unknown) =>
  String(s ?? "").replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(parseInt(e.slice(e[1].toLowerCase() === "x" ? 2 : 1), e[1].toLowerCase() === "x" ? 16 : 10)) : ENT[e.toLowerCase()] ?? m)
    .replace(/\s+/g, " ").trim();
const int = (s: string): number | null => { const t = clean(s).replace(/,/g, "").replace(/^\+/, ""); return /^-?\d+$/.test(t) ? Number(t) : null; };
const num = (s: string): number | null => { const t = clean(s).replace(/[,%]/g, ""); return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null; };
const mmss = (s: string): number | null => { const m = /^(\d+):([0-5]\d)$/.exec(clean(s)); return m ? +m[1] * 60 + +m[2] : null; };

type Cell = { html: string; tag: string };
type Table = { rows: { cls: string; cells: Cell[] }[]; html: string };
export function tables(html: string): Table[] {
  const out: Table[] = []; const stack: Table[] = [];
  const src = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  let cell: Cell | null = null;
  for (const tok of src.match(/<[^>]+>|[^<]+/g) || []) {
    const cur = stack[stack.length - 1];
    if (/^<table\b/i.test(tok)) { if (cell) cell.html += tok; stack.push({ rows: [], html: "" }); cell = null; continue; }
    if (/^<\/table/i.test(tok)) { const t = stack.pop(); if (t) out.push(t); cell = null; continue; }
    if (!cur) continue;
    cur.html += tok;
    if (stack.length > 1) { /* nested */ }
    let m;
    if ((m = /^<tr\b([^>]*)>/i.exec(tok))) { cur.rows.push({ cls: (/class\s*=\s*"([^"]*)"/i.exec(m[1])?.[1] ?? "").trim(), cells: [] }); cell = null; continue; }
    if (/^<\/tr/i.test(tok)) { cell = null; continue; }
    if ((m = /^<(td|th)\b/i.exec(tok))) { if (!cur.rows.length) cur.rows.push({ cls: "", cells: [] }); cell = { html: tok, tag: m[1].toLowerCase() }; cur.rows[cur.rows.length - 1].cells.push(cell); continue; }
    if (/^<\/(td|th)/i.test(tok)) { cell = null; continue; }
    if (cell) cell.html += tok;
  }
  return out;
}

/** Convert LG wall-clock (Eastern) to a UTC ISO string, DST-safe. */
export function etToUtc(y: number, mo: number, d: number, h: number, mi: number): string {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: LG_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - t;
  };
  let t = guess - off(guess); t = guess - off(t);
  return new Date(t).toISOString();
}
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const to24 = (h: number, ap: string) => (ap.toLowerCase() === "pm" ? (h % 12) + 12 : h % 12);
/** Season 1 starts Oct 2026; Jan–Aug dates belong to 2027. */
export const seasonYear = (month: number, startYear = 2026) => (month >= 9 ? startYear : startYear + 1);

export class ParseError extends Error { constructor(public code: string, msg: string) { super(msg); } }

export function assertRealPage(html: string) {
  if (!html || html.length < 2000) throw new ParseError("empty", "Empty or truncated page");
  if (/<title>\s*(Just a moment|Attention Required)|_cf_chl_opt|cf-mitigated/i.test(html) && !/leaguepage|Regular Season|team_box_icon/.test(html)) throw new ParseError("challenge", "Cloudflare challenge page");
  if (/name=["']password/i.test(html) && !/Player Stats|Goalie Stats|Regular Season/i.test(html)) throw new ParseError("login", "Login wall");
}

// ---------------- schedule ----------------
export type ScheduledGame = { lg_game_id: number; away_lg_team_id: number; home_lg_team_id: number; scheduled_at: string; et_label: string; listed_score: [number, number] | null };
export function parseSchedule(html: string, startYear = 2026): ScheduledGame[] {
  assertRealPage(html);
  if (!/leagueid=154/.test(html)) throw new ParseError("wrong_league", "Not an LG3S page");
  const out = new Map<number, ScheduledGame>();
  for (const t of tables(html)) for (const r of t.rows) {
    const h = r.cells.map((c) => c.html).join(" ");
    const g = /page=game&(?:amp;)?gameid=(\d+)/.exec(h); if (!g) continue;
    const teams = [...h.matchAll(/teamid=(\d+)&(?:amp;)?leagueid=154/g)].map((m) => +m[1]);
    const dm = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w* (\w{3}) (\d{1,2}) (\d{1,2}):(\d\d)\s*([ap]m)/i.exec(clean(h));
    if (teams.length !== 2 || !dm) throw new ParseError("schedule_row", `Unrecognized schedule row for game ${g[1]}`);
    const mo = MONTHS.indexOf(dm[2].toLowerCase()) + 1;
    const sc = /(\d+)\s+vs\s+(\d+)/.exec(clean(h));
    out.set(+g[1], { lg_game_id: +g[1], away_lg_team_id: teams[0], home_lg_team_id: teams[1], et_label: dm[0],
      scheduled_at: etToUtc(seasonYear(mo, startYear), mo, +dm[3], to24(+dm[4], dm[6]), +dm[5]), listed_score: sc ? [+sc[1], +sc[2]] : null });
  }
  return [...out.values()].sort((a, b) => a.lg_game_id - b.lg_game_id);
}

// ---------------- standings ----------------
export type StandingRow = { group: string; rank: number; lg_team_id: number; gp: number; w: number; l: number; otw: number; otl: number; pts: number; streak: string; gf: number; ga: number; gd: number; forfeit: boolean };
export function parseStandings(html: string): StandingRow[] {
  assertRealPage(html);
  const out: StandingRow[] = [];
  for (const t of tables(html)) {
    const grp = /Group\s+([A-Z])/.exec(clean(t.rows[0]?.cells[0]?.html ?? ""))?.[1]; if (!grp) continue;
    const hdr = t.rows[1]?.cells.map((c) => clean(c.html)) ?? [];
    const want = ["GP", "W", "L", "OTW", "OTL", "PTS", "STK", "F", "A", "GD"];
    if (want.some((k, i) => hdr[i] !== k)) continue; // other group-labelled widgets on the page
    for (const r of t.rows.slice(2)) {
      const id = /teamid=(\d+)/.exec(r.cells[0]?.html ?? "")?.[1]; if (!id) continue;
      const v = r.cells.slice(1).map((c) => clean(c.html));
      out.push({ group: grp, rank: int(/(\d+)\)/.exec(clean(r.cells[0].html))?.[1] ?? "") ?? 0, lg_team_id: +id, gp: +v[0], w: +v[1], l: +v[2], otw: +v[3], otl: +v[4], pts: +v[5], streak: v[6], gf: +v[7], ga: +v[8], gd: +v[9], forfeit: /ff_team/.test(r.cells[0].html) });
    }
  }
  if (out.length !== 12 || new Set(out.map((r) => r.lg_team_id)).size !== 12) throw new ParseError("standings_layout", `Expected 12 unique teams, got ${out.length}`);
  return out;
}

// ---------------- game ----------------
export type SkaterLine = { kind: "skater"; lg_user_id: number | null; gamertag: string; position: string | null; lg_team_id: number; crest_team_id: number | null;
  g: number; a: number; p: number; plus_minus: number | null; toi_s: number | null; shots: number | null; shot_attempts: number | null; hits: number | null; takeaways: number | null; giveaways: number | null; blocks: number | null; interceptions: number | null; pim_s: number | null; pass_pct: number | null; flags: string[] };
export type GoalieLine = { kind: "goalie"; lg_user_id: number | null; gamertag: string; position: "G"; lg_team_id: number | null; crest_team_id: number | null;
  shots_against: number; save_pct: number | null; goals_against: number; saves: number; gaa: number | null; flags: string[] };
export type ParsedGame = {
  lg_game_id: number; status_text: string; is_final: boolean; away_lg_team_id: number; home_lg_team_id: number;
  away_score: number | null; home_score: number | null; scheduled_at: string | null; et_label: string | null;
  periods: { lg_team_id: number; goals: number[] }[]; team_stats: Record<number, Record<string, number | string | null>>;
  skaters: SkaterLine[]; goalies: GoalieLine[]; ea_results: { periods: string; submitted_by: string; submitted_et: string }[]; parse_warnings: string[];
};

export function parseGame(html: string, expectedId: number): ParsedGame {
  assertRealPage(html);
  const W: string[] = [];
  const ids = new Set([...html.matchAll(/gameid=(\d+)/g)].map((m) => +m[1]));
  if (!ids.has(expectedId)) throw new ParseError("identity", `Page does not reference game ${expectedId}`);
  if (!/leagueid=154/.test(html)) throw new ParseError("wrong_league", "Not an LG3S page");
  const head = /lg_main_header_total_row[\s\S]*?(?=<div class="row lg_main_header_total_row|<table)/.exec(html)?.[0];
  if (!head) throw new ParseError("header", "Game header not found");
  const hTeams = [...head.matchAll(/teamid=(\d+)&(?:amp;)?leagueid=154/g)].map((m) => +m[1]);
  if (hTeams.length < 2) throw new ParseError("header", "Header team ids missing");
  const [away, home] = [hTeams[0], hTeams[hTeams.length - 1]];
  const scores = [...head.matchAll(/class="lg_game_header">\s*(\d*)\s*</g)].map((m) => (m[1] === "" ? null : +m[1]));
  const status = clean(/font-size:40px;?">([^<]*)</.exec(head)?.[1] ?? "");
  const dt = /([A-Z][a-z]+day) ([A-Z][a-z]+) (\d{1,2})\w\w (\d{4}), (\d\d):(\d\d) ([AP]M)/.exec(clean(head));
  const scheduled_at = dt ? etToUtc(+dt[4], MONTHS.indexOf(dt[2].slice(0, 3).toLowerCase()) + 1, +dt[3], to24(+dt[5], dt[7]), +dt[6]) : null;
  const g: ParsedGame = { lg_game_id: expectedId, status_text: status, is_final: /^(FINAL|F\/(?:\d*OT|SO))\b/i.test(status), away_lg_team_id: away, home_lg_team_id: home,
    away_score: scores[0] ?? null, home_score: scores[1] ?? null, scheduled_at, et_label: dt?.[0] ?? null, periods: [], team_stats: { [away]: {}, [home]: {} }, skaters: [], goalies: [], ea_results: [], parse_warnings: W };
  const sides = [away, home];
  for (const t of tables(html)) {
    const title = clean(t.rows[0]?.cells[0]?.html ?? "");
    if (/^Period Stats/i.test(title)) {
      for (const r of t.rows) {
        const id = /teamid=(\d+)/.exec(r.cells[0]?.html ?? "")?.[1];
        if (id && sides.includes(+id)) g.periods.push({ lg_team_id: +id, goals: r.cells.slice(1).map((c) => int(c.html) ?? NaN) });
      }
    } else if (t.rows.some((r) => r.cells.length === 3 && /^Goals$/i.test(clean(r.cells[1].html)))) {
      for (const r of t.rows) if (r.cells.length === 3) {
        const k = clean(r.cells[1].html).toLowerCase().replace(/[^a-z]/g, "_"); if (!k) continue;
        [0, 2].forEach((i, j) => { const raw = clean(r.cells[i].html); g.team_stats[sides[j]][k] = /^\d+$/.test(raw) ? +raw : raw; });
      }
    } else if (/^Player Stats/i.test(title)) {
      const hdrRow = t.rows.find((r) => r.cls.includes("alt2"));
      const labels = (hdrRow?.cells ?? []).filter((c) => c.tag === "th").map((c) => clean(c.html)).slice(1); // after "Players"
      const need = ["G", "A", "P", "+/-", "TOI", "Shots"]; if (need.some((k) => !labels.includes(k))) throw new ParseError("skater_layout", "Skater header changed: " + labels.join(","));
      let team: number | null = null;
      for (const r of t.rows) {
        const bar = /team_bar(\d+)/.exec(r.cells[0]?.html ?? ""); if (bar) { team = +bar[1]; if (!sides.includes(team)) throw new ParseError("skater_team", `Section team ${team} not in game`); continue; }
        if (r === hdrRow || r.cells.length < 3 + need.length) continue;
        const nameCell = r.cells[2].html;
        const uid = /page=team_user&(?:amp;)?userid=(\d+)/.exec(nameCell)?.[1] ?? /userid=(\d+)/.exec(r.cells[0].html)?.[1];
        const tag = clean(/<a[^>]*team_user[^>]*>([\s\S]*?)<\/a>/.exec(nameCell)?.[1] ?? "") || clean(nameCell).replace(/\(.*$/, "").trim();
        const crest = /team\/p16\/team(\d+)\./.exec(nameCell)?.[1];
        const v = (k: string) => r.cells[3 + labels.indexOf(k)]?.html ?? "";
        if (team == null) throw new ParseError("skater_team", "Skater row before any team section");
        const flags: string[] = [];
        if (!uid) flags.push("missing_lg_user_id");
        if (crest && +crest !== team) flags.push(`crest_team_mismatch:${crest}`);
        const [sog, att] = clean(v("Shots")).split("/").map((x) => int(x));
        const line: SkaterLine = { kind: "skater", lg_user_id: uid ? +uid : null, gamertag: tag, position: /\((LW|C|RW|LD|RD|D|W)\)/.exec(clean(nameCell))?.[1] ?? null, lg_team_id: team, crest_team_id: crest ? +crest : null,
          g: int(v("G")) ?? NaN, a: int(v("A")) ?? NaN, p: int(v("P")) ?? NaN, plus_minus: int(v("+/-")), toi_s: mmss(v("TOI")), shots: sog ?? null, shot_attempts: att ?? null,
          hits: int(v("H")), takeaways: int(v("TA")), giveaways: int(v("GA")), blocks: int(v("BK")), interceptions: int(v("INT")), pim_s: mmss(v("PIM")), pass_pct: num(v("PAS%")), flags };
        g.skaters.push(line);
      }
    } else if (/^Goalie Stats/i.test(title)) {
      const hdrRow = t.rows.find((r) => r.cls.includes("alt2"));
      const labels = (hdrRow?.cells ?? []).map((c) => clean(c.html)).slice(1);
      const need = ["S", "Sv%", "GA", "Sv", "GAA"]; if (need.some((k) => !labels.includes(k))) throw new ParseError("goalie_layout", "Goalie header changed: " + labels.join(","));
      for (const r of t.rows) {
        if (r === hdrRow || r.cells.length < 3 + need.length) continue;
        const nameCell = r.cells[2].html;
        const uid = /page=team_user&(?:amp;)?userid=(\d+)/.exec(nameCell)?.[1];
        const crest = /team\/p16\/team(\d+)\./.exec(nameCell)?.[1];
        const v = (k: string) => r.cells[3 + labels.indexOf(k)]?.html ?? "";
        const flags: string[] = []; if (!uid) flags.push("missing_lg_user_id");
        const team = crest && sides.includes(+crest) ? +crest : null; if (team == null) flags.push("goalie_team_unresolved");
        g.goalies.push({ kind: "goalie", lg_user_id: uid ? +uid : null, gamertag: clean(/<a[^>]*team_user[^>]*>([\s\S]*?)<\/a>/.exec(nameCell)?.[1] ?? ""), position: "G", lg_team_id: team, crest_team_id: crest ? +crest : null,
          shots_against: int(v("S")) ?? NaN, save_pct: num(v("Sv%")), goals_against: int(v("GA")) ?? NaN, saves: int(v("Sv")) ?? NaN, gaa: num(v("GAA")), flags });
      }
    } else if (/^EA Sports API Results/i.test(title)) {
      for (const r of t.rows) if (r.cells.length === 4 && /load_api_game/.test(r.cells[0].html)) g.ea_results.push({ periods: clean(r.cells[1].html), submitted_by: clean(r.cells[2].html), submitted_et: clean(r.cells[3].html) });
    }
  }
  if (g.is_final && !g.skaters.length) W.push("final_without_player_table");
  return g;
}
// ---- verify.ts
// Integrity checks for one parsed LG3S game. Pure; the DB RPC enforces the state machine.

export const PLACEHOLDER_USER_IDS = new Set([1]); // LG system account "LG" (observed 921540, ECU badge)
export type Check = { id: string; ok: boolean; blocking: boolean; detail: string };
export type Verification = { checks: Check[]; passed: boolean; flags: string[]; decided_in: "REG" | "OT" | "SO" | null; payload_hash: string; canonical: unknown };

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Canonical, ordering-stable payload; hash of this (not raw HTML) drives the stability window. */
export function canonical(g: ParsedGame) {
  const sk = [...g.skaters].sort((a, b) => (a.lg_team_id - b.lg_team_id) || ((a.lg_user_id ?? 0) - (b.lg_user_id ?? 0)) || a.gamertag.localeCompare(b.gamertag));
  const gl = [...g.goalies].sort((a, b) => ((a.lg_team_id ?? 0) - (b.lg_team_id ?? 0)) || ((a.lg_user_id ?? 0) - (b.lg_user_id ?? 0)));
  return { id: g.lg_game_id, st: g.status_text, a: g.away_lg_team_id, h: g.home_lg_team_id, as: g.away_score, hs: g.home_score, at: g.scheduled_at,
    p: g.periods.map((p) => [p.lg_team_id, p.goals]), sk: sk.map((s) => [s.lg_team_id, s.lg_user_id, s.gamertag, s.position, s.g, s.a, s.p, s.plus_minus, s.shots, s.toi_s, s.hits]),
    gl: gl.map((x) => [x.lg_team_id, x.lg_user_id, x.gamertag, x.shots_against, x.goals_against, x.saves]) };
}

export async function verifyGame(g: ParsedGame, opts: { rosterUserIds?: Set<number>; expectedTeams?: [number, number] } = {}): Promise<Verification> {
  const C: Check[] = []; const F: string[] = [];
  const add = (id: string, ok: boolean, detail: string, blocking = true) => C.push({ id, ok, blocking, detail });
  const sides = [g.away_lg_team_id, g.home_lg_team_id]; const score = [g.away_score, g.home_score];

  add("status_final", g.is_final, `status="${g.status_text}"`);
  add("scores_present", score.every((s) => Number.isInteger(s)), `score=${score.join("-")}`);
  if (opts.expectedTeams) add("teams_match_schedule", opts.expectedTeams[0] === sides[0] && opts.expectedTeams[1] === sides[1], `page ${sides} vs schedule ${opts.expectedTeams}`);

  // period scores
  let periodsLen = 0;
  sides.forEach((t, i) => {
    const p = g.periods.find((x) => x.lg_team_id === t);
    if (p) periodsLen = Math.max(periodsLen, p.goals.length);
    // Observed on LG (921537, 921540): period table all zeros while final/box score are complete.
    // That is "period data unavailable" (non-blocking flag), NOT a contradiction. Any non-zero mismatch blocks.
    const allZero = !!p && p.goals.every((x) => x === 0) && (score[i] ?? 0) > 0;
    if (allZero) { F.push(`period_stats_unavailable:${t}`); add(`period_sum_${t}`, true, `periods all 0 on source; final ${score[i]} (flagged)`, false); return; }
    const ok = !!p && p.goals.length >= 3 && p.goals.every(Number.isInteger) && sum(p.goals) === score[i];
    add(`period_sum_${t}`, ok, p ? `periods ${p.goals.join("-")} vs ${score[i]}` : "no period row");
  });
  const decided_in = periodsLen === 3 ? "REG" : periodsLen > 3 ? "OT" : null; // SO not yet observed on LG3S; treat >3 cols as OT/SO -> review
  if (periodsLen > 3) F.push("overtime_or_shootout_review");

  // team stats
  sides.forEach((t, i) => add(`teamstats_goals_${t}`, g.team_stats[t]?.goals === score[i], `team-stats goals ${g.team_stats[t]?.goals} vs ${score[i]}`));

  // skaters
  sides.forEach((t, i) => {
    const sk = g.skaters.filter((s) => s.lg_team_id === t);
    add(`skater_count_${t}`, sk.length >= 3, `${sk.length} skaters`);
    add(`skater_numbers_${t}`, sk.every((s) => [s.g, s.a, s.p].every((n) => Number.isInteger(n) && n >= 0) && s.p === s.g + s.a), "G/A/P integers and P=G+A");
    const G = sum(sk.map((s) => s.g)), A = sum(sk.map((s) => s.a));
    add(`skater_goals_eq_score_${t}`, G === score[i], `ΣG=${G} vs ${score[i]}`);
    add(`assists_consistent_${t}`, A <= 2 * G, `ΣA=${A} ≤ 2×ΣG=${2 * G}`);
    const sog = sk.map((s) => s.shots); const ts = g.team_stats[t]?.total_shots;
    if (sog.every((x) => x != null) && typeof ts === "number") add(`skater_sog_eq_team_shots_${t}`, sum(sog as number[]) === ts, `ΣSOG=${sum(sog as number[])} vs team ${ts}`, false);
    for (const s of sk) {
      if (s.lg_user_id == null) { F.push(`missing_id:${s.gamertag}@${t}`); add(`identity_${t}_${s.gamertag}`, false, "skater row has no LG userid"); }
      else if (PLACEHOLDER_USER_IDS.has(s.lg_user_id)) {
        F.push(`placeholder_account:${s.gamertag}(uid ${s.lg_user_id})@${t}`);
        add(`placeholder_no_points_${t}`, s.g === 0 && s.a === 0, `placeholder line ${s.gamertag} G${s.g} A${s.a}`);
      } else if (opts.rosterUserIds && !opts.rosterUserIds.has(s.lg_user_id)) F.push(`not_in_roster_snapshot:${s.gamertag}(uid ${s.lg_user_id})@${t}`);
      for (const f of s.flags) F.push(`${f}:${s.gamertag}`);
      if (s.flags.some((f) => f.startsWith("crest_team_mismatch"))) add(`crest_${s.lg_user_id}`, false, "row crest disagrees with team section");
    }
  });
  // duplicate player rows in one game
  const keys = g.skaters.map((s) => `${s.lg_user_id ?? s.gamertag}`); add("no_duplicate_skaters", new Set(keys).size === keys.length, `${keys.length} rows`);

  // goalies: credited by row crest; GA vs opponent score; SA vs opponent shots
  add("goalies_resolved", g.goalies.length >= 2 && g.goalies.every((x) => x.lg_team_id != null && x.lg_user_id != null), `${g.goalies.length} goalie rows`);
  sides.forEach((t, i) => {
    const gl = g.goalies.filter((x) => x.lg_team_id === t); const opp = score[1 - i] ?? NaN; const oppShots = g.team_stats[sides[1 - i]]?.total_shots;
    add(`goalie_present_${t}`, gl.length >= 1, `${gl.length} goalie(s)`);
    add(`goalie_sv_math_${t}`, gl.every((x) => x.saves === x.shots_against - x.goals_against && x.saves >= 0), "SV = SA − GA");
    const GA = sum(gl.map((x) => x.goals_against)), SA = sum(gl.map((x) => x.shots_against));
    if (GA === opp) add(`goalie_ga_eq_opp_${t}`, true, `ΣGA=${GA} = opp ${opp}`);
    else if (GA < opp) { add(`goalie_ga_eq_opp_${t}`, true, `ΣGA=${GA} < opp ${opp} (empty-net exception)`, false); F.push(`empty_net_exception:${t}:${opp - GA}`); }
    else add(`goalie_ga_eq_opp_${t}`, false, `ΣGA=${GA} > opp ${opp}`);
    if (typeof oppShots === "number") add(`goalie_sa_eq_opp_shots_${t}`, SA === oppShots || (GA < opp && SA <= oppShots), `ΣSA=${SA} vs opp shots ${oppShots}`);
  });

  const canon = canonical(g);
  return { checks: C, passed: C.every((c) => c.ok || !c.blocking), flags: [...new Set(F)], decided_in, payload_hash: await sha256(JSON.stringify(canon)), canonical: canon };
}

/** Standings computed ONLY from verified games. Points: regulation W=2 per LG table (W×2=PTS observed);
 * OTW/OTL points are NOT assumed — returned null and flagged until LG publishes/an OT game confirms it. */
export function computeStandings(games: { away: number; home: number; as: number; hs: number; decided_in: string | null }[], teams: number[]) {
  const t = new Map(teams.map((id) => [id, { lg_team_id: id, gp: 0, w: 0, l: 0, otw: 0, otl: 0, gf: 0, ga: 0, pts: 0 as number | null }]));
  for (const g of games) {
    const A = t.get(g.away)!, H = t.get(g.home)!; const ot = g.decided_in && g.decided_in !== "REG";
    A.gp++; H.gp++; A.gf += g.as; A.ga += g.hs; H.gf += g.hs; H.ga += g.as;
    const [win, lose] = g.as > g.hs ? [A, H] : [H, A];
    if (ot) { win.otw++; lose.otl++; } else { win.w++; lose.l++; }
  }
  for (const r of t.values()) r.pts = r.otw || r.otl ? null : r.w * 2;
  return [...t.values()];
}
// ---- fetcher.ts
// Polite LG fetcher: >= 2 s between requests (global), identifiable UA, in-run cache, retry w/ exponential backoff,
// circuit-breaker on Cloudflare challenge / 403 / 429 / 5xx so an outage never produces writes.
export const LG_BASE = "https://www.leaguegaming.com/forums/index.php?leaguegaming/league";
export const urls = {
  game: (id: number) => `${LG_BASE}&action=league&page=game&gameid=${id}`,
  schedule: (teamId: number) => `${LG_BASE}&action=league_page&page=team_page_schedule&teamid=${teamId}&leagueid=154&seasonid=1`,
  standings: () => `${LG_BASE}&action=league&page=standing&leagueid=154&seasonid=1`,
};
export type FetchResult = { url: string; status: number; body: string; fromCache: boolean };
export class SourceOutage extends Error { constructor(public status: number, msg: string) { super(msg); } }

export function makeFetcher(opts: { minIntervalMs?: number; maxRetries?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxRequests?: number } = {}) {
  const min = opts.minIntervalMs ?? 2000, maxRetries = opts.maxRetries ?? 3, f = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const cache = new Map<string, FetchResult>(); let last = 0; let requests = 0; let tripped: SourceOutage | null = null;
  async function get(url: string): Promise<FetchResult> {
    if (cache.has(url)) return { ...cache.get(url)!, fromCache: true };
    if (tripped) throw tripped;
    for (let attempt = 0; ; attempt++) {
      if (opts.maxRequests && requests >= opts.maxRequests) throw new SourceOutage(0, "request budget exhausted");
      const wait = last + min - Date.now(); if (wait > 0) await sleep(wait);
      last = Date.now(); requests++;
      let status = 0, body = "";
      try {
        const r = await f(url, { headers: { "user-agent": "ECM-LG3S-sync/1.0 (+https://wildmanhockey-elitechelmedia.app; polite <=1 req/2s)", accept: "text/html" }, signal: AbortSignal.timeout(20000) });
        status = r.status; body = await r.text();
      } catch (e) { status = 0; body = String(e); }
      const challenge = /<title>\s*(Just a moment|Attention Required)|cf-mitigated|_cf_chl_opt/i.test(body) && !/leaguepage|Regular Season/.test(body);
      if (status === 200 && !challenge) { const res = { url, status, body, fromCache: false }; cache.set(url, res); return res; }
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || attempt >= maxRetries || challenge) { tripped = new SourceOutage(status, challenge ? "cloudflare challenge" : `HTTP ${status}`); throw tripped; }
      await sleep(Math.min(60000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 500));
    }
  }
  return { get, stats: () => ({ requests, cached: cache.size, tripped: tripped?.message ?? null }) };
}
// ---- core.ts

export interface Store {
  snapshot(s: { kind: string; source_id: string; url: string; http_status: number; sha256: string; payload_hash?: string | null; bytes: number; parse_error?: string | null }): Promise<number>;
  rpc(fn: "lg3s_ingest_game" | "lg3s_upsert_schedule", args: Record<string, unknown>): Promise<any>;
  standings(rows: Record<string, unknown>[]): Promise<void>;
  pendingGameIds(nowIso: string, lookaheadMin: number, maxAgeDays: number): Promise<number[]>; // scheduled_at <= now+lookahead, not verified/corrected
  recentVerifiedIds(days: number): Promise<number[]>;
  teamIds(): Promise<number[]>;
  rosterUserIds?(): Promise<Set<number>>;
}
type Fetcher = { get(url: string): Promise<{ status: number; body: string; fromCache: boolean }> };

export async function buildPayload(html: string, id: number, roster?: Set<number>) {
  const g = parseGame(html, id);
  const v = await verifyGame(g, { rosterUserIds: roster });
  const lines = [
    ...g.skaters.map((s) => ({ ...s, is_placeholder: s.lg_user_id != null && PLACEHOLDER_USER_IDS.has(s.lg_user_id) })),
    ...g.goalies.map((x) => ({ ...x, is_placeholder: x.lg_user_id != null && PLACEHOLDER_USER_IDS.has(x.lg_user_id) })),
  ];
  return { parsed: g, verification: v, payload: {
    lg_game_id: id, scheduled_at: g.scheduled_at, away_lg_team_id: g.away_lg_team_id, home_lg_team_id: g.home_lg_team_id, is_final: g.is_final,
    away_score: g.away_score, home_score: g.home_score, decided_in: v.decided_in,
    period_stats: g.periods.every((p) => p.goals.every((x) => x === 0)) && (g.away_score ?? 0) + (g.home_score ?? 0) > 0 ? null : g.periods,
    team_stats: g.team_stats, checks: v.checks, flags: v.flags, passed: v.passed, payload_hash: v.payload_hash, source_url: urls.game(id), lines } };
}

export async function syncGame(store: Store, f: Fetcher, id: number, roster?: Set<number>, now?: string, reparse = false) {
  const url = urls.game(id);
  const r = await f.get(url);
  const raw = await sha256(r.body);
  try {
    const { payload, verification } = await buildPayload(r.body, id, roster);
    const snap = await store.snapshot({ kind: "game", source_id: String(id), url, http_status: r.status, sha256: raw, payload_hash: verification.payload_hash, bytes: r.body.length });
    const res = await store.rpc("lg3s_ingest_game", { p: { ...payload, snapshot_id: snap, ...(now ? { now } : {}), ...(reparse ? { reparse: true } : {}) } });
    return { id, ...res, passed: verification.passed, flags: verification.flags };
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    await store.snapshot({ kind: "game", source_id: String(id), url, http_status: r.status, sha256: raw, bytes: r.body.length, parse_error: `${e.code}: ${e.message}` });
    return { id, action: "parse_error", error: e.code }; // no write to lg3s_games: invalid pages never touch stored data
  }
}

export async function syncSchedule(store: Store, f: Fetcher) {
  const all = new Map<number, ReturnType<typeof parseSchedule>[number]>();
  const conflicts: string[] = [];
  for (const t of await store.teamIds()) {
    const r = await f.get(urls.schedule(t));
    for (const g of parseSchedule(r.body)) {
      const prev = all.get(g.lg_game_id);
      if (prev && (prev.away_lg_team_id !== g.away_lg_team_id || prev.home_lg_team_id !== g.home_lg_team_id || prev.scheduled_at !== g.scheduled_at)) conflicts.push(String(g.lg_game_id));
      all.set(g.lg_game_id, g);
    }
  }
  const games = [...all.values()].filter((g) => !conflicts.includes(String(g.lg_game_id))).map((g) => ({ ...g, source_url: urls.game(g.lg_game_id) }));
  const changes = await store.rpc("lg3s_upsert_schedule", { p_games: games });
  return { games: games.length, conflicts, changes };
}

export async function syncStandings(store: Store, f: Fetcher) {
  const r = await f.get(urls.standings());
  const rows = parseStandings(r.body);
  const hash = await sha256(JSON.stringify(rows));
  await store.standings(rows.map((x) => ({ source: "lg_official", group_code: x.group, lg_team_id: x.lg_team_id, rank: x.rank, gp: x.gp, w: x.w, l: x.l, otw: x.otw, otl: x.otl, pts: x.pts, gf: x.gf, ga: x.ga, gd: x.gd, streak: x.streak, source_url: urls.standings(), payload_hash: hash })));
  return { rows: rows.length, hash };
}

/** mode: schedule | gamenight | sweep | backfill */
export async function run(store: Store, f: Fetcher, mode: string, opts: { ids?: number[]; now?: string; reparse?: boolean } = {}) {
  const out: any = { mode, results: [], errors: [] };
  const roster = await store.rosterUserIds?.();
  try {
    if (mode === "schedule") out.schedule = await syncSchedule(store, f);
    let ids: number[] = [];
    if (mode === "backfill") ids = opts.ids ?? [];
    if (mode === "gamenight" || mode === "sweep") ids = await store.pendingGameIds(opts.now ?? new Date().toISOString(), 15, 7);
    if (mode === "sweep") ids = [...new Set([...ids, ...(await store.recentVerifiedIds(7))])];
    for (const id of ids) out.results.push(await syncGame(store, f, id, roster, opts.now, opts.reparse === true && mode === "backfill"));
    if (mode !== "backfill" || ids.length) out.standings = await syncStandings(store, f);
  } catch (e) {
    if (e instanceof SourceOutage) out.errors.push({ outage: e.message, status: e.status }); else out.errors.push({ error: String(e) });
  }
  out.status = out.errors.length ? (out.results.length ? "partial" : "failed") : "ok";
  return out;
}
