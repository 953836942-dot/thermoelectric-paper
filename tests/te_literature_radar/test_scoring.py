import datetime as dt
import unittest

try:
    from .helpers import import_te_radar
except ImportError:
    from helpers import import_te_radar

import_te_radar()
from te_radar.records import PaperRecord
from te_radar.scoring import ScoreBreakdown, classify_grade, score_base


class ScoringTests(unittest.TestCase):
    def paper(self, **kw):
        base = dict(id="x", title="", authors=["A"], source="Nature", source_kind="journal", peer_review_status="peer_reviewed", source_tier="premier", date="2026-08-31", doi="10.1/x", url="https://example.test", abstract="", keywords=[], concepts=[], raw_source="test", notes=[])
        base.update(kw)
        return PaperRecord(**base)

    def cfg(self):
        return {"research_profile":{"core":["thermoelectric","Seebeck effect"],"transport":["zT","power factor","Seebeck coefficient","thermal conductivity"],"design":["doping"],"data_driven":["machine learning"],"priority_topics":["doping"],"watched_materials":[]},"quality_tier_points":{"premier":28,"high":24,"solid":16,"preprint":8},"target_authors":[]}

    def test_prestigious_non_te_paper_fails_gate(self):
        paper = self.paper(title="Anomalous Nernst response in a magnetic film", abstract="We study spin-caloritronic transport without conventional thermoelectric material optimization.")
        base = score_base(paper, self.cfg(), window_end=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc))
        self.assertFalse(base.gate_passed)

    def test_core_te_paper_passes_gate(self):
        paper = self.paper(title="High-performance thermoelectric PbTe", abstract="Seebeck coefficient, power factor and zT are optimized by doping.")
        base = score_base(paper, self.cfg(), window_end=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc))
        self.assertTrue(base.gate_passed)
        self.assertLessEqual(base.te_relevance, 30)
        self.assertLessEqual(base.research_quality, 30)

    def test_lower_tier_high_novelty_can_be_a(self):
        score = ScoreBreakdown(30, 16, 20, 10, 10)
        self.assertEqual(classify_grade(score, peer_review_status="peer_reviewed"), "A")

    def test_preprint_has_stricter_a_threshold(self):
        self.assertNotEqual(classify_grade(ScoreBreakdown(25, 8, 17, 10, 10), peer_review_status="preprint"), "A")
        self.assertEqual(classify_grade(ScoreBreakdown(30, 10, 19, 10, 10), peer_review_status="preprint"), "A")

if __name__ == "__main__": unittest.main()
