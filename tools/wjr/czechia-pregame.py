"""Read the public LGWJC schedule and posted starters using LG Client game-sheet rules."""
import argparse
import base64
from datetime import date, datetime
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urljoin, urlsplit

from lxml import html


LEAGUE = "77"
SEASON = "33"
CZECHIA = "345"
SCHEMA = "lgwjc-czechia-pregame-v1"
LG = "https://www.leaguegaming.com/forums/index.php?leaguegaming/league"
SCHEDULE = f"{LG}&action=league_page&page=team_page_schedule&teamid={CZECHIA}&leagueid={LEAGUE}&seasonid={SEASON}"
REPO = "bellyjelly9393-ux/ELITECHELMEDIA"
BRANCH = "wjr-pregame-data"
FEED = f"repos/{REPO}/contents/data/wjr/czechia-pregame.json"
POSITIONS = ("LW", "C", "RW", "LD", "RD", "G")
SEASON_START = date(2026, 11, 22)
SEASON_END = date(2026, 12, 22)
GAME_DATE = re.compile(r"\b[A-Z][a-z]+ ([A-Z][a-z]+ \d{1,2})(?:st|nd|rd|th) (\d{4}), (\d{1,2}:\d{2} [AP]M)\b")
SCHEDULE_DATE = re.compile(r"(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) ([A-Z][a-z]{2} \d{1,2}) (\d{1,2}:\d{2}[ap]m)\b")


def content(element):
    return " ".join(element.text_content().split())


def load_page(path):
    document = html.parse(path)
    if re.search(r"Just a moment|Attention Required|Access Denied", " ".join(document.xpath("//title/text()")), re.I):
        raise ValueError(f"{Path(path).name} returned an access challenge")
    return document


def params(link):
    url = urlsplit(urljoin(LG, link))
    if url.scheme != "https" or url.netloc != "www.leaguegaming.com" or url.path != "/forums/index.php":
        return {}
    return {key: values[0] for key, values in parse_qs(url.query).items() if len(values) == 1}


def fixtures(path):
    document = load_page(path)
    games = {}
    for row in document.xpath('//tr[.//a[contains(@href,"gameid=")]]'):
        links = [(link, params(link.get("href"))) for link in row.xpath(".//a[@href]")]
        matches = [data for _, data in links if data.get("page") == "game"
                   and data.get("leagueid") == LEAGUE and data.get("seasonid") == SEASON]
        if not matches:
            continue
        teams = [(data["teamid"], link.xpath("string(.//img/@alt)").strip()) for link, data in links
                 if data.get("page") == "team_page" and data.get("leagueid") == LEAGUE and data.get("seasonid") == SEASON]
        if len(matches) != 1 or len(teams) != 2 or sum(t[0] == CZECHIA for t in teams) != 1:
            raise ValueError("The LGWJC schedule did not identify both teams and a unique game")
        game_id = matches[0].get("gameid", "")
        opponent_id, opponent = next(t for t in teams if t[0] != CZECHIA)
        stamp = SCHEDULE_DATE.search(content(row))
        if not (stamp and re.fullmatch(r"[1-9]\d{0,9}", game_id)
                and re.fullmatch(r"[1-9]\d{0,9}", opponent_id) and 1 <= len(opponent) <= 40):
            raise ValueError("Incomplete LGWJC schedule entry")
        kickoff = datetime.strptime(f"2026 {stamp[1]} {stamp[2]}", "%Y %b %d %I:%M%p")
        if not SEASON_START <= kickoff.date() <= SEASON_END:
            continue
        entry = {
            "id": int(game_id), "date": kickoff.date().isoformat(), "time": kickoff.strftime("%H:%M"),
            "opponent": opponent, "opponentId": int(opponent_id),
            "source": f"{LG}&action=league&page=game&gameid={game_id}",
        }
        if game_id in games and entry != games[game_id][0]:
            raise ValueError(f"Conflicting LGWJC schedule entries for {game_id}")
        games[game_id] = (entry, [team[0] for team in teams])
    if not games:
        raise ValueError("No verified Season 33 Czechia games were found in the public schedule")
    return sorted(games.values(), key=lambda item: (item[0]["date"], item[0]["time"], item[0]["id"]))


