"""Automatic intake regression tests, with isolated SQLite and no paid AI."""
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import worker
import replay
import live_periods
from test_worker_reliability import Base, BODY


class AutoRestore(Base):
    def test_manual_restart_mapping_clears_the_previous_scan_warning(self):
        job_id=self.insert('needs_periods',{'source_kind':'twitch_replay','vod_url':self.review['vod_url'],
                                          'scan_restart_detected':True})
        worker.apply_period_spec(job_id,worker.parse_period_spec(BODY))
        self.assertNotIn('scan_restart_detected',worker.get_job(job_id)['metadata'])

    def test_concurrent_automatic_clicks_create_one_job(self):
        with ThreadPoolExecutor(2) as pool:
            jobs = list(pool.map(lambda _: replay.resolve(self.review, 'caller', True), range(2)))
        self.assertEqual(jobs[0]['id'], jobs[1]['id'])
        worker.initialize()
        self.assertEqual(replay.resolve(self.review, 'caller')['id'], jobs[0]['id'])

    def scan(self, labels, context=''):
        spans = [{'label': label, 'start': i*300, 'end': (i+1)*300} for i,label in enumerate(labels)]
        duration = len(labels)*300
        meta = {'streamed_replay': True, 'replay_phase': 'scan_periods', 'scan_units': [{'start':0,'end':duration}],
                'scan_unit_index':0,'source_start_seconds':0,'source_end_seconds':duration,'players':context}
        job_id = self.insert('queued',meta)
        folder=worker.ROOT/job_id;folder.mkdir();(folder/'source.mp4').write_bytes(b'fixture')
        with patch.object(worker,'probe',return_value=duration), patch.object(live_periods,'scan_recording_periods',
                return_value={'ranges':spans,'current_period':3,'confirmed':True}), patch.object(worker,'analyze') as ai:
            worker.process(job_id)
            ai.assert_not_called()  # scanning itself never incurs AI charges
        return worker.get_job(job_id)

    def test_regulation_automatically_advances_to_period_parts(self):
        job=self.scan(['Period 1','Period 2','Period 3'])
        self.assertEqual(job['status'],'retrieving')
        self.assertEqual(job['metadata']['replay_phase'],'analyze_periods')

    def test_lagout_context_pauses_before_paid_analysis(self):
        job=self.scan(['Period 1','Period 2','Period 3'],'lag-out during P2; restarted')
        self.assertEqual(job['status'],'needs_periods')

    def test_period_regression_requires_restart_mapping(self):
        job=self.scan(['Period 1','Period 2','Period 1','Period 3'])
        self.assertEqual(job['status'],'needs_periods')

    def test_overtime_requires_confirmation(self):
        job=self.scan(['Period 1','Period 2','Period 3','Overtime 1'])
        self.assertEqual(job['status'],'needs_periods')
        self.assertEqual(job['result']['detected_periods'][-1]['label'],'Overtime 1')

    def test_360p_and_380p_sources_produce_bounded_analysis_frames(self):
        for height in (360,380):
            with self.subTest(height=height):
                video=worker.ROOT/f'fixture-{height}.mp4'
                worker.command(['ffmpeg','-v','error','-f','lavfi','-i',f'testsrc2=size=640x{height}:rate=5',
                                '-t','2','-c:v','libx264','-y',str(video)])
                frames=worker.extract_frames(video,worker.ROOT/f'frames-{height}',0,2,1,'640:360')
                info=json.loads(worker.command(['ffprobe','-v','error','-select_streams','v:0',
                      '-show_entries','stream=width,height','-of','json',str(frames[0])]))['streams'][0]
                self.assertLessEqual(info['height'],360)
                self.assertLessEqual(info['width'],640)


if __name__=='__main__':
    unittest.main()
