#!/usr/bin/env python3
"""Offline eval: HUD reader accuracy + how many benchmark hallucinations the validators catch.

No model calls. Needs ffmpeg + tesseract and (optionally) the benchmark-001 folder.
"""
import argparse
import csv
import glob
import json
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import game_state  # noqa: E402
import hud_reader  # noqa: E402

# Audited Lethbridge (LET) vs Calgary (CGY) 2026-10-13 timeline, abs seconds of
# v2900174947 (audit_lethbridge_2026-10-13_timestamps.md). Goals: the scoring moment.
AUDIT_GOALS = [('LET', 566), ('LET', 1052), ('LET', 1382), ('LET', 1496)]
AUDIT_PPS = [('CGY', 629), ('LET', 1035), ('LET', 1442)]  # 1442: Kells trip 1440-1446 -> LET PP
AUDIT_FACEOFFS = {1: 394, 2: 810, 3: 1266}
AUDIT_FINAL = {'LET': 4, 'CGY': 0}
PENALTY_TYPES = [('fabricated goal', 'fake_goal'), ('LET goal credited to CGY', 'goal_team'),
                 ('reversed PP', 'reversed_pp'), ('CGY goal implied by score', 'score_state'),
                 ('score', 'score_state')]


def classify(text):
    for prefix, kind in PENALTY_TYPES:
        if text.startswith(prefix):
            return kind
    return None


def hud_accuracy(reads, timeline, labels_path):
    by_at = {round(r['at']): r for r in reads}
    reference = game_state.learn_reference(reads)
    rows = list(csv.DictReader(open(labels_path)))
    stats = {'presence': [0, 0], 'score_when_visible': [0, 0], 'clock_exact': [0, 0],
             'clock_within_2s': [0, 0], 'pp_row': [0, 0]}
    misses = []
    for row in rows:
        at = int(row['at'])
        read = by_at.get(at)
        if read is None:
            continue
        truth = row['hud_present'] == '1'
        seen = game_state.present(read, reference)
        stats['presence'][1] += 1
        stats['presence'][0] += seen == truth
        if seen != truth:
            misses.append(f'presence@{at}: read={seen} label={truth} {row["note"]}')
        if not truth:
            continue
        score = game_state.score_at(timeline, at)
        want = [int(row['score_top']), int(row['score_bottom'])]
        stats['score_when_visible'][1] += 1
        stats['score_when_visible'][0] += score == want
        if score != want:
            misses.append(f'score@{at}: timeline={score} label={want}')
        if row['clock']:
            want_clock = hud_reader.parse_clock(row['clock'])
            stats['clock_exact'][1] += 1
            stats['clock_within_2s'][1] += 1
            got = read.get('clock')
            stats['clock_exact'][0] += got == want_clock
            stats['clock_within_2s'][0] += got is not None and abs(got - want_clock) <= 2
            if got is None or abs(got - want_clock) > 2:
                misses.append(f'clock@{at}: read={got} label={want_clock} raw={read["raw"].get("clock")!r}')
        want_pp = int(row['pp_row']) if row['pp_row'] else None
        stats['pp_row'][1] += 1
        stats['pp_row'][0] += read.get('pp_row') == want_pp
        if read.get('pp_row') != want_pp:
            misses.append(f'pp@{at}: read={read.get("pp_row")} label={want_pp}')
    return {k: {'correct': v[0], 'total': v[1], 'rate': round(v[0] / v[1], 3) if v[1] else None}
            for k, v in stats.items()}, misses


