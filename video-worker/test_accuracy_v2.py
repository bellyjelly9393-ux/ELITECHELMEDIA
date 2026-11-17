"""Worker accuracy v2: HUD reader, game-state validators, roster sheet, period proposals,
escalation routing, spend caps and corrections. Every model call is mocked."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import accuracy
import corrections
import game_state
import hud_reader
import roster
import worker

ENV = {'OPENAI_API_KEY': 'k', 'OPENAI_MODEL': 'm', 'AI_PROVIDER': 'openai'}
V2_FLAGS = ('VOD_HUD_READER', 'VOD_HUD_PROMPT', 'VOD_HUD_VALIDATION', 'VOD_HUD_PERIODS', 'VOD_ROSTER_SHEET',
            'VOD_ESCALATION', 'VOD_PREMIUM_MODEL', 'VOD_CROSSCHECK_MODEL', 'VOD_SPOTCHECK_MODEL',
            'VOD_SPOTCHECK_TEAMS', 'VOD_SPOTCHECK_MAX_CALLS_PER_GAME', 'VOD_SPOTCHECK_MAX_USD_PER_GAME',
            'VOD_MAX_USD_PER_GAME', 'VOD_COST_LOG', 'VOD_CORRECTIONS_FEWSHOT', 'VOD_CORRECTIONS_FILE')


def clean_env(**extra):
    env = {k: v for k, v in os.environ.items() if k not in V2_FLAGS}
    env.update(extra)
    return patch.dict(os.environ, env, clear=True)


# ---------------------------------------------------------------- synthetic HUD reads
def glyph(value):
    """Distinct fake signatures: 384 cells + aspect."""
    cells = [0.0] * 384
    for i in range(value * 40, value * 40 + 40):
        cells[i % 384] = 1.0
    return cells + [0.5]


ABBR1, ABBR2 = glyph(7), glyph(8)


def read(at, s1=0, s2=0, clock=600.0, pp_row=None, visible=True):
    sig = {'abbr1': ABBR1, 'abbr2': ABBR2, 'score1': glyph(s1), 'score2': glyph(s2), 'period': glyph(9)} \
        if visible else {'abbr1': None, 'abbr2': None, 'score1': None, 'score2': None, 'period': None}
    return {'at': float(at), 'abbr': ['LET', 'CGY'] if visible else [None, None], 'sog': [None, None],
            'clock': clock if visible else None, 'pp_row': pp_row if visible else None,
            'pp_kind': 'power_play' if pp_row is not None else None, 'pp_left': None, 'sig': sig, 'raw': {}}


def lethbridge_like():
    """P1 faceoff ~398, fake-goal moment at 442 with no score change, LET goal ~570,
    CGY PP 630-660, P2 faceoff ~814."""
    reads = []
    for at in range(397, 400, 2):
        reads.append(read(at, clock=1200.0))
    for at in range(401, 567, 2):
        reads.append(read(at, clock=1200.0 - (at - 397) * 5))
    for at in range(569, 589, 2):
        reads.append(read(at, visible=False))          # GOAL banner / replay
    for at in range(589, 630, 2):
        reads.append(read(at, s1=1))
    for at in range(631, 661, 2):
        reads.append(read(at, s1=1, pp_row=1))          # banner on the CGY (bottom) row
    for at in range(661, 740, 2):
        reads.append(read(at, s1=1, clock=20.0))
    for at in range(741, 805, 2):
        reads.append(read(at, visible=False))          # intermission
    for at in range(805, 815, 2):
        reads.append(read(at, s1=1, clock=1200.0))
    for at in range(815, 900, 2):
        reads.append(read(at, s1=1, clock=1150.0))
    return reads


class ParsersAndImages(unittest.TestCase):
    def test_clock_formats(self):
        self.assertEqual(hud_reader.parse_clock('16:41'), 1001.0)
        self.assertEqual(hud_reader.parse_clock(':32.8'), 32.8)
        self.assertEqual(hud_reader.parse_clock('20:00'), 1200.0)
        self.assertIsNone(hud_reader.parse_clock('18:68'))
        self.assertIsNone(hud_reader.parse_clock('21:00'))

    def test_power_play_banner_text(self):
        self.assertEqual(hud_reader.parse_pp('POWER PLAY 2:00'), ('power_play', 120))
        self.assertEqual(hud_reader.parse_pp('POWERFLAT290')[0], 'power_play')
        self.assertIsNone(hud_reader.parse_pp('KEEP PLAYING'.replace('PLAY', 'PL4Y')))

    def test_pgm_roundtrip_crop_and_signature(self):
        with tempfile.TemporaryDirectory() as tmp:
            width, height = 40, 20
            pixels = bytearray([20] * (width * height))
            for y in range(5, 15):
                for x in range(10, 18):
                    pixels[y * width + x] = 230      # a light glyph on a dark panel
            path = Path(tmp) / 'a.pgm'
            hud_reader.write_pgm(path, width, height, pixels)
            image = hud_reader.read_pgm(path)
            self.assertEqual(image[:2], (40, 20))
            binary = hud_reader.binarize(image, dark_text=False, pad=0, major_only=True)
            self.assertEqual(binary[:2], (8, 10))
            same = hud_reader.signature(binary)
            self.assertLess(hud_reader.sig_distance(same, same), 0.01)
            other = hud_reader.signature(hud_reader.binarize(hud_reader.crop(image, (0, 0, 14, 20)), dark_text=False))
            self.assertGreater(hud_reader.sig_distance(same, other), 0.15)

    def test_layout_override_from_env(self):
        with clean_env(VOD_HUD_LAYOUT_JSON=json.dumps({'clock': [0.1, 0.1, 0.2, 0.2]})):
            self.assertEqual(hud_reader.layout()['clock'], (0.1, 0.1, 0.2, 0.2))
            self.assertEqual(hud_reader.layout()['score1'], hud_reader.DEFAULT_LAYOUT['score1'])


class Timeline(unittest.TestCase):
    def setUp(self):
        self.timeline = game_state.build_timeline(lethbridge_like())

    def test_goal_from_score_change_and_team_from_row(self):
        goals = self.timeline['goals']
        self.assertEqual(len(goals), 1)
        self.assertEqual(goals[0]['team'], 'LET')
        self.assertEqual(goals[0]['score_after'], [1, 0])
        self.assertEqual(goals[0]['window'], [565.0, 589.0])
        self.assertEqual(self.timeline['final_score'], {'LET': 1, 'CGY': 0})

    def test_one_frame_glitch_is_not_a_goal(self):
        reads = lethbridge_like()
        reads[20] = dict(reads[20], sig=dict(reads[20]['sig'], score2=glyph(3)))
        self.assertEqual(len(game_state.build_timeline(reads)['goals']), 1)

    def test_power_play_belongs_to_the_banner_row(self):
        pps = self.timeline['power_plays']
        self.assertEqual([(p['team'], p['start'], p['end']) for p in pps], [('CGY', 631.0, 659.0)])

    def test_period_faceoffs_from_clock_at_20_00(self):
        starts = self.timeline['period_starts']
        self.assertEqual([(s['period'], s['faceoff']) for s in starts], [(1, 400.0), (2, 814.0)])
        self.assertIsNone(game_state.proposed_periods(self.timeline, 2000))
        three = dict(self.timeline, period_starts=starts + [{'period': 3, 'label': 'Period 3', 'faceoff': 1270.0}])
        ranges = game_state.proposed_periods(three, 2000)
        self.assertEqual([(r['label'], r['start']) for r in ranges],
                         [('Period 1', 398.0), ('Period 2', 812.0), ('Period 3', 1268.0)])

    def test_team_names_fuzzy_matched_to_known_abbreviations(self):
        reads = [dict(r, abbr=['LET', 'CAY']) for r in lethbridge_like()]
        self.assertEqual(game_state.build_timeline(reads, known_teams=['CGY', 'LET', 'MJ'])['teams'], ['LET', 'CGY'])

    def test_part_merge_keeps_period_numbering(self):
        part = game_state.build_timeline(lethbridge_like()[-50:], teams=['LET', 'CGY'], initial_score=[1, 0], offset=500)
        merged = game_state.merge(self.timeline, part)
        self.assertEqual([s['period'] for s in merged['period_starts']], [1, 2, 3])


class Validators(unittest.TestCase):
    aliases = {'CGY': ['Calgary', 'Hitmen'], 'LET': ['Lethbridge']}

    def setUp(self):
        self.timeline = game_state.build_timeline(lethbridge_like())

    def check(self, timestamp, note):
        return game_state.validate_observation({'timestamp': timestamp, 'note': note, 'category': 'offense'},
                                               self.timeline, self.aliases)

    def test_fake_goal_at_442_is_flagged(self):
        result = self.check(442, 'Calgary scores to make it 1-0')
        self.assertEqual(result['hud_check'], 'goal_not_on_hud')
        self.assertTrue(result['needs_human_review'])

    def test_goal_credited_to_the_wrong_team(self):
        self.assertEqual(self.check(566, 'Hitmen goal from the slot')['hud_check'], 'goal_team_conflict')
        ok = self.check(566, 'Lethbridge scores from the slot')
        self.assertEqual((ok['hud_check'], ok['hud_team']), ('goal_confirmed', 'LET'))

    def test_reversed_power_play(self):
        self.assertEqual(self.check(640, 'Lethbridge power play entry')['hud_check'], 'pp_team_conflict')
        self.assertEqual(self.check(640, 'Calgary power play entry')['hud_check'], 'pp_confirmed')
        self.assertEqual(self.check(640, 'Lethbridge penalty kill clears')['hud_check'], 'pp_confirmed')

    def test_non_claims_are_untouched(self):
        self.assertEqual(self.check(450, 'Goalie makes a save on the rush')['hud_check'], 'not_applicable')
        self.assertEqual(self.check(450, 'Good gap control at the blue line')['hud_check'], 'not_applicable')

    def test_enforce_moves_disproved_goal_out_flag_only_annotates(self):
        def review():
            return {'observations': [{'timestamp': 442, 'note': 'Calgary scores', 'category': 'offense'},
                                     {'timestamp': 450, 'note': 'Strong forecheck', 'category': 'forecheck'}],
                    'uncertainties': []}
        flagged = game_state.apply_validation(review(), self.timeline, 'flag', self.aliases)
        self.assertEqual(len(flagged['observations']), 2)
        self.assertEqual(flagged['observations'][0]['verification'], 'needs_human_review')
        enforced = game_state.apply_validation(review(), self.timeline, 'enforce', self.aliases)
        self.assertEqual([o['timestamp'] for o in enforced['observations']], [450])
        self.assertIn('Rejected by HUD', enforced['uncertainties'][0])
        self.assertIs(game_state.apply_validation(review(), self.timeline, 'off')['observations'][0].get('hud_check'), None)

    def test_structured_events(self):
        conflicts = game_state.validate_structured_event
        self.assertEqual(conflicts({'event_type': 'goal', 'absolute_ts': 442, 'team': 'CGY',
                                    'score_state': {'LET': 0, 'CGY': 1}}, self.timeline), ['fake_goal', 'score_state'])
        self.assertEqual(conflicts({'event_type': 'goal_scorer_card', 'absolute_ts': 575, 'team': 'CGY'}, self.timeline),
                         ['goal_team'])
        self.assertEqual(conflicts({'event_type': 'penalty', 'absolute_ts': 625,
                                    'manpower_state': {'advantaged_team': 'LET'}}, self.timeline), ['reversed_pp'])
        self.assertEqual(conflicts({'event_type': 'shot', 'absolute_ts': 436,
                                    'score_state': {'LET': 0, 'CGY': 0}}, self.timeline), [])

    def test_hud_facts_for_prompt(self):
        text = game_state.hud_facts(self.timeline, 420, 540)
        self.assertIn('LET 0 - CGY 0', text)
        self.assertIn('SOG digits', text)
        self.assertIn('Goal for LET', text)  # the change lands within the look-ahead
        self.assertIn('CGY power play', game_state.hud_facts(self.timeline, 600, 700))


class RosterSheet(unittest.TestCase):
    meta = {'players': 'G Kudolken, C l Setty l, RD D. Swish Reemer, LD N. EL, RW C. Geo, LW F. Ofguidice',
            'opponent_players': 'LW GET PUCKED, RW FORMENTON, C LOW CORTISOL, G AL JENKINS',
            'roster_aliases': 'P. KELLS = l Setty l'}

    def test_sheet_and_prompt(self):
        sheet = roster.build_sheet(self.meta)
        self.assertEqual(len(sheet['ours']), 6)
        self.assertEqual(len(sheet['opponent']), 4)
        prompt = roster.roster_prompt(sheet)
        self.assertIn('C l Setty l (in-game: P. KELLS)', prompt)
        self.assertIn('AL JENKINS (opponent)', prompt)

    def test_matching_and_filtering(self):
        sheet = roster.build_sheet(self.meta)
        self.assertEqual(roster.match_player('P. Kells', sheet)['name'], 'l Setty l')
        self.assertEqual(roster.match_player('Jenkins', sheet)['name'], 'AL JENKINS')
        self.assertIsNone(roster.match_player('TUFFGUN', sheet))
        review = {'observations': [{'timestamp': 1, 'player': 'P. KELLS'}, {'timestamp': 2, 'player': 'Koller'}],
                  'player_evaluations': [{'player': 'Koller'}, {'player': 'Kudolken'}], 'uncertainties': []}
        out = roster.filter_review(json.loads(json.dumps(review)), sheet, 'null')
        self.assertEqual([o['player'] for o in out['observations']], ['l Setty l', None])
        self.assertEqual(out['observations'][1]['player_unverified'], 'Koller')
        self.assertEqual([p['player'] for p in out['player_evaluations']], ['Kudolken'])
        flagged = roster.filter_review(json.loads(json.dumps(review)), sheet, 'flag')
        self.assertEqual(flagged['observations'][1]['player'], 'Koller')
        self.assertEqual(flagged['observations'][1]['verification'], 'needs_human_review')

    def test_no_roster_means_no_change(self):
        review = {'observations': [{'player': 'Anyone'}], 'player_evaluations': []}
        self.assertEqual(roster.filter_review(dict(review), roster.build_sheet({}), 'null'), review)


class Corrections(unittest.TestCase):
    def test_metadata_and_file_newest_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'c.jsonl'
            path.write_text(json.dumps({'kind': 'goal', 'wrong': 'CGY goal at 442', 'right': 'no goal (SOG 0-1)',
                                        'created_at': '2026-10-17'}) + '\nnot json\n')
            items = corrections.load({'corrections': [{'kind': 'pp', 'wrong': 'LET PP', 'right': 'CGY PP',
                                                       'created_at': '2026-10-18'}]}, path=str(path), limit=5)
        self.assertEqual([c['kind'] for c in items], ['pp', 'goal'])
        text = corrections.fewshot_prompt(items)
        self.assertIn('AI said: LET PP | Correct: CGY PP', text)
        self.assertEqual(corrections.fewshot_prompt([]), '')


class CostsAndCaps(unittest.TestCase):
    def setUp(self):
        accuracy.LEDGER.jobs.clear()

    def test_prices_match_model_ids(self):
        self.assertEqual(accuracy.price_for('gemini/gemini-4-argon'), (2.0, 10.0))
        self.assertEqual(accuracy.price_for('google/gemini-3-flash-preview'), (0.5, 3.0))
        self.assertEqual(accuracy.price_for('openai/gpt-6-astra'), (10.0, 50.0))
        self.assertEqual(accuracy.estimate_cost('deepseek/deepseek-v4.1-flash', 1_000_000, 0), 0.04)
        self.assertIsNone(accuracy.price_for('unknown/model'))

    def test_per_game_cap_blocks_before_the_call(self):
        payload = {'input': [{'content': [{'type': 'input_image'}] * 10}], 'max_output_tokens': 900}
        with clean_env(VOD_MAX_USD_PER_GAME='0.05'):
            accuracy.LEDGER.record('job', 'm', 0.04)
            with self.assertRaises(accuracy.SpendCapReached):
                accuracy.cost_gate('job', 'gemini/gemini-4-argon', payload)
        with clean_env():
            accuracy.cost_gate('job', 'gemini/gemini-4-argon', payload)  # no cap set: never blocks

    def test_spotcheck_has_its_own_call_and_dollar_caps(self):
        payload = {'input': [{'content': [{'type': 'input_image'}] * 6}], 'max_output_tokens': 900}
        with clean_env(VOD_SPOTCHECK_MAX_CALLS_PER_GAME='1', VOD_SPOTCHECK_MAX_USD_PER_GAME='5'):
            accuracy.cost_gate('g', 'openai/gpt-6-astra', payload, 'verify_spotcheck')
            accuracy.LEDGER.record('g', 'openai/gpt-6-astra', 0.05, 'spotcheck')
            with self.assertRaises(accuracy.SpendCapReached):
                accuracy.cost_gate('g', 'openai/gpt-6-astra', payload, 'verify_spotcheck')
        with clean_env(VOD_SPOTCHECK_MAX_USD_PER_GAME='0.10'):
            with self.assertRaises(accuracy.SpendCapReached):   # worst case ~$0.68 > $0.10
                accuracy.cost_gate('h', 'openai/gpt-6-astra', payload, 'verify_spotcheck')

    def test_request_ai_respects_the_cap_and_logs_cost(self):
        sent = []
        def fake(url, headers, payload):
            sent.append(payload)
            return {'status': 'completed', 'usage': {'input_tokens': 1000, 'output_tokens': 100},
                    'output': [{'content': [{'type': 'output_text', 'text': '{}'}]}]}
        with clean_env(**ENV, VOD_MAX_USD_PER_GAME='0.001'), patch.object(worker, 'gm_profile', return_value=None), \
                patch.object(worker, 'ai_budget_gate'), patch.object(worker, 'http_json', side_effect=fake):
            worker._CTX.job_id = 'capjob'
            try:
                with self.assertRaises(worker.Problem) as ctx:
                    worker.request_ai({'input': [{'content': [{'type': 'input_text', 'text': 'x' * 30000}]}]},
                                      model='gemini-4-argon-test')
            finally:
                worker._CTX.job_id = None
        self.assertEqual(ctx.exception.code, 'ai_budget')
        self.assertEqual(sent, [])


def verdict(event_type, team=None):
    return {'status': 'completed', 'output': [{'content': [{'type': 'output_text', 'text': json.dumps(
        {'event_type': event_type, 'team': team, 'player': None, 'confidence': 0.9, 'evidence': 'HUD'})}]}]}


class Escalation(unittest.TestCase):
    def setUp(self):
        accuracy.LEDGER.jobs.clear()
        self.timeline = game_state.build_timeline(lethbridge_like())
        self.chunks = [{'start': 380, 'end': 700, 'review': {'observations': [
            {'timestamp': 442, 'note': 'Calgary scores!', 'category': 'offense', 'source': 'gameplay'},
            {'timestamp': 470, 'note': 'Neutral-zone regroup', 'category': 'transition', 'source': 'gameplay'}]}}]

    def run_with(self, answers, metadata=None, **env):
        calls = []
        def request(step, model, payload):
            calls.append((step, model))
            return answers[(step, model)] if (step, model) in answers else verdict('unclear')
        with clean_env(VOD_ESCALATION='1', VOD_MODEL_DEEP='gemini/gemini-4-argon', **env):
            out = accuracy.run_escalation('job', self.chunks, metadata or {}, self.timeline,
                                          lambda a, b: ['data:image/jpeg;base64,AA=='] * 3, request)
        return out, calls

    def test_premium_defaults_to_the_existing_deep_model(self):
        out, calls = self.run_with({})
        self.assertTrue(calls)
        self.assertTrue(all(model == 'gemini/gemini-4-argon' for _, model in calls))
        kinds = sorted((m['kind'], m['origin']) for m in out)
        self.assertEqual(kinds, [('goal', 'hud'), ('goal', 'model'), ('penalty', 'hud')])

    def test_reconciliation_never_guesses(self):
        premium = ('verify_premium', 'gemini/gemini-4-argon')
        out, _ = self.run_with({premium: verdict('goal', 'CGY')})
        by_at = {m['at']: m for m in out}
        # The 442 'goal': premium agrees with the screener, the HUD does not -> human review.
        self.assertEqual(by_at[442.0]['status'], 'needs_human_review')
        # The real goal: premium says CGY, the HUD row says LET -> human review, no team chosen.
        real = next(m for m in out if m['origin'] == 'hud' and m['kind'] == 'goal')
        self.assertEqual(real['status'], 'needs_human_review')
        self.assertIsNone(real['team'])

    def test_agreement_is_verified_with_the_hud_team(self):
        def answers(step, model, payload):
            text = payload['input'][0]['content'][0]['text']
            if 'a goal' in text and 'second 442' in text:
                return verdict('no_event')
            if 'a goal' in text:
                return verdict('goal', 'LET')
            return verdict('power_play', 'CGY')
        with clean_env(VOD_ESCALATION='1', VOD_MODEL_DEEP='gemini/gemini-4-argon'):
            out = accuracy.run_escalation('job', self.chunks, {}, self.timeline,
                                          lambda a, b: ['data:image/jpeg;base64,AA=='], answers)
        status = {(m['kind'], m['at']): (m['status'], m['team']) for m in out}
        self.assertEqual(status[('goal', 442.0)], ('rejected', None))
        self.assertEqual(status[('goal', 565.0)], ('verified', 'LET'))
        self.assertEqual(status[('penalty', 631.0)], ('verified', 'CGY'))

    def test_spotcheck_only_for_hitmen_games_and_capped(self):
        env = {'VOD_SPOTCHECK_MODEL': 'openai/gpt-6-astra', 'VOD_SPOTCHECK_MAX_USD_PER_GAME': '5',
               'VOD_SPOTCHECK_MAX_CALLS_PER_GAME': '2'}
        _, calls = self.run_with({}, **env)                     # HUD rows are LET / CGY -> Hitmen game
        self.assertEqual(sum(step == 'verify_spotcheck' for step, _ in calls), 2)
        other = game_state.build_timeline([dict(r, abbr=['MJ', 'RDR']) for r in lethbridge_like()])
        self.timeline = other
        _, calls = self.run_with({}, **env)
        self.assertEqual(sum(step == 'verify_spotcheck' for step, _ in calls), 0)

    def test_crosscheck_runs_on_goals_and_penalties(self):
        _, calls = self.run_with({}, VOD_CROSSCHECK_MODEL='deepseek/deepseek-v4.1-flash')
        self.assertEqual(sum(step == 'verify_crosscheck' for step, _ in calls), 3)

    def test_off_by_default(self):
        with clean_env(VOD_MODEL_DEEP='gemini/gemini-4-argon'):
            self.assertEqual(accuracy.run_escalation('job', self.chunks, {}, self.timeline,
                                                     lambda a, b: [], lambda *a: self.fail('called')), [])


class WorkerIntegration(unittest.TestCase):
    meta = {'players': 'C l Setty l, G Kudolken', 'opponent_players': 'G AL JENKINS'}

    def analyze(self, observations, env, job='intjob', timeline=None):
        sent = []
        review = {'summary': 'S', 'tactical': {}, 'uncertainties': [], 'player_evaluations': [],
                  'observations': observations}
        def fake(url, headers, payload):
            sent.append(payload)
            return {'status': 'completed', 'output': [{'content': [{'type': 'output_text', 'text': json.dumps(review)}]}]}
        with clean_env(**ENV, **env), patch.object(worker, 'gm_profile', return_value=None), \
                patch.object(worker, 'ai_budget_gate'), patch.object(worker, 'http_json', side_effect=fake):
            worker._CTX.job_id = job
            worker._HUD_TIMELINES[job] = timeline
            try:
                return worker.analyze([], {'start': 380, 'end': 500}, dict(self.meta)), sent
            finally:
                worker._CTX.job_id = None
                worker._HUD_TIMELINES.pop(job, None)

    def obs(self):
        return [{'timestamp': 442, 'source': 'gameplay', 'category': 'offense', 'impact': 'positive',
                 'note': 'Calgary scores', 'player': 'TUFFGUN'}]

    def test_flags_off_prompt_and_output_are_unchanged(self):
        timeline = game_state.build_timeline(lethbridge_like())
        result, sent = self.analyze(self.obs(), {}, timeline=timeline)
        text = sent[0]['input'][0]['content'][0]['text']
        self.assertNotIn('ROSTER SHEET', text)
        self.assertNotIn('HUD (deterministic', text)
        self.assertNotIn('hud_check', result['observations'][0])
        self.assertEqual(result['observations'][0]['player'], 'TUFFGUN')

    def test_flags_on(self):
        timeline = game_state.build_timeline(lethbridge_like())
        result, sent = self.analyze(self.obs(), {'VOD_ROSTER_SHEET': 'null', 'VOD_HUD_PROMPT': '1',
                                                 'VOD_HUD_VALIDATION': 'enforce'}, timeline=timeline)
        text = sent[0]['input'][0]['content'][0]['text']
        self.assertIn('ROSTER SHEET', text)
        self.assertIn('HUD (deterministic', text)
        self.assertEqual(result['observations'], [])
        self.assertTrue(any('Rejected by HUD' in u for u in result['uncertainties']))

    def test_health_reports_flags_without_secrets(self):
        with clean_env(VOD_SPOTCHECK_MODEL='openai/gpt-6-astra', GEMINI_DEEP_API_KEY='secret-value'):
            text = json.dumps(accuracy.config())
        self.assertIn('gpt-6-astra', text)
        self.assertNotIn('secret-value', text)
        with clean_env():
            self.assertFalse(accuracy.any_enabled())
            self.assertEqual(accuracy.config()['hud_validation'], 'off')
            self.assertEqual(accuracy.config()['max_usd_per_game'], 0.0)


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('tesseract'), 'needs ffmpeg + tesseract')
class RealVideo(unittest.TestCase):
    def test_reader_runs_on_a_generated_clip_without_a_hud(self):
        with tempfile.TemporaryDirectory() as tmp:
            clip = Path(tmp) / 'clip.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                            'testsrc=size=640x360:rate=10', '-t', '6', '-pix_fmt', 'yuv420p', str(clip)], check=True)
            reads = hud_reader.read_video(clip, 0, 6, 2.0)
            self.assertEqual(len(reads), 3)
            timeline = game_state.build_timeline(reads)
            self.assertEqual(timeline['goals'], [])


if __name__ == '__main__':
    unittest.main()
