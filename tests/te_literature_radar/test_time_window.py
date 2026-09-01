import datetime as dt
import unittest

try:
    from .helpers import import_te_radar
except ImportError:
    from helpers import import_te_radar

import_te_radar()
from te_radar.time_window import resolve_search_window

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 9, 1, 22, 0, tzinfo=UTC)


class SearchWindowTests(unittest.TestCase):
    def test_auto_uses_48_hour_overlap(self):
        config = {"search": {"first_run_lookback_days": 7, "overlap_hours": 48}}
        state = {"last_success_utc": "2026-08-25T22:00:00+00:00"}
        window = resolve_search_window(config, state, mode="auto", now=NOW)
        self.assertEqual(window.start, dt.datetime(2026, 8, 23, 22, 0, tzinfo=UTC))
        self.assertEqual(window.end, NOW)
        self.assertTrue(window.advance_auto_state)

    def test_auto_first_run_uses_seven_days(self):
        config = {"search": {"first_run_lookback_days": 7, "overlap_hours": 48}}
        window = resolve_search_window(config, {}, mode="auto", now=NOW)
        self.assertEqual(window.start, NOW - dt.timedelta(days=7))

    def test_lookback_does_not_advance_state_by_default(self):
        window = resolve_search_window({}, {}, mode="lookback", lookback_days=30, now=NOW)
        self.assertEqual(window.start, NOW - dt.timedelta(days=30))
        self.assertFalse(window.advance_auto_state)

    def test_range_uses_explicit_dates(self):
        window = resolve_search_window({}, {}, mode="range", start_date="2026-01-01", end_date="2026-06-30", now=NOW)
        self.assertEqual(window.start.date().isoformat(), "2026-01-01")
        self.assertEqual(window.end.date().isoformat(), "2026-06-30")
        self.assertFalse(window.advance_auto_state)

    def test_range_rejects_reverse_dates(self):
        with self.assertRaises(ValueError):
            resolve_search_window({}, {}, mode="range", start_date="2026-06-30", end_date="2026-01-01", now=NOW)

    def test_lookback_rejects_range_arguments(self):
        with self.assertRaises(ValueError):
            resolve_search_window({}, {}, mode="lookback", lookback_days=7, start_date="2026-01-01", now=NOW)


if __name__ == "__main__":
    unittest.main()
