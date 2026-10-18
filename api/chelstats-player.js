const UPSTREAM = "https://chelstats.app/api/players/stats";

function numberValue(value) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function findShotNode(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return null;
  if (Object.prototype.hasOwnProperty.call(value, "ShotsLocationOnIce1")) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findShotNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const child of Object.values(value)) {
    const found = findShotNode(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function firstDefined(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username = String(req.query.username || "").trim();
  const teamname = String(req.query.teamname || "").trim();
  const consoleName = String(req.query.console || "common-gen5").trim();

  if (!username || username.length > 80 || teamname.length > 120 || consoleName.length > 40) {
    return res.status(400).json({ error: "A valid username is required" });
  }

  const url = new URL(UPSTREAM);
  url.searchParams.set("username", username);
  if (teamname) url.searchParams.set("teamname", teamname);
  url.searchParams.set("console", consoleName || "common-gen5");

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "VVHL-HUB scouting analytics/1.0",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Chelstats request failed",
        status: upstream.status,
      });
    }

    const raw = await upstream.json();
    const node = findShotNode(raw);
    // Career profile: EA account ID (blazeId, the key EA uses in match files) plus all-mode career rates.
    // Works for guests too, since it does not need the player's club. No shot locations in this mode.
    if (String(req.query.profile || "") === "1") {
      const p = firstDefined(raw, ["Username", "username"]) ? raw : node;
      const confirmed = String(firstDefined(p, ["Username", "username"]) || "").trim();
      if (!p || confirmed.toLowerCase() !== username.toLowerCase()) {
        return res.status(404).json({ error: "No exact gamertag identity was returned by ChelStats" });
      }
      const o = p.overall_results?.overall_results || {}, g = p.overall_results?.goalie_overall_results || {};
      const n = (k) => { const v = firstDefined(p, [k]); return v == null ? null : numberValue(v); };
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
      return res.status(200).json({ source: "chelstats", scope: "EA career, all game modes (not LG-only)", profile: {
        username: confirmed, blazeId: firstDefined(p, ["blazeId"]) ? String(p.blazeId) : null,
        chelName: firstDefined(p, ["skplayername"]) || p.identity?.displayName || null,
        position: firstDefined(p, ["Position"]), gamesPlayed: n("Games Played"),
        positionGames: { C: n("C Gps"), LW: n("LW Gps"), RW: n("RW Gps"), D: n("D Gps"), G: n("Goalie games played") },
        goalsPerGame: n("Goals per game"), assistsPerGame: n("Assists per game"), shotsPerGame: n("Shots per game"),
        shootingPct: n("Shot %"), shotsOnNetPct: n("Shots on net %"), passPct: n("Pass %"), hitsPerGame: n("Hits per game"),
        takeawaysPerGame: n("Takeaways per game"), giveawaysPerGame: n("Giveaways per game"), interceptionsPerGame: n("Interceptions per game"),
        blockedShotsPerGame: n("Blocked shots per game"), faceoffPct: n("FO %"), breakawayPct: n("Breakaway %"), possessionPerMin: n("Possession per min"),
        savePct: n("Save %"), gaa: n("GAA"),
        playstyle: p.overall_results?.playstyle || null, mainMode: o["Main Game Mode"] || null,
        ratings: o["Overall Rating"] != null ? { overall: o["Overall Rating"], offense: o["Offense Rating"], defense: o["Defense Rating"], categories: o["Category Ratings"] || null } : null,
        goalieRatings: g["Overall Rating"] != null && n("Goalie games played") ? { overall: g["Overall Rating"], categories: g["Category Ratings"] || null } : null
      }});
    }
    // Identity lookups do not require shot-location stats (many valid profiles omit them).
    if (String(req.query.identity || "") === "1") {
      const identityProfile = firstDefined(raw, ["Username", "username"]) ? raw : node;
      const confirmedUsername = String(firstDefined(identityProfile, ["Username", "username"]) || "").trim();
      if (confirmedUsername.toLowerCase() !== username.toLowerCase()) {
        return res.status(404).json({ error: "No exact gamertag identity was returned by ChelStats" });
      }
      const chelName = firstDefined(identityProfile, ["skplayername"]) || raw.identity?.displayName || null;
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      return res.status(200).json({ source: "chelstats", profile: {
        username: confirmedUsername, chelName,
        platform: firstDefined(identityProfile, ["Platform", "platform"]) || raw.identity?.platform || null
      }});
    }
    if (!node) {
      return res.status(404).json({
        error: "No shot-location object was found in the Chelstats response",
      });
    }

    const ice = Array.from({ length: 16 }, (_, index) => {
      const zone = index + 1;
      const shots = numberValue(node[`ShotsLocationOnIce${zone}`]);
      const goals = numberValue(node[`GoalsLocationOnIce${zone}`]);
      return {
        zone,
        shots,
        goals,
        efficiency: shots ? (goals / shots) * 100 : 0,
      };
    });

    const net = Array.from({ length: 5 }, (_, index) => {
      const zone = index + 1;
      const shots = numberValue(node[`ShotsLocationOnNet${zone}`]);
      const goals = numberValue(node[`GoalsLocationOnNet${zone}`]);
      return {
        zone,
        shots,
        goals,
        efficiency: shots ? (goals / shots) * 100 : 0,
      };
    });

    const totalIceShots = ice.reduce((sum, row) => sum + row.shots, 0);
    const totalIceGoals = ice.reduce((sum, row) => sum + row.goals, 0);
    const totalNetShots = net.reduce((sum, row) => sum + row.shots, 0);

    const profile = {
      username: firstDefined(node, ["Username", "username"]) || username,
      // Return a name only when the upstream profile confirms the requested gamertag.
      chelName: String(firstDefined(node, ["Username", "username"]) || "").trim().toLowerCase() === username.toLowerCase()
        ? firstDefined(raw, ["skplayername"]) || raw.identity?.displayName || firstDefined(node, ["skplayername"]) || null
        : null,
      platform: firstDefined(node, ["Platform", "platform"]) || raw.identity?.platform || null,
      position: firstDefined(node, ["Position", "position"]),
      record: firstDefined(node, ["Record", "record"]),
      gamesPlayed: numberValue(firstDefined(node, ["Games Played", "GPs", "Games Played "])),
      wins: numberValue(firstDefined(node, ["Wins"])),
      losses: numberValue(firstDefined(node, ["Losses"])),
      otls: numberValue(firstDefined(node, ["OTLs"])),
      winPct: numberValue(firstDefined(node, ["Win %"])),
      goals: numberValue(firstDefined(node, ["Goals"])),
      assists: numberValue(firstDefined(node, ["Assists"])),
      points: numberValue(firstDefined(node, ["Points"])),
      shots: numberValue(firstDefined(node, ["Shots"])),
      shootingPct: numberValue(firstDefined(node, ["Shot %"])),
      shotsPerGame: numberValue(firstDefined(node, ["Shots per game"])),
      goalsPerGame: numberValue(firstDefined(node, ["Goals per game"])),
      passPct: numberValue(firstDefined(node, ["Pass %"])),
      hitsPerGame: numberValue(firstDefined(node, ["Hits per game"])),
      takeawaysPerGame: numberValue(firstDefined(node, ["Takeaways per game"])),
      giveawaysPerGame: numberValue(firstDefined(node, ["Giveaways per game"])),
      interceptionsPerGame: numberValue(firstDefined(node, ["Interceptions per game"])),
      blockedShotsPerGame: numberValue(firstDefined(node, ["Blocked shots per game"])),
      faceoffPct: numberValue(firstDefined(node, ["FO %"])),
      breakawayPct: numberValue(firstDefined(node, ["Breakaway %"])),
      recent: node.playerRecentData || null,
    };

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({
      source: "chelstats",
      username,
      teamname: teamname || null,
      console: consoleName,
      profile,
      totals: {
        iceShots: totalIceShots,
        iceGoals: totalIceGoals,
        netShots: totalNetShots,
        efficiency: totalIceShots ? (totalIceGoals / totalIceShots) * 100 : 0,
      },
      ice,
      net,
    });
  } catch (error) {
    return res.status(502).json({ error: "Unable to reach Chelstats", detail: error?.message || "Unknown error" });
  }
}