def timeline_vs_audit(timeline):
    goals = []
    for team, at in AUDIT_GOALS:
        hit = [g for g in timeline['goals'] if g['window'][0] - 5 <= at <= g['window'][1] + 5]
        goals.append({'audit_team': team, 'audit_at': at, 'hud_team': hit[0]['team'] if hit else None,
                      'hud_window': hit[0]['window'] if hit else None,
                      'ok': bool(hit) and hit[0]['team'] == team})
    pps = []
    for team, at in AUDIT_PPS:
        hit = game_state.pp_team_at(timeline, at, slack=20)
        pps.append({'audit_team': team, 'audit_at': at, 'hud_team': hit['team'] if hit else None,
                    'hud_span': [hit['start'], hit['end']] if hit else None, 'ok': bool(hit) and hit['team'] == team})
    periods = []
    for item in timeline['period_starts']:
        audit = AUDIT_FACEOFFS.get(item['period'])
        periods.append({'period': item['period'], 'hud_faceoff': item['faceoff'], 'audit_faceoff': audit,
                        'error_s': round(item['faceoff'] - audit, 1) if audit else None})
    extra_goals = [g for g in timeline['goals']
                   if not any(g['window'][0] - 5 <= at <= g['window'][1] + 5 for _, at in AUDIT_GOALS)]
    return {'goals': goals, 'unmatched_hud_goals': extra_goals, 'power_plays': pps,
            'all_hud_power_plays': timeline['power_plays'], 'periods': periods,
            'final_score': timeline['final_score'], 'final_ok': timeline['final_score'] == AUDIT_FINAL}


def latest_raw(folder, set_id):
    files = sorted(glob.glob(os.path.join(folder, f'*_{set_id}_try*.json')))
    for path in reversed(files):
        try:
            data = json.load(open(path))
        except ValueError:
            continue
        if isinstance(data.get('parsed'), (dict, list)):
            return data['parsed']
    return None


def events_of(parsed):
    if isinstance(parsed, list):
        parsed = parsed[0] if parsed and isinstance(parsed[0], dict) else {}
    return [e for e in (parsed or {}).get('events') or [] if isinstance(e, dict)]


def benchmark_catch(timeline, bench):
    scores = json.load(open(os.path.join(bench, 'results', 'scores_deterministic.json')))
    totals = {}
    detail = []
    false_flags = {}
    for key, value in scores.items():
        test, model = key.split('|', 1)
        folder = os.path.join(bench, 'results', 'raw', model.replace('/', '__'))
        penalised = {}
        for set_id, _, text in value.get('pen') or []:
            kind = classify(text)
            if kind:
                penalised.setdefault((set_id, kind), text)
        sets = sorted({p.split('_')[1] for p in os.listdir(folder) if p.startswith(test + '_')}) if os.path.isdir(folder) else []
        for set_id in sets:
            conflicts = set()
            for event in events_of(latest_raw(folder, set_id)):
                conflicts.update(game_state.validate_structured_event(event, timeline))
            for kind in conflicts:
                if (set_id, kind) not in penalised:
                    false_flags.setdefault(kind, []).append(f'{key} {set_id}')
            for (pid, kind), text in penalised.items():
                if pid != set_id:
                    continue
                caught = kind in conflicts
                bucket = totals.setdefault(kind, [0, 0])
                bucket[1] += 1
                bucket[0] += caught
                detail.append({'model': key, 'set': set_id, 'type': kind, 'penalty': text, 'caught': caught})
    return totals, detail, false_flags


