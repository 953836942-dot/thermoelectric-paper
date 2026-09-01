import datetime as dt
import unittest

try:
    from .helpers import import_te_radar
except ImportError:
    from helpers import import_te_radar
import_te_radar()
from te_radar.pipeline import fetch_candidates
from te_radar.records import PaperRecord, SourceResult
from te_radar.time_window import SearchWindow

WINDOW = SearchWindow("auto", dt.datetime(2026, 8, 25, tzinfo=dt.timezone.utc), dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc), True)
TEST_CONFIG = {
    "search": {"analysis_candidate_limit": 30},
    "research_profile": {"core": ["thermoelectric"], "transport": ["zT", "power factor"], "design": ["doping"], "data_driven": [], "priority_topics": [], "watched_materials": []},
    "quality_tier_points": {"high": 24}, "target_authors": []
}


def make_te_paper(id="doi:10.1/a"):
    return PaperRecord(id=id, title="Thermoelectric zT optimization", authors=["A"], source="AFM", source_kind="journal",
                       peer_review_status="peer_reviewed", source_tier="high", date="2026-08-31", doi=id.removeprefix("doi:"),
                       url="https://x", abstract="Thermoelectric power factor and zT by doping", keywords=[], concepts=[], raw_source="test", notes=[])


class PipelineTests(unittest.TestCase):
    def test_one_source_failure_does_not_discard_other_sources(self):
        def good(c, w): return SourceResult([make_te_paper()], [])
        def bad(c, w): return SourceResult([], ["OpenAlex: temporary failure"])
        payload = fetch_candidates(TEST_CONFIG, {}, WINDOW, source_fetchers=[good, bad])
        self.assertEqual(payload["candidate_count"], 1)
        self.assertEqual(len(payload["errors"]), 1)
        self.assertEqual(len(payload["analysis_candidates"]), 1)

    def test_seen_auto_paper_is_not_reanalyzed(self):
        payload = fetch_candidates(TEST_CONFIG, {"seen_ids": ["doi:10.1/a"]}, WINDOW,
                                   source_fetchers=[lambda c, w: SourceResult([make_te_paper()], [])])
        self.assertEqual(payload["fresh_count"], 0)

    def test_manual_mode_can_revisit_seen_paper(self):
        manual = SearchWindow("lookback", WINDOW.start, WINDOW.end, False)
        payload = fetch_candidates(TEST_CONFIG, {"seen_ids": ["doi:10.1/a"]}, manual,
                                   source_fetchers=[lambda c, w: SourceResult([make_te_paper()], [])])
        self.assertEqual(payload["fresh_count"], 1)


if __name__ == "__main__":
    unittest.main()
