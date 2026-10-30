"""Exercise actual JPEG encoding of limited-range H.264, without AI calls."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import worker
import live_periods


class JpegRangeTests(unittest.TestCase):
    def test_limited_range_analysis_and_scoreboard_frames(self):
        with tempfile.TemporaryDirectory(prefix='vod range ') as tmp:
            root = Path(tmp)
            source = root / 'limited range.mp4'
            subprocess.run([
                'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=10',
                '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-color_range', 'tv', str(source)
            ], check=True, capture_output=True)
            frames = worker.extract_frames(source, root / 'frames', 0, 3, frame_step=1)
            self.assertEqual(len(frames), 3)
            for frame in frames:
                info = json.loads(subprocess.check_output([
                    'ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(frame)
                ]))['streams'][0]
                self.assertEqual(info['codec_name'], 'mjpeg')
                self.assertEqual(info['color_range'], 'pc')
            # Real extraction, stub only OCR to keep this test offline/deterministic.
            real_run = subprocess.run
            def run(args, **kwargs):
                if args[0] == 'tesseract':
                    return subprocess.CompletedProcess(args, 0, stdout=b'', stderr=b'')
                return real_run(args, **kwargs)
            with patch.object(subprocess, 'run', side_effect=run):
                with patch.object(worker, 'ROOT', root):
                    self.assertEqual(worker.detect_periods(source, 3), [])
                live_periods.scan_recording_periods(source, 3, interval=1)


if __name__ == '__main__':
    unittest.main()
