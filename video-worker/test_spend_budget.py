import datetime
import sqlite3
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import spend_budget
import worker
from test_worker_reliability import Base


MODEL = 'gemini/gemini-3.8-flash'


class DollarBudget(Base):
    def setUp(self):
        super().setUp()
        self.prices = patch.object(spend_budget, 'rates', return_value=(0.75, 3.75))
        self.prices.start()
        self.addCleanup(self.prices.stop)

    def reserve(self, scope='review', limit='1.50'):
        return spend_budget.reserve(worker.connect, scope, MODEL, 100000, 10000, limit)

    def total(self, scope='review'):
        with worker.connect() as db:
            return db.execute('SELECT COALESCE(SUM(microusd),0) FROM ai_spend WHERE scope=?', (scope,)).fetchone()[0]

    def test_concurrent_reservations_cannot_exceed_cap(self):
        def attempt(_):
            try:
                self.reserve()
                return True
            except ValueError:
                return False
        with ThreadPoolExecutor(8) as pool:
            accepted = list(pool.map(attempt, range(30)))
        self.assertTrue(any(accepted))
        self.assertFalse(all(accepted))
        self.assertLessEqual(self.total(), 1500000)

    def test_timeout_and_missing_usage_keep_reservation(self):
        r = self.reserve()
        before = self.total()
        spend_budget.settle(worker.connect, r, {})
        self.assertEqual(self.total(), before)
        self.assertGreater(before, 0)

    def test_actual_usage_including_thinking_releases_unused_reservation(self):
        r = self.reserve()
        spend_budget.settle(worker.connect, r, {'input_tokens': 1000, 'output_tokens': 2000})
        self.assertEqual(self.total(), 8250)

    def test_restart_and_request_baseline_do_not_clear_money_ledger(self):
        self.reserve()
        before = self.total()
        worker.initialize()
        worker.start_run('another-job', {})
        self.assertEqual(self.total(), before)

    def test_database_failure_blocks_reservation(self):
        with patch.object(worker, 'connect', side_effect=sqlite3.OperationalError('unavailable')):
            with self.assertRaises(sqlite3.Error):
                self.reserve()

    def call(self, responder, limit='1.50', review='same-review'):
        job_id = self.insert('processing', {'review_id': review})
        worker._CTX.job_id = job_id
        with patch.object(worker, 'AI_GAME_USD_LIMIT', limit), \
                patch.object(worker, 'ai_config', return_value=('OpenRouter','configured',MODEL,'unused')), \
                patch.object(worker, 'gm_profile', return_value=None), \
                patch.object(worker, 'gemini_api_key', return_value='fixture'), \
                patch.object(worker, 'uses_agent_platform', return_value=False), \
                patch.object(worker, 'http_json', side_effect=responder):
            return worker.request_ai({'input':[{'role':'user','content':[{'type':'input_text','text':'Review hockey.'}]}],
                                      'max_output_tokens':1000}, model=MODEL)

    def test_count_then_generate_and_charge_shared_review(self):
        calls = []
        def respond(url, headers, body):
            calls.append(url)
            if url.endswith(':countTokens'):
                self.assertIn('generateContentRequest', body)
                return {'totalTokens':1000}
            return {'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'{}'}]}}],
                    'usageMetadata':{'promptTokenCount':1000,'candidatesTokenCount':500,'thoughtsTokenCount':1500}}
        self.call(respond)
        self.call(respond)
        self.assertEqual(self.total('same-review'), 16500)
        self.assertEqual([u.split(':')[-1] for u in calls], ['countTokens','generateContent']*2)

    def test_insufficient_reservation_never_sends_generation(self):
        calls = []
        def respond(url, *args):
            calls.append(url)
            return {'totalTokens':1000000}
        with self.assertRaises(worker.Problem) as caught:
            self.call(respond, limit='0.01')
        self.assertEqual(caught.exception.code, 'ai_budget')
        self.assertTrue(all(u.endswith(':countTokens') for u in calls))

    def test_invalid_count_never_sends_generation(self):
        with self.assertRaises(worker.Problem) as caught:
            self.call(lambda *args: {})
        self.assertEqual(caught.exception.code, 'ai_budget')


class PriceSafety(unittest.TestCase):
    def test_unknown_and_expired_prices_fail_closed(self):
        for model, date in [('unknown/model', datetime.date(2026,10,28)),
                            (MODEL, datetime.date(2027,1,1))]:
            with self.assertRaises(ValueError):
                spend_budget.rates(model,date)


if __name__ == '__main__':
    unittest.main()
