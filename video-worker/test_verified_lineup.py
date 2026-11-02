"""Contract tests for private, authenticated, six-slot LG lineup retrieval."""
import os
import unittest
from unittest.mock import patch

import replay
from report_schema import lineup_roster

REVIEW = {
    'id': '9ed799f8-73cf-488b-9945-ae1538d35641',
    'team_id': 'b0bcbdda-da9d-419d-8f61-b34937966d49',
}
NAMES = [('LW', 'offtheyrk', 58225), ('C', 'thenny32', 66913),
         ('RW', 'SmokoLi', 74341), ('LD', 'WhyKayWins', 77094),
         ('RD', 'matt_0_5', 81072), ('G', 'Kudolken', 12262)]


class VerifiedLineupTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            'SUPABASE_URL': 'https://example.supabase.co',
            'SUPABASE_PUBLISHABLE_KEY': 'test-public-key'
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def rows(self):
        return [{'team_id': REVIEW['team_id'], 'position': position,
                 'display_name': name, 'lg_user_id': lg}
                for position, name, lg in NAMES]

    def lookup(self, rows):
        with patch.object(replay.worker, 'http_json', return_value=rows) as fetch:
            value = replay.verified_lineup_for_review(REVIEW, 'Bearer valid-reviewer-token')
        args = fetch.call_args.args
        self.assertIn('review_id=eq.' + REVIEW['id'], args[0])
        self.assertEqual(args[1]['Authorization'], 'Bearer valid-reviewer-token')
        return value

    def test_six_confirmed_positions_drive_scoring_without_inventing_events(self):
        lineup = self.lookup(self.rows())
        self.assertEqual(lineup_roster(lineup), [(position, name) for position, name, _ in NAMES])
        self.assertIn('RW SmokoLi', lineup)

    def test_five_of_six_is_not_a_verified_lineup(self):
        self.assertEqual(self.lookup(self.rows()[:-1]), '')

    def test_duplicate_position_is_not_a_verified_lineup(self):
        rows = self.rows()
        rows[-1]['position'] = 'RW'
        self.assertEqual(self.lookup(rows), '')

    def test_other_team_cannot_be_used(self):
        rows = self.rows()
        rows[0]['team_id'] = 'other-team'
        self.assertEqual(self.lookup(rows), '')

    def test_lineup_does_not_accept_markup_separator(self):
        rows = self.rows()
        rows[2]['display_name'] = 'SmokoLi, fake'
        self.assertEqual(self.lookup(rows), '')


if __name__ == '__main__':
    unittest.main()
