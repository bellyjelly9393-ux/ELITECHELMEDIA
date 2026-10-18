"""Game-state timeline from HUD reads, and validators for model claims.

Everything here is deterministic. The timeline is built from hud_reader samples:

* presence: both team-abbreviation glyphs match the game's modal abbreviation glyphs
  (the score bug is hidden during GOAL banners, replays, intermissions and menus);
* goals: a score glyph that changes and stays changed for CONFIRM consecutive present
  reads. The scoring team is the HUD row that changed, never a logo or jersey colour;
* power plays: a POWER PLAY banner belongs to the HUD row it is drawn on;
* periods: a period starts where the clock sits at 20:00; the faceoff is just after the
  last 20:00 read.

Validators then compare model observations against that timeline. They never guess:
a conflict is either rejected (enforce mode, only for goals that the HUD shows did not
happen) or flagged for human review.
"""
import difflib
import re

PRESENCE_DISTANCE = 0.15
CHANGE_DISTANCE = 0.15
CONFIRM = 2
# A goal shows on the HUD only after the GOAL banner/replay: up to ~60 s later.
GOAL_LAG_BEFORE = 90.0   # HUD change may come this long after the claimed moment
GOAL_LAG_AFTER = 15.0    # ... or (timestamp noise) this long before it
PP_MATCH_SLACK = 20.0


def _dist(a, b):
    from hud_reader import sig_distance
    return sig_distance(a, b)


def _medoid(signatures):
    """Most central signature of the largest cluster (greedy clustering)."""
    clusters = []
    for sig in signatures:
        for cluster in clusters:
            if _dist(sig, cluster[0]) < PRESENCE_DISTANCE:
                cluster.append(sig)
                break
        else:
            clusters.append([sig])
    if not clusters:
        return None
    best = max(clusters, key=len)
    return min(best[:200], key=lambda s: sum(_dist(s, o) for o in best[:60]))


def learn_reference(reads):
    """Modal abbreviation glyphs and the most common OCR text for each HUD row."""
    candidates = [r for r in reads if r.get('clock') is not None]
    reference = {}
    for field in ('abbr1', 'abbr2'):
        sigs = [r['sig'].get(field) for r in candidates if (r.get('sig') or {}).get(field)]
        reference[field] = _medoid(sigs)
    names = []
    for row in (0, 1):
        counts = {}
        for r in candidates:
            text = (r.get('abbr') or [None, None])[row]
            if text:
                counts[text] = counts.get(text, 0) + 1
        names.append(max(counts, key=counts.get) if counts else None)
    reference['names'] = names
    return reference


def resolve_teams(reads, known):
    """Fuzzy-map each HUD row's OCR text to a known abbreviation ('CA'/'CAY' -> 'CGY')."""
    known = [k.strip().upper() for k in known or [] if k and k.strip()]
    if not known:
        return None
    out = []
    for row in (0, 1):
        texts = [(r.get('abbr') or [None, None])[row] for r in reads if r.get('clock') is not None]
        texts = [t for t in texts if t]
        if not texts:
            return None
        score = {k: sum(difflib.SequenceMatcher(None, t, k).ratio() for t in texts) / len(texts) for k in known}
        best = max(score, key=score.get)
        if score[best] < 0.4:
            return None
        out.append(best)
    return out if out[0] != out[1] else None


def present(read, reference):
    sig = read.get('sig') or {}
    return all(reference.get(f) is not None and _dist(sig.get(f), reference[f]) < PRESENCE_DISTANCE
               for f in ('abbr1', 'abbr2'))


def ranges_of(times, gap):
    out = []
    for t in times:
        if out and t - out[-1][1] <= gap:
            out[-1][1] = t
        else:
            out.append([t, t])
    return out


