import unittest
try:
    from .helpers import import_te_radar
except ImportError:
    from helpers import import_te_radar
import_te_radar()
from te_radar.analysis import merge_analysis, validate_analysis

FETCH = {
    "analysis_candidates": [{
        "id": "doi:10.1/x", "title": "Thermoelectric PbTe", "authors": ["A"],
        "abstract": "The maximum zT reaches 1.8 at 800 K.", "date": "2026-08-30",
        "source": "Advanced Functional Materials", "doi": "10.1/x", "peer_review_status": "peer_reviewed",
        "base_score": {"te_relevance": 30, "research_quality": 25, "research_fit": 8, "recency": 10}
    }]
}

class AnalysisTests(unittest.TestCase):
    def good(self):
        return {"papers": [{
            "id": "doi:10.1/x",
            "novelty": {"score": 16, "types": ["new dopant/alloy design"], "reason": "A distinct design strategy is reported.", "evidence_basis": "title_abstract_metadata"},
            "summary": {
                "purpose": "Improve thermoelectric PbTe.",
                "innovation": "Uses a distinct design strategy.",
                "approach": "Material design and transport measurements.",
                "results": ["Maximum zT reaches 1.8 at 800 K."],
                "mechanism": "The abstract attributes the improvement to carrier optimization.",
                "significance": "Provides a route for PbTe optimization.",
                "limitations": ["Judgment is based on title/abstract/metadata, not full text."]
            },
            "radar_note": "Worth reading for its PbTe optimization strategy."
        }]}

    def test_valid_analysis_passes(self):
        validate_analysis(FETCH, self.good())

    def test_novelty_above_20_is_rejected(self):
        bad = self.good(); bad["papers"][0]["novelty"]["score"] = 21
        with self.assertRaises(ValueError): validate_analysis(FETCH, bad)

    def test_unsupported_result_number_is_rejected(self):
        bad = self.good(); bad["papers"][0]["summary"]["results"] = ["Maximum zT reaches 2.4 at 800 K."]
        with self.assertRaises(ValueError): validate_analysis(FETCH, bad)

    def test_grade_is_code_computed(self):
        final = merge_analysis(FETCH, self.good())
        self.assertEqual(final["papers"][0]["radar_score"]["total"], 89)
        self.assertEqual(final["papers"][0]["radar_score"]["grade"], "A")

if __name__ == "__main__": unittest.main()
