#!/usr/bin/env python3
"""Read ONLY the named LG SQLite database. Dry run by default; never inspect browser folders.
After migration approval, --upload sends allowlisted rows to service-only staging RPCs.
The server replaces LG IDs with random public UUIDs and publishes a complete import atomically.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid

LEAGUES = {37: "NHL", 38: "AHL", 84: "ECHL", 39: "CHL", 112: "NCAA"}
DEFAULT_DB = r"C:\Users\elitechelmedia\Downloads\LG-Stats-Client-Developer-Starter\lg_stats.db"
PROJECT_URL = "https://lrgllzvwgvqagcpiyvfd.supabase.co"
FORBIDDEN = {"browser-data", "browser-cache"}
COMMON = {
    "lg_user_id": ["lg_user_id"], "league_id": ["league_id"], "season": ["season_id", "season"],
    "gamertag": ["gamertag", "player_name", "username", "name"],
    "lg_team_id": ["lg_team_id", "team_id"], "team_name": ["team_name", "team"],
    "position": ["position", "pos"], "gp": ["gp", "games_played", "games"],
}
SKATER = {"goals": ["goals", "g"], "assists": ["assists", "a"], "points": ["points", "pts", "p"],
          "plus_minus": ["plus_minus", "plusminus", "+/-"]}
GOALIE = {"wins": ["wins", "w"], "losses": ["losses", "l"], "otl": ["otl", "ot_losses"],
          "saves": ["saves", "sv"], "shots_against": ["shots_against", "sa"],
          "goals_against": ["goals_against", "ga"], "save_pct": ["save_pct", "save_percentage", "sv_pct"],
          "gaa": ["gaa", "goals_against_average"], "shutouts": ["shutouts", "so"]}

def database_path(raw):
    original = Path(raw).expanduser()
    if FORBIDDEN.intersection(p.lower() for p in original.parts):
        raise ValueError("Browser data/cache paths are forbidden")
    path = original.resolve(strict=True)
    if FORBIDDEN.intersection(p.lower() for p in path.parts):
        raise ValueError("Browser data/cache paths are forbidden")
    if not path.is_file() or path.name.lower() != "lg_stats.db":
        raise ValueError("Select the lg_stats.db file only")
    return path

def number(value, field):
    if value is None or str(value).strip() in ("", "-", "—", "N/A"):
        return None
    text = str(value).strip().replace(",", "").replace("−", "-")
    if text.endswith("%"):
        text = text[:-1]
    try:
        val = float(text)
    except ValueError:
        raise ValueError("Invalid numeric field: " + field) from None
    if not __import__("math").isfinite(val):
        raise ValueError("Invalid numeric field: " + field)
    if field in ("save_pct", "gaa"):
        if field == "save_pct" and val > 1:
            val /= 100
        if val < 0 or (field == "save_pct" and val > 1):
            raise ValueError("Invalid goalie rate: " + field)
        return val
    if not val.is_integer() or (field != "plus_minus" and val < 0):
        raise ValueError("Invalid integer field: " + field)
    return int(val)

def projection(connection, table, kind):
    # PRAGMA reads column metadata only. SELECT reads just this explicit allowlist.
    cols = {r[1].lower(): r[1] for r in connection.execute('PRAGMA table_info("' + table + '")')}
    aliases = {**COMMON, **(SKATER if kind == "skater" else GOALIE)}
    selected = {key: next((cols[n.lower()] for n in names if n.lower() in cols), None)
                for key, names in aliases.items()}
    required = ["lg_user_id", "league_id", "season", "gamertag", "gp"]
    if kind == "skater":
        required += ["goals", "assists", "points"]
    missing = [key for key in required if selected.get(key) is None]
    if missing:
        raise ValueError(table + " is missing required columns: " + ", ".join(missing))
    def quote(name):
        return '"' + name.replace('"', '""') + '"'
    fields = [(key, col) for key, col in selected.items() if col]
    query = "SELECT " + ",".join(quote(col) + " AS " + quote(key) for key, col in fields) + " FROM " + quote(table)
    output, skipped = [], 0
    for record in connection.execute(query):
        source = dict(record)
        league_id = number(source["league_id"], "league_id")
        if league_id not in LEAGUES:
            skipped += 1
            continue
        row = {"lg_user_id": number(source["lg_user_id"], "lg_user_id"),
               "league": LEAGUES[league_id], "season": number(source["season"], "season"),
               "player_kind": kind, "gamertag": str(source["gamertag"] or "").strip(),
               "gp": number(source["gp"], "gp")}
        if not row["lg_user_id"] or not row["season"] or not row["gamertag"] or row["gp"] is None:
            raise ValueError("Missing player identity, season, gamertag or games")
        if len(row["gamertag"]) > 100:
            raise ValueError("Gamertag is too long")
        team = source.get("lg_team_id")
        row["lg_team_id"] = number(team, "lg_team_id") if team not in (None, "", "—") else None
        name = source.get("team_name")
        row["team_name"] = str(name).strip() if name is not None and not str(name).strip().isdigit() else None
        pos = str(source.get("position") or ("G" if kind == "goalie" else "")).strip().upper()
        row["position"] = pos if pos in ("LW", "C", "RW", "LD", "RD", "G") else None
        for field in SKATER if kind == "skater" else GOALIE:
            row[field] = number(source.get(field), field)
        if kind == "skater" and (row["goals"] is None or row["assists"] is None or row["points"] != row["goals"] + row["assists"]):
            raise ValueError("Skater points must match source goals plus assists")
        output.append(row)
    return output, skipped

def read_rows(raw):
    path = database_path(raw)
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only=ON")
        connection.execute("BEGIN")
        skaters, skip_s = projection(connection, "skater_stats", "skater")
        goalies, skip_g = projection(connection, "goalie_stats", "goalie")
        rows = skaters + goalies
        identities = [(r["lg_user_id"], r["league"], r["season"], r["player_kind"]) for r in rows]
        if len(identities) != len(set(identities)):
            raise ValueError("Duplicate player/league/season/kind rows; no data uploaded")
        if not rows:
            raise ValueError("No supported season statistics found")
        return rows, skip_s + skip_g
    finally:
        connection.rollback()
        connection.close()

def rpc(name, payload, service_key):
    request = urllib.request.Request(PROJECT_URL + "/rest/v1/rpc/" + name,
        data=json.dumps(payload, allow_nan=False).encode(),
        headers={"Content-Type": "application/json", "apikey": service_key, "Authorization": "Bearer " + service_key},
        method="POST")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never echo headers, tokens, URLs with credentials, or private payloads.
        raise RuntimeError("History import RPC failed with HTTP " + str(error.code)) from None

def upload(rows, captured_at=None):
    service_key = os.environ.get("LG_MEDIA_SUPABASE_SERVICE_KEY")
    if not service_key:
        raise ValueError("Set LG_MEDIA_SUPABASE_SERVICE_KEY locally after migration approval")
    import_id = str(uuid.uuid4())
    rpc("lgchl_media_history_begin", {"p_import_id": import_id, "p_expected_rows": len(rows),
        "p_source_label": "LG Stats Client public season statistics", "p_source_captured_at": captured_at}, service_key)
    for start in range(0, len(rows), 500):
        rpc("lgchl_media_history_append", {"p_import_id": import_id, "p_rows": rows[start:start+500]}, service_key)
    return rpc("lgchl_media_history_publish", {"p_import_id": import_id}, service_key)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default=DEFAULT_DB)
    parser.add_argument("--upload", action="store_true", help="Requires owner-approved migrations; default is dry run")
    parser.add_argument("--captured-at", help="Optional known source capture timestamp, with timezone; never guessed from file mtime")
    args = parser.parse_args(argv)
    captured_at = None
    if args.captured_at:
        captured = dt.datetime.fromisoformat(args.captured_at.replace("Z", "+00:00"))
        if captured.tzinfo is None:
            raise ValueError("--captured-at requires a timezone")
        captured_at = captured.astimezone(dt.timezone.utc).isoformat()
    rows, skipped = read_rows(args.database)
    counts = {league: sum(r["league"] == league for r in rows) for league in LEAGUES.values()}
    print(json.dumps({"mode": "upload" if args.upload else "dry-run", "rows": len(rows),
                      "league_counts": counts, "unsupported_league_rows_skipped": skipped,
                      "source_capture_known": captured_at is not None}))
    if args.upload:
        print(json.dumps({"published_rows": upload(rows, captured_at)}))
    else:
        print("No network writes performed. Only the named SQLite database was read.")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, sqlite3.Error, OSError) as error:
        print("Import stopped: " + str(error), file=sys.stderr)
        sys.exit(1)
