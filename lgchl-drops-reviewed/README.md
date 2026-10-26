# lgchl-drops-reviewed/

Approved copies written by the reviewer after checking a raw drop in [`lgchl-drops/`](../lgchl-drops/README.md). The raw file stays where it was. Nothing in that folder is edited to produce a review.

This directory is still not the live site database. The site importer is the only step that may promote a reviewed file onto the live site. No file here is wired to the site, and nothing here fetches LeagueGaming. Do not scrape LG from this folder or get around site access controls.

The same three hard rules apply: LG team IDs, EA club IDs, and LG game IDs stay distinct; a private matchmaking code is `null` unless it was printed on the source page; every record keeps `source_url`, `parsed_at`, and the rest of its provenance. A `scheduled` game stays `scheduled`, with no score.

## How a review is filed

1. Read the raw file in `lgchl-drops/`. Leave it unchanged.
2. Write a new file under the matching subfolder: `rosters/`, `lineups/`, `results/`, `schedules/`, or `standings/`.
3. Name it `lgchl-s55-<kind>-<scope>-reviewed-<YYYYMMDDTHHMMSSZ>.json`, plus a `.csv` twin when the raw drop had one.
4. Keep every id, `source_url`, and `parsed_at` from the raw record. Add `reviewed_at` (ISO-8601 UTC), `reviewed_by`, and `review_status` (`approved` or `flagged`). A flagged record stays in the file with `review_note` stating what failed the check.
5. Optional: a markdown note beside the JSON, same timestamp, when the flags need a paragraph.

These subfolders are empty until that first review. There is no validator script and no importer in this directory.