def benchmark_clean_pass(timeline, bench):
    """Claims the HUD agrees with must pass untouched: count goal / power-play claims and flags."""
    out = {'goal_claims': 0, 'goal_claims_flagged': 0, 'pp_claims': 0, 'pp_claims_flagged': 0,
           'score_claims': 0, 'score_claims_flagged': 0}
    for folder in glob.glob(os.path.join(bench, 'results', 'raw', '*')):
        if os.path.basename(folder).startswith('judge'):
            continue
        set_ids = sorted({os.path.basename(p).split('_')[1] for p in glob.glob(os.path.join(folder, '*_try*.json'))})
        for set_id in set_ids:
            for event in events_of(latest_raw(folder, set_id)):
                conflicts = game_state.validate_structured_event(event, timeline)
                kind = str(event.get('event_type') or '').lower()
                if 'goal' in kind and not re.search(r'no_?goal|goalie|goal_?line|disallowed', kind):
                    out['goal_claims'] += 1
                    out['goal_claims_flagged'] += bool({'fake_goal', 'goal_team'} & set(conflicts))
                manpower = event.get('manpower_state') or {}
                if isinstance(manpower, dict) and str(manpower.get('advantaged_team') or '').upper() in timeline['teams']:
                    out['pp_claims'] += 1
                    out['pp_claims_flagged'] += 'reversed_pp' in conflicts
                state = event.get('score_state') or {}
                if isinstance(state, dict) and all(isinstance(state.get(n), (int, float)) for n in timeline['teams']):
                    out['score_claims'] += 1
                    out['score_claims_flagged'] += 'score_state' in conflicts
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vod', required=True)
    parser.add_argument('--start', type=float, default=380)
    parser.add_argument('--end', type=float, default=1760)
    parser.add_argument('--step', type=float, default=2.0)
    parser.add_argument('--labels', default=str(HERE / 'lethbridge_hud_labels.csv'))
    parser.add_argument('--benchmark', default='')
    parser.add_argument('--teams', default='LET,CGY', help='HUD rows top,bottom ("" = OCR + fuzzy)')
    parser.add_argument('--known', default='LET,CGY')
    parser.add_argument('--reads-cache', default='')
    parser.add_argument('--out', default='')
    args = parser.parse_args()

    started = time.time()
    if args.reads_cache and os.path.exists(args.reads_cache):
        reads = json.load(open(args.reads_cache))
    else:
        reads = hud_reader.read_video(args.vod, args.start, args.end, args.step)
        if args.reads_cache:
            json.dump(reads, open(args.reads_cache, 'w'))
    ocr_seconds = round(time.time() - started, 1)
    teams = [t.strip() for t in args.teams.split(',')] if args.teams else None
    timeline = game_state.build_timeline(reads, teams=teams, known_teams=args.known.split(','))
    report = {'vod': os.path.basename(args.vod), 'window': [args.start, args.end], 'step_seconds': args.step,
              'ocr_seconds': ocr_seconds, 'samples': len(reads), 'teams': timeline['teams'],
              'teams_from_ocr_only': game_state.build_timeline(reads, known_teams=args.known.split(','))['teams'],
              'hud_coverage': timeline['hud_coverage']}
    report['label_accuracy'], report['label_misses'] = hud_accuracy(reads, timeline, args.labels)
    report['vs_audit'] = timeline_vs_audit(timeline)
    # The benchmark's two headline checks.
    report['checks'] = {
        'score_at_434_442': [game_state.score_at(timeline, t) for t in (434, 438, 442)],
        'goal_between_430_460': [g for g in timeline['goals'] if 430 <= g['hud_changed_at'] <= 460 + 90],
        'pp_team_at_630': (game_state.pp_team_at(timeline, 630, slack=5) or {}).get('team'),
    }
    # The same three headline hallucinations written as worker observations (free text).
    aliases = {'CGY': ['Calgary', 'Hitmen'], 'LET': ['Lethbridge', 'Hurricanes']}
    samples = {
        'fake_goal_442': {'timestamp': 442, 'category': 'offense', 'note': 'Calgary scores to take a 1-0 lead.'},
        'let_goal_credited_to_cgy_568': {'timestamp': 568, 'category': 'offense',
                                         'note': 'Hitmen goal: a shot from the slot beats the goalie.'},
        'reversed_pp_630': {'timestamp': 630, 'category': 'special_teams',
                            'note': 'Lethbridge power play: entry on the left wall.'},
        'correct_let_goal_568': {'timestamp': 568, 'category': 'offense', 'note': 'Lethbridge scores from the slot.'},
        'correct_cgy_pp_630': {'timestamp': 630, 'category': 'special_teams', 'note': 'Calgary power play setup.'},
    }
    report['worker_observation_checks'] = {
        name: game_state.validate_observation(obs, timeline, aliases).get('hud_check') for name, obs in samples.items()}
    if args.benchmark:
        totals, detail, false_flags = benchmark_catch(timeline, args.benchmark)
        report['benchmark_catch'] = {k: {'caught': v[0], 'total': v[1]} for k, v in totals.items()}
        report['benchmark_catch_detail'] = detail
        report['benchmark_flags_without_penalty'] = false_flags
        report['benchmark_claims_checked'] = benchmark_clean_pass(timeline, args.benchmark)
    text = json.dumps(report, indent=1)
    if args.out:
        Path(args.out).write_text(text)
    print(text)


if __name__ == '__main__':
    main()