def build_timeline(reads, teams=None, initial_score=(0, 0), step=None, known_teams=None, offset=0.0):
    """teams: optional (top_row_abbr, bottom_row_abbr) override, e.g. ('LET', 'CGY').
    known_teams: abbreviations to fuzzy-match the OCR'd rows against.
    offset: added to every time (a period part's start in game-recording seconds)."""
    if offset:
        reads = [dict(r, at=round(r['at'] + offset, 2)) for r in reads]
    reads = sorted(reads, key=lambda r: r['at'])
    if step is None:
        gaps = [b['at'] - a['at'] for a, b in zip(reads, reads[1:])]
        step = sorted(gaps)[len(gaps) // 2] if gaps else 2.0
    reference = learn_reference(reads)
    names = (list(teams) if teams else resolve_teams(reads, known_teams)
             or [n or f'ROW{i + 1}' for i, n in enumerate(reference['names'])])
    flags = []
    shown = [dict(r, present=present(r, reference)) for r in reads]
    live = [r for r in shown if r['present']]

    # ---- scores: a changed score glyph, confirmed on consecutive reads, is a goal for that row
    score = list(initial_score)
    current = [None, None]
    templates = [{}, {}]   # row -> {value: signature}
    candidate = [None, None]
    last_old_at = [None, None]
    goals = []
    for r in live:
        for row, field in ((0, 'score1'), (1, 'score2')):
            sig = r['sig'].get(field)
            if sig is None:
                continue
            if current[row] is None:
                current[row] = sig
                templates[row].setdefault(score[row], sig)
                last_old_at[row] = r['at']
                continue
            if _dist(sig, current[row]) < CHANGE_DISTANCE:
                candidate[row] = None
                last_old_at[row] = r['at']
                continue
            if candidate[row] and _dist(sig, candidate[row]['sig']) < CHANGE_DISTANCE:
                candidate[row]['count'] += 1
            else:
                candidate[row] = {'sig': sig, 'count': 1, 'at': r['at']}
            if candidate[row]['count'] < CONFIRM:
                continue
            new_sig, first_new = candidate[row]['sig'], candidate[row]['at']
            candidate[row] = None
            known = [v for v, t in templates[row].items() if _dist(new_sig, t) < CHANGE_DISTANCE]
            if known and known[0] != score[row] + 1:
                flags.append({'type': 'score_inconsistent', 'at': first_new, 'row': row,
                              'detail': f'{names[row]} score glyph matches {known[0]}, expected {score[row] + 1}'})
                current[row] = new_sig
                score[row] = known[0]
                continue
            score[row] += 1
            templates[row][score[row]] = new_sig
            current[row] = new_sig
            goals.append({'team': names[row], 'row': row, 'score_after': list(score),
                          'hud_changed_at': first_new, 'last_old_at': last_old_at[row],
                          'window': [last_old_at[row], first_new]})
            last_old_at[row] = first_new

    # ---- power plays (banner on a team's row = that team's power play)
    pps = []
    for r in live:
        row = r.get('pp_row')
        if row is None:
            continue
        if pps and pps[-1]['row'] == row and r['at'] - pps[-1]['end'] <= max(30.0, 8 * step):
            pps[-1]['end'] = r['at']
            pps[-1]['reads'] += 1
        else:
            pps.append({'team': names[row], 'row': row, 'start': r['at'], 'end': r['at'], 'reads': 1})
    pps = [p for p in pps if p['reads'] >= CONFIRM]

    # ---- periods (clock parked on 20:00 at a faceoff)
    starts = []
    run = []
    previous_clock = None
    for r in live:
        clock = r.get('clock')
        if clock == 1200.0:
            run.append(r['at'])
            continue
        if run:
            fresh = not starts or run[0] - starts[-1]['faceoff'] > 300
            if fresh and (not starts or previous_clock is None or previous_clock <= 360) \
                    and (len(run) >= CONFIRM or not starts):
                starts.append({'period': len(starts) + 1, 'clock_reset_at': run[0],
                               'faceoff': round(run[-1] + step / 2, 1), 'reads_at_20_00': len(run),
                               'reason': 'clock_20_00'})
            run = []
        if clock is not None:
            previous_clock = clock
    for item in starts:
        item['label'] = f"Period {item['period']}" if item['period'] <= 3 else 'Overtime'

    return {
        'teams': names, 'step_seconds': step, 'samples': len(shown), 'present_samples': len(live),
        'hud_coverage': round(len(live) / max(1, len(shown)), 3),
        'first_hud_at': live[0]['at'] if live else None, 'last_hud_at': live[-1]['at'] if live else None,
        'goals': goals, 'power_plays': pps, 'period_starts': starts,
        'final_score': {names[0]: score[0], names[1]: score[1]}, 'flags': flags,
        'present_ranges': ranges_of([r['at'] for r in live], max(6.0, 3 * step)),
        'initial_score': list(initial_score),
    }


def merge(base, part):
    """Append a later period part's timeline to the game timeline."""
    if not base:
        return part
    out = dict(base)
    for key in ('goals', 'power_plays', 'period_starts', 'flags', 'present_ranges'):
        out[key] = list(base.get(key) or []) + list(part.get(key) or [])
    renumbered = []
    for item in out['period_starts']:
        if renumbered and item['faceoff'] - renumbered[-1]['faceoff'] < 300:
            continue
        number = len(renumbered) + 1
        renumbered.append(dict(item, period=number, label=f'Period {number}' if number <= 3 else 'Overtime'))
    out['period_starts'] = renumbered
    out['final_score'] = part.get('final_score') or base.get('final_score')
    out['samples'] = base.get('samples', 0) + part.get('samples', 0)
    out['present_samples'] = base.get('present_samples', 0) + part.get('present_samples', 0)
    out['hud_coverage'] = round(out['present_samples'] / max(1, out['samples']), 3)
    out['last_hud_at'] = part.get('last_hud_at') or base.get('last_hud_at')
    return out


def score_at(timeline, at):
    """HUD score (top, bottom) as displayed at recording second `at` (goals already shown)."""
    score = list(timeline.get('initial_score') or [0, 0])
    for g in timeline.get('goals', []):
        if g['hud_changed_at'] <= at:
            score = list(g['score_after'])
    return score


def hud_seen_between(timeline, start, end):
    return any(a <= end and b >= start for a, b in timeline.get('present_ranges', []))


def pp_team_at(timeline, at, slack=PP_MATCH_SLACK):
    hits = [p for p in timeline.get('power_plays', []) if p['start'] - slack <= at <= p['end'] + slack]
    if not hits:
        return None
    return min(hits, key=lambda p: abs((p['start'] + p['end']) / 2 - at))


def proposed_periods(timeline, duration, regulation=3):
    """Period ranges from detected faceoffs; None unless every regulation period is found."""
    starts = timeline.get('period_starts') or []
    if len(starts) < regulation:
        return None
    ranges = []
    for i, item in enumerate(starts):
        last = i + 1 == len(starts)
        end = float(duration) if last else starts[i + 1]['faceoff'] - 2
        ranges.append({'label': item['label'], 'start': round(max(0.0, item['faceoff'] - 2), 1),
                       'end': round(end, 1), 'source': 'hud_clock'})
    return ranges


# ------------------------------------------------------------------ validators
GOAL_WORDS = re.compile(r'\b(goal|scores?|scored|scoring|tally|lights? the lamp|buries|finishes|nets|equali[sz]er)\b', re.I)
NOT_GOAL = re.compile(r'\b(goal ?line|goalie|goaltender|goal ?mouth|no goal|disallowed|near[- ]goal|crease|'
                      r'scoring chance|chance|almost|nearly|denied|save[sd]?|off the post|wide|missed)\b', re.I)
PP_WORDS = re.compile(r'\b(power ?play|penalty|penalties|minor|tripping|hooking|slashing|interference|'
                      r'high[- ]sticking|holding|roughing|man advantage|short[- ]?handed|penalty kill|pk)\b', re.I)


def is_goal_claim(observation):
    if str(observation.get('category') or '').lower() in ('goal', 'goal_for', 'goal_against'):
        return True
    text = f"{observation.get('category') or ''} {observation.get('note') or ''}"
    return bool(GOAL_WORDS.search(text)) and not NOT_GOAL.search(text)


def is_pp_claim(observation):
    return bool(PP_WORDS.search(f"{observation.get('category') or ''} {observation.get('note') or ''}"))


def team_mentions(text, aliases):
    """aliases: {'CGY': ['Hitmen', 'Calgary'], 'LET': ['Lethbridge', 'Hurricanes']}"""
    found = set()
    for team, words in (aliases or {}).items():
        for word in [team] + list(words or []):
            if word and re.search(r'(?<![A-Za-z])' + re.escape(word) + r'(?![A-Za-z])', str(text or ''), re.I):
                found.add(team)
    return found


def validate_observation(observation, timeline, aliases=None, coverage=None):
    """Returns hud_check (+ hud_team / hud_note / needs_human_review); never mutates input.

    coverage: (start, end) of the recording covered by the HUD scan; claims outside it
    are left 'unchecked'."""
    at = observation.get('timestamp')
    if not isinstance(at, (int, float)):
        return {'hud_check': 'unchecked'}
    if coverage and not coverage[0] <= at <= coverage[1]:
        return {'hud_check': 'unchecked'}
    text = f"{observation.get('category') or ''} {observation.get('note') or ''}"
    claimed = team_mentions(text, aliases)
    out = {}
    if is_goal_claim(observation):
        window = (at - GOAL_LAG_AFTER, at + GOAL_LAG_BEFORE)
        matches = [g for g in timeline.get('goals', []) if window[0] <= g['hud_changed_at'] <= window[1]]
        if matches:
            goal = min(matches, key=lambda g: abs(g['hud_changed_at'] - at))
            out.update(hud_check='goal_confirmed', hud_team=goal['team'], hud_score_after=goal['score_after'])
            if claimed and goal['team'] not in claimed:
                out.update(hud_check='goal_team_conflict', needs_human_review=True,
                           hud_note=f"HUD credits {goal['team']} (score row changed at {goal['hud_changed_at']:.0f}s); "
                                    f"claim names {'/'.join(sorted(claimed))}.")
            return out
        if hud_seen_between(timeline, at + 5, at + GOAL_LAG_BEFORE):
            score = score_at(timeline, at + GOAL_LAG_BEFORE)
            out.update(hud_check='goal_not_on_hud', needs_human_review=True,
                       hud_note=f'No score change on the HUD within {GOAL_LAG_BEFORE:.0f}s; '
                                f'score stays {score[0]}-{score[1]}.')
        else:
            out.update(hud_check='goal_unverifiable', needs_human_review=True,
                       hud_note='Score bug not visible after this moment; goal cannot be confirmed.')
        return out
    if is_pp_claim(observation):
        pp = pp_team_at(timeline, at)
        if pp:
            out.update(hud_check='pp_confirmed', hud_pp_team=pp['team'])
            took = re.search(r'short[- ]?handed|penalty kill|\bpk\b|took|takes|called for|to the box|penali[sz]ed', text, re.I)
            if claimed and pp['team'] not in claimed and not took:
                out.update(hud_check='pp_team_conflict', needs_human_review=True,
                           hud_note=f"HUD power-play banner is on the {pp['team']} row "
                                    f"({pp['start']:.0f}-{pp['end']:.0f}s); claim names {'/'.join(sorted(claimed))}.")
        else:
            out.update(hud_check='pp_not_on_hud', hud_note='No power-play banner read near this moment.')
        return out
    return {'hud_check': 'not_applicable'}


def validate_structured_event(event, timeline):
    """Benchmark/verifier-style event {event_type, absolute_ts, team, score_state, manpower_state}.

    Returns a list of conflicts: 'fake_goal', 'goal_team', 'score_state', 'reversed_pp'."""
    at = event.get('absolute_ts')
    if not isinstance(at, (int, float)):
        return []
    names = timeline['teams']
    conflicts = []
    kind = str(event.get('event_type') or '').lower()
    team = str(event.get('team') or '').upper() or None
    if kind == 'goal':
        matches = [g for g in timeline.get('goals', []) if at - GOAL_LAG_AFTER <= g['hud_changed_at'] <= at + GOAL_LAG_BEFORE]
        if not matches and hud_seen_between(timeline, at + 5, at + GOAL_LAG_BEFORE):
            conflicts.append('fake_goal')
        elif matches and team in names:
            goal = min(matches, key=lambda g: abs(g['hud_changed_at'] - at))
            if goal['team'] != team:
                conflicts.append('goal_team')
    state = event.get('score_state') or {}
    if isinstance(state, dict) and all(isinstance(state.get(n), (int, float)) for n in names) \
            and hud_seen_between(timeline, at - 20, at + 20):
        shown = score_at(timeline, at)
        # The HUD may still show the old score just after a goal: accept either side of a change.
        before = score_at(timeline, at - 60)
        after = score_at(timeline, at + GOAL_LAG_BEFORE)
        claimed = [int(state[names[0]]), int(state[names[1]])]
        if claimed not in (shown, before, after):
            conflicts.append('score_state')
    manpower = event.get('manpower_state') or {}
    advantaged = str(manpower.get('advantaged_team') or '').upper() if isinstance(manpower, dict) else ''
    if advantaged in names:
        pp = pp_team_at(timeline, at, slack=5)
        if pp and pp['team'] != advantaged:
            conflicts.append('reversed_pp')
    return conflicts


def apply_validation(review, timeline, mode='flag', aliases=None, coverage=None):
    """mode 'flag': annotate. 'enforce': also move goals the HUD disproves into uncertainties.

    Team attribution: confirmed goals/PPs gain hud_team / hud_pp_team (the HUD's answer);
    the model's note is kept verbatim so a reviewer can see what it claimed."""
    if mode not in ('flag', 'enforce') or not timeline:
        return review
    kept = []
    for obs in review.get('observations') or []:
        result = validate_observation(obs, timeline, aliases, coverage)
        if result.get('hud_check') not in (None, 'not_applicable'):
            obs = dict(obs, **result)
        if result.get('needs_human_review'):
            obs['verification'] = 'needs_human_review'
        if mode == 'enforce' and result.get('hud_check') == 'goal_not_on_hud':
            review.setdefault('uncertainties', []).append(
                f"Rejected by HUD: claimed goal at {obs.get('timestamp')}s - {result.get('hud_note')}")
            review.setdefault('hud_rejected', []).append(obs)
            continue
        kept.append(obs)
    review['observations'] = kept
    return review


def hud_facts(timeline, start, end):
    """Short factual text about [start, end] for a prompt: score, goals and power plays."""
    if not timeline:
        return ''
    names = timeline['teams']
    before = score_at(timeline, start)
    lines = [f'HUD (deterministic scoreboard read; authoritative for score and team): rows are '
             f'{names[0]} (top) and {names[1]} (bottom). Score at {start:.0f}s: '
             f'{names[0]} {before[0]} - {names[1]} {before[1]}.']
    goal_lines = 0
    for g in timeline.get('goals', []):
        if start - 10 <= g['hud_changed_at'] <= end + GOAL_LAG_BEFORE:
            goal_lines += 1
            lines.append(f"Goal for {g['team']}: score row changed between {g['window'][0]:.0f}s and "
                         f"{g['window'][1]:.0f}s (score then {g['score_after'][0]}-{g['score_after'][1]}).")
    for p in timeline.get('power_plays', []):
        if p['start'] <= end and p['end'] >= start:
            lines.append(f"{p['team']} power play banner visible {p['start']:.0f}-{p['end']:.0f}s.")
    if not goal_lines:
        lines.append('No score change in this window: do not report a goal unless the score bug changes.')
    lines.append('SOG digits beside the score are shots on goal, not goals.')
    return '\n'.join(lines)
