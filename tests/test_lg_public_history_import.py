import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("lg_import", Path(__file__).parents[1] / "scripts/import-lg-public-history.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PublicImportTests(unittest.TestCase):
    def source(self, root):
        path = root / "lg_stats.db"
        db = sqlite3.connect(path)
        db.execute("create table skater_stats(lg_user_id integer,league_id integer,season_id integer,gamertag text,gp integer,g integer,a integer,pts integer,plus_minus integer,scouting_player_id text,aliases text)")
        db.execute("insert into skater_stats values(1001,39,55,'Example',6,4,8,12,3,'PRIVATE','DO NOT COPY')")
        db.execute("create table goalie_stats(lg_user_id integer,league_id integer,season_id integer,gamertag text,gp integer,saves integer,sa integer,ga integer,save_pct real,gaa real)")
        db.execute("insert into goalie_stats values(1002,38,54,'Goalie',5,90,100,10,90.0,2.0)")
        db.commit()
        db.close()
        return path

    def test_allowlist_read_only_and_no_browser_access(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = self.source(root)
            browser = root / "browser-data"
            browser.mkdir()
            (browser / "cookies").write_text("DO NOT READ")
            before = path.read_bytes()
            rows, skipped = module.read_rows(path)
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(skipped, 0)
            self.assertEqual(rows[0]["points"], 12)
            self.assertEqual(rows[1]["save_pct"], .9)
            data = json.dumps(rows)
            self.assertNotIn("PRIVATE", data)
            self.assertNotIn("aliases", data)
            self.assertNotIn("scouting_player_id", data)
            with self.assertRaises(ValueError):
                module.database_path(browser / "lg_stats.db")

    def test_dry_run_never_uploads(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.source(Path(folder))
            with patch.object(module, "upload") as upload:
                module.main(["--database", str(path)])
                upload.assert_not_called()

    def test_missing_service_key_and_incomplete_schema_fail_before_upload(self):
        with patch.dict(module.os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                module.upload([{}])
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "lg_stats.db"
            db = sqlite3.connect(path)
            db.execute("create table skater_stats(lg_user_id integer)")
            db.commit()
            db.close()
            with self.assertRaises(ValueError):
                module.read_rows(path)

    def test_source_capture_time_is_never_invented(self):
        with self.assertRaises(ValueError):
            module.main(["--captured-at", "2026-10-16T12:00:00"])

    def test_exact_canonical_bigint_identifiers(self):
        self.assertEqual(module.number("9007199254740993", "lg_user_id"), 9007199254740993)
        self.assertEqual(module.number("9223372036854775807", "lg_user_id"), 9223372036854775807)
        with self.assertRaises(ValueError):
            module.number("9223372036854775808", "lg_user_id")
        with self.assertRaises(ValueError):
            module.number("123.5", "lg_user_id")

if __name__ == "__main__":
    unittest.main()