def posted_lineups(path, fixture, expected_teams):
    document = load_page(path)
    teams = [
        params(link.get("href")).get("teamid") for link in document.xpath(
            '//*[contains(concat(" ",normalize-space(@class)," ")," lg_game_header_txt_header ")]'
            '//a[contains(@href,"page=team_page")]')
    ]
    teams = list(dict.fromkeys(teams))
    stamps = [GAME_DATE.search(content(cell)) for cell in document.xpath("//td")]
    stamp = next((match for match in stamps if match), None)
    if teams != expected_teams or not stamp:
        raise ValueError(f"Game sheet teams or time unavailable for {fixture['id']}")
    kickoff = datetime.strptime(f"{stamp[2]} {stamp[1]} {stamp[3]}", "%Y %B %d %I:%M %p")
    if kickoff.date().isoformat() != fixture["date"] or kickoff.strftime("%H:%M") != fixture["time"]:
        raise ValueError(f"Game sheet date or time differs from schedule for {fixture['id']}")

    lineups = []
    for table in document.xpath("//table"):
        rows = table.xpath("./tr | ./thead/tr | ./tbody/tr")
        if not rows:
            continue
        heading = content(rows[0])
        if re.match(r"User\s*\$M.*\bGP\b.*\bPts\b", heading, re.I):
            lineups.append({})
            allowed = POSITIONS[:-1]
        elif re.match(r"Goalie\s*\$M.*\bGGP\b", heading, re.I) and lineups:
            allowed = ("G",)
        else:
            continue
        for row in rows[1:]:
            if not len(row) or (position := content(row[0])) not in allowed:
                continue
            if ("lgtempgame_sub" in row.get("class", "").split() or "hidden" in row.attrib
                    or re.search(r"display\s*:\s*none", row.get("style", ""), re.I)):
                continue
            players = [
                (params(a.get("href")), content(a))
                for a in row.xpath('.//a[contains(@href,"page=team_user")]') if content(a)
            ]
            if len(players) != 1:
                raise ValueError(f"Unverified starting player in {fixture['id']} at {position}")
            identity, name = players[0]
            player_id = identity.get("userid", "")
            if (identity.get("leagueid"), identity.get("seasonid")) != (LEAGUE, SEASON) or not (
                    re.fullmatch(r"[1-9]\d{0,9}", player_id) and 1 <= len(name) <= 80):
                raise ValueError(f"Invalid LGWJC player in {fixture['id']} at {position}")
            player = {"position": position, "gamertag": name, "lgUserId": int(player_id)}
            number = row.get("data-jersey-number", "")
            if re.fullmatch(r"\d{1,2}", number):
                player["jerseyNumber"] = number
            if position in lineups[-1] or int(player_id) in {p["lgUserId"] for p in lineups[-1].values()}:
                raise ValueError(f"Ambiguous starting lineup in {fixture['id']}")
            lineups[-1][position] = player

    if not lineups:
        return {"czech": [], "away": []}
    if len(lineups) != 2:
        raise ValueError(f"Game sheet does not identify both lineup tables for {fixture['id']}")
    tagged = {
        "czech" if team == CZECHIA else "away": [players[spot] for spot in POSITIONS if spot in players]
        for team, players in zip(teams, lineups)
    }
    return tagged


def build(folder, game_date, previous):
    if previous.get("schema") != SCHEMA or previous.get("season") != int(SEASON):
        raise ValueError("The public feed is not the Season 33 Czechia snapshot")
    old = {game["id"]: game for game in previous["games"]}
    games = []
    for fixture, teams in fixtures(folder / "schedule.html"):
        prior = old.get(fixture["id"], {})
        same_fixture = all(prior.get(key) == fixture[key] for key in ("date", "time", "opponentId"))
        if fixture["date"] == game_date:
            sheet = folder / f"{fixture['id']}.html"
            fresh = posted_lineups(sheet, fixture, teams)
            games.append({**fixture, **fresh, "lineupDate": game_date})
        elif same_fixture:
            games.append({**prior, **fixture})
        else:
            games.append({**fixture, "czech": [], "away": []})
    return {"schema": SCHEMA, "season": int(SEASON), "games": games}


def github(*args, body=None):
    call = subprocess.run(["gh", "api", *args], capture_output=True, text=True, input=body, timeout=30)
    if call.returncode:
        raise RuntimeError(call.stderr.strip())
    return json.loads(call.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("plan", "build", "publish"))
    parser.add_argument("folder", type=Path, help="Directory containing schedule.html and GAMEID.html public pages")
    parser.add_argument("date", type=date.fromisoformat, help="Game-night date in America/Toronto")
    parser.add_argument("--previous", type=Path)
    args = parser.parse_args()
    if not SEASON_START <= args.date <= SEASON_END:
        parser.error("Date is outside the published LGWJC Season 33 tournament")
    game_date = args.date.isoformat()

    if args.action == "plan":
        print(json.dumps([entry for entry, _ in fixtures(args.folder / "schedule.html") if entry["date"] == game_date]))
        return

    remote = None
    if args.action == "publish":
        remote = github(f"{FEED}?ref={BRANCH}")
        baseline = json.loads(base64.b64decode(remote["content"]))
    else:
        baseline = json.loads(args.previous.read_text()) if args.previous else {"schema": SCHEMA, "season": int(SEASON), "games": []}

    snapshot = build(args.folder, game_date, baseline)
    result = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if args.action == "build":
        print(result, end="")
        return
    if snapshot != baseline:
        github("--method", "PUT", FEED, "--input", "-", body=json.dumps({
            "message": f"Refresh public Czechia World Juniors lineups for {game_date}",
            "branch": BRANCH, "sha": remote["sha"], "content": base64.b64encode(result.encode()).decode(),
        }))
    for entry in snapshot["games"]:
        if entry["date"] == game_date:
            counts = f"{len(entry['czech'])}/6 Czechia, {len(entry['away'])}/6 opponent"
            print(f"{entry['time']} ET · {entry['opponent']} · {counts} · {entry['source']}")


if __name__ == "__main__":
    main()
