"""Direct Gemini connection: gemini/<model> goes to Google with GEMINI_API_KEY; the rest is unchanged."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import worker

REVIEW = {'summary': 'S', 'tactical': {}, 'uncertainties': [], 'player_evaluations': [], 'observations': []}
ENV = {'OPENROUTER_API_KEY': 'or-key', 'AI_PROVIDER': 'openrouter', 'GEMINI_API_KEY': 'g-key',
       'VOD_MODEL_BASIC': 'gemini/gemini-test-flash', 'VOD_MODEL_DEEP': 'anthropic/claude-sonnet-5.5'}


def gemini_reply(text=None, finish='stop'):
    return {'choices': [{'message': {'content': json.dumps(REVIEW) if text is None else text},
                         'finish_reason': finish}],
            'usage': {'prompt_tokens': 1200, 'completion_tokens': 300}}


def list_types(node, found=None):
    found = [] if found is None else found
    if isinstance(node, dict):
        if isinstance(node.get('type'), list):
            found.append(node['type'])
        for value in node.values():
            list_types(value, found)
    elif isinstance(node, list):
        for value in node:
            list_types(value, found)
    return found


class GeminiDirect(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.frame = Path(self.tmp.name) / 'frame.jpg'
        self.frame.write_bytes(b'\xff\xd8fake-jpeg')
        self.sent = []

    def tearDown(self):
        self.tmp.cleanup()

    def run_analyze(self, replies, env=None, profile=None):
        def fake(url, headers, payload=None, deadline=None):
            self.sent.append((url, headers, payload))
            return replies[len(self.sent) - 1]
        base = {k: v for k, v in os.environ.items() if not k.startswith('VOD_') and k != 'GEMINI_REASONING_EFFORT'}
        base.update(env or ENV)
        with patch.dict(os.environ, base, clear=True), patch.object(worker, 'gm_profile', return_value=profile or {}), \
                patch.object(worker, 'ai_budget_gate'), patch.object(worker, 'http_json', side_effect=fake):
            try:
                return worker.analyze([self.frame], {'start': 0, 'end': 120}, {})
            except worker.Problem as exc:
                return exc

    def test_a_gemini_model_goes_to_google_with_the_gemini_key(self):
        result = self.run_analyze([gemini_reply()])
        self.assertEqual(result['summary'], 'S')
        self.assertEqual(result['model'], 'gemini/gemini-test-flash')
        url, headers, body = self.sent[0]
        self.assertEqual(url, worker.GEMINI_ENDPOINT)
        self.assertEqual(headers['Authorization'], 'Bearer g-key')  # never the OpenRouter key
        self.assertEqual(body['model'], 'gemini-test-flash')
        self.assertEqual(body['max_tokens'], 4800)  # same bounded cap, never raised
        self.assertEqual(body['reasoning_effort'], 'low')
        content = body['messages'][-1]['content']
        self.assertTrue(any(p['type'] == 'image_url' and p['image_url']['url'].startswith('data:image/jpeg;base64,')
                            for p in content))
        self.assertEqual(body['response_format']['type'], 'json_schema')
        self.assertEqual(list_types(body['response_format']['json_schema']['schema']), [])
        self.assertNotIn('input', body)
        self.assertNotIn('store', body)

    def test_profile_instructions_become_the_system_message(self):
        profile = {'provider': 'openrouter', 'model': 'x/y', 'instructions': 'GM rules.'}
        self.run_analyze([gemini_reply()], profile=profile)
        first = self.sent[0][2]['messages'][0]
        self.assertEqual(first['role'], 'system')
        self.assertIn('GM rules.', first['content'])

    def test_a_cut_off_gemini_answer_gets_one_shorter_retry_then_stops(self):
        result = self.run_analyze([gemini_reply(text='{"summary": "cut', finish='length')] * 3)
        self.assertIsInstance(result, worker.Problem)
        self.assertEqual(result.code, 'output_cap')
        self.assertEqual(len(self.sent), 2)
        self.assertEqual([s[2]['max_tokens'] for s in self.sent], [4800, 4800])

    def test_reasoning_effort_can_be_turned_off_or_changed(self):
        self.run_analyze([gemini_reply()], env={**ENV, 'GEMINI_REASONING_EFFORT': 'off'})
        self.assertNotIn('reasoning_effort', self.sent[0][2])
        self.sent.clear()
        self.run_analyze([gemini_reply()], env={**ENV, 'GEMINI_REASONING_EFFORT': 'none'})
        self.assertEqual(self.sent[0][2]['reasoning_effort'], 'none')

    def test_missing_gemini_key_is_a_clear_error_and_nothing_is_sent(self):
        env = {k: v for k, v in ENV.items() if k != 'GEMINI_API_KEY'}
        result = self.run_analyze([gemini_reply()], env=env)
        self.assertEqual((result.status, result.code), (503, 'model_unavailable'))
        self.assertEqual(self.sent, [])

    @unittest.skipIf(os.name == 'nt', 'Windows environment names are case-insensitive; exact-case precedence requires Linux.')
    def test_the_key_works_under_a_different_capitalisation_of_its_name(self):
        env = {k: v for k, v in ENV.items() if k != 'GEMINI_API_KEY'}
        self.run_analyze([gemini_reply()], env={**env, 'Gemini_api_key': 'mixed-case-key'})
        self.assertEqual(self.sent[0][1]['Authorization'], 'Bearer mixed-case-key')
        self.sent.clear()
        self.run_analyze([gemini_reply()], env={**ENV, 'Gemini_api_key': 'other'})
        self.assertEqual(self.sent[0][1]['Authorization'], 'Bearer g-key')  # exact name wins

    def test_other_models_still_use_the_configured_provider(self):
        result = self.run_analyze([{'status': 'completed', 'output': [{'content': [
            {'type': 'output_text', 'text': json.dumps(REVIEW)}]}]}],
            env={**ENV, 'VOD_MODEL_BASIC': 'anthropic/claude-sonnet-5.5'})
        self.assertEqual(result['summary'], 'S')
        url, headers, body = self.sent[0]
        self.assertEqual(url, 'https://openrouter.ai/api/v1/responses')
        self.assertEqual(headers['Authorization'], 'Bearer or-key')
        self.assertEqual(body['model'], 'anthropic/claude-sonnet-5.5')

    def test_usage_is_recorded_from_gemini_token_counts(self):
        with patch.object(worker, 'ai_usage_record') as record:
            self.run_analyze([gemini_reply()])
        usage = record.call_args.args[0]['usage']
        self.assertEqual((usage['input_tokens'], usage['output_tokens']), (1200, 300))
        self.assertEqual(record.call_args.kwargs['model'], 'gemini/gemini-test-flash')

    def test_report_text_requests_convert_too(self):
        payload = {'store': False, 'max_output_tokens': 5000, 'instructions': 'rules',
                   'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': 'evidence'}]}],
                   'text': {'format': {'type': 'json_schema', 'name': 'r', 'strict': True,
                                       'schema': {'type': 'object', 'properties': {
                                           'score': {'type': ['number', 'null']}}}}}}
        body = worker.gemini_request('gemini/g-test', payload)
        self.assertEqual(body['messages'][1]['content'], [{'type': 'text', 'text': 'evidence'}])
        self.assertEqual(body['response_format']['json_schema']['schema']['properties']['score'],
                         {'anyOf': [{'type': 'number'}, {'type': 'null'}]})
        self.assertEqual(body['max_tokens'], 5000)


if __name__ == '__main__':
    unittest.main()


class TwoBrainKeys(unittest.TestCase):
    """GEMINI_DEEP_API_KEY powers only the deep model; the basic model keeps GEMINI_API_KEY."""
    ENV = {'GEMINI_API_KEY': 'basic-key', 'GEMINI_DEEP_API_KEY': 'argon-key',
           'VOD_MODEL_BASIC': 'gemini/gemini-3.8-flash', 'VOD_MODEL_DEEP': 'gemini/gemini-4-argon'}

    def key(self, model, env):
        with patch.dict(os.environ, env, clear=True):
            return worker.gemini_api_key(model)

    def test_deep_model_uses_the_deep_key(self):
        self.assertEqual(self.key('gemini/gemini-4-argon', self.ENV), 'argon-key')

    def test_basic_model_keeps_the_regular_key(self):
        self.assertEqual(self.key('gemini/gemini-3.8-flash', self.ENV), 'basic-key')

    def test_without_a_deep_key_everything_uses_the_regular_key(self):
        env = {k: v for k, v in self.ENV.items() if k != 'GEMINI_DEEP_API_KEY'}
        self.assertEqual(self.key('gemini/gemini-4-argon', env), 'basic-key')

    def test_deep_key_name_is_case_tolerant(self):
        env = {k: v for k, v in self.ENV.items() if k != 'GEMINI_DEEP_API_KEY'}
        env['Gemini_deep_api_key'] = 'mixed-case'
        self.assertEqual(self.key('gemini/gemini-4-argon', env), 'mixed-case')


class AgentPlatformDeepBrain(unittest.TestCase):
    """A Google Cloud ("AQ.") deep key sends VOD_MODEL_DEEP to Agent Platform in native format."""
    ENV = {'OPENROUTER_API_KEY': 'or-key', 'AI_PROVIDER': 'openrouter',
           'GEMINI_API_KEY': 'AIza-basic', 'GEMINI_DEEP_API_KEY': 'AQ.deep-key',
           'VOD_MODEL_BASIC': 'gemini/gemini-3.8-flash', 'VOD_MODEL_DEEP': 'gemini/gemini-4-argon'}
    PAYLOAD = {'instructions': 'You are the analyst.', 'max_output_tokens': 5000,
               'input': [{'role': 'user', 'content': [
                   {'type': 'input_text', 'text': 'Break down the period.'},
                   {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,QUJD'}]}],
               'text': {'format': {'type': 'json_schema', 'name': 'r', 'schema': {'type': 'object'}}}}

    @staticmethod
    def native_reply(text='{"ok": true}', finish='STOP'):
        return {'candidates': [{'content': {'parts': [{'text': 'hmm', 'thought': True}, {'text': text}]},
                                'finishReason': finish}],
                'usageMetadata': {'promptTokenCount': 900, 'candidatesTokenCount': 120, 'thoughtsTokenCount': 400}}

    def call(self, model, replies, env=None):
        sent = []

        def fake(url, headers, payload=None, deadline=None):
            sent.append((url, headers, json.loads(json.dumps(payload))))
            return replies[len(sent) - 1]
        with patch.dict(os.environ, env or self.ENV, clear=True), patch.object(worker, 'gm_profile', return_value={}), \
                patch.object(worker, 'ai_budget_gate'), patch.object(worker, 'ai_usage_record'), \
                patch.object(worker, 'http_json', side_effect=fake):
            return worker.request_ai(dict(self.PAYLOAD), model=model), sent

    def test_deep_model_goes_to_agent_platform_natively(self):
        result, sent = self.call('gemini/gemini-4-argon', [self.native_reply()])
        url, headers, body = sent[0]
        self.assertTrue(url.startswith('https://aiplatform.googleapis.com/'))
        self.assertTrue(url.endswith('/gemini-4-argon:generateContent'))
        self.assertEqual(headers['x-goog-api-key'], 'AQ.deep-key')
        self.assertNotIn('Authorization', headers)
        self.assertEqual(body['systemInstruction']['parts'][0]['text'], 'You are the analyst.')
        self.assertEqual(body['contents'][0]['parts'][1]['inlineData'], {'mimeType': 'image/jpeg', 'data': 'QUJD'})
        config = body['generationConfig']
        self.assertEqual(config['thinkingConfig'], {'thinkingLevel': 'MEDIUM'})
        self.assertGreater(config['maxOutputTokens'], 5000)
        self.assertEqual(config['responseMimeType'], 'application/json')
        for banned in ('temperature', 'topP', 'topK', 'thinkingBudget', 'candidateCount'):
            self.assertNotIn(banned, config)
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['output'][0]['content'][0]['text'], '{"ok": true}')  # thoughts dropped
        self.assertEqual(result['usage']['output_tokens'], 520)

    def test_basic_model_stays_on_ai_studio(self):
        reply = {'choices': [{'message': {'content': '{"ok": true}'}, 'finish_reason': 'stop'}], 'usage': {}}
        _, sent = self.call('gemini/gemini-3.8-flash', [reply])
        self.assertEqual(sent[0][0], worker.GEMINI_ENDPOINT)
        self.assertEqual(sent[0][1]['Authorization'], 'Bearer AIza-basic')

    def test_cut_off_answer_retries_with_a_bigger_native_cap(self):
        result, sent = self.call('gemini/gemini-4-argon',
                                 [self.native_reply('', 'MAX_TOKENS'), self.native_reply()])
        first = sent[0][2]['generationConfig']['maxOutputTokens']
        second = sent[1][2]['generationConfig']['maxOutputTokens']
        self.assertGreater(second, first)
        self.assertEqual(result['status'], 'completed')

    def test_thinking_level_is_configurable(self):
        env = {**self.ENV, 'GEMINI_DEEP_THINKING': 'high'}
        _, sent = self.call('gemini/gemini-4-argon', [self.native_reply()], env=env)
        self.assertEqual(sent[0][2]['generationConfig']['thinkingConfig'], {'thinkingLevel': 'HIGH'})

    def test_platform_can_be_forced_to_ai_studio(self):
        env = {**self.ENV, 'GEMINI_DEEP_PLATFORM': 'studio'}
        reply = {'choices': [{'message': {'content': '{"ok": true}'}, 'finish_reason': 'stop'}], 'usage': {}}
        _, sent = self.call('gemini/gemini-4-argon', [reply], env=env)
        self.assertEqual(sent[0][0], worker.GEMINI_ENDPOINT)
