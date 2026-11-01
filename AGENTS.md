# LG information source and current VOD scope

For LG game, player, roster, alias and statistics work, use the user's **LG Stats Client Developer Starter** as the primary source/workflow. On this workstation it is at `C:\Users\elitechelmedia\Downloads\LG-Stats-Client-Developer-Starter`. Inspect its README and supported bridge/parser interfaces before using another source. Saved captures in this repository can be used as clearly dated reference/test data, not as evidence of the current lineup.

The starter's existing `lg_stats_bridge.StatsBridge` provides read-only player and stored-alias lookups. Its present SQLite database has season statistics and registered aliases, not game lineup tables. Obtain game/lineup evidence through the client's authorized LG page capture workflow when it is absent; do not manufacture missing data or read browser session secrets.

For the initial VOD identity rollout, limit collection to the Calgary Hitmen and their scheduled opponents for the current week and remainder of the posted season. Check each night's three games independently. Do not expand to unrelated league teams. A season roster or statistics list, including reserves or historical members, does not establish actual game participation. Keep LG user IDs, EA account/persona IDs, EA gamertags, CHEL characters and broadcast names in separate fields/namespaces. An EA gamertag is not proof of a stable EA account ID or of its LG-account owner.

Retain league + season + LG user ID as canonical identity. Bind EA IDs and names only with evidence, verify participation per game, and leave ambiguity unresolved. No production writes, deployment or historical scouting report replacement is authorized by this source/scope preference.
