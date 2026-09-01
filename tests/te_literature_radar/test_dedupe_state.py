import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

try:
    from .helpers import import_te_radar
except ImportError:
    from helpers import import_te_radar

import_te_radar()
from te_radar.records import PaperRecord
from te_radar.dedupe import dedupe_records, paper_identity
from te_radar.state import load_state, update_success_state


class DedupeStateTests(unittest.TestCase):
    def paper(self, **kw):
        base = dict(id="", title="Thermoelectric transport in PbTe", authors=["A. Author"], source="Example", source_kind="journal", peer_review_status="peer_reviewed", source_tier="high", date="2026-08-30", doi="", url="", abstract="", keywords=[], concepts=[], raw_source="test", notes=[])
        base.update(kw)
        return PaperRecord(**base)

    def test_doi_is_primary_identity_and_normalized(self):
        a = self.paper(doi="https://doi.org/10.1000/ABC.1")
        b = self.paper(doi="10.1000/abc.1", source="Second source")
        merged = dedupe_records([a, b])
        self.assertEqual(len(merged), 1)
        self.assertEqual(paper_identity(merged[0]), "doi:10.1000/abc.1")

    def test_title_primary_author_fallback(self):
        a = self.paper(title="High-zT PbTe: A Study", authors=["Jane Doe"])
        b = self.paper(title="High zT PbTe A Study", authors=["Jane Doe"])
        self.assertEqual(len(dedupe_records([a, b])), 1)

    def test_doi_record_merges_with_title_only_duplicate(self):
        a = self.paper(title="High-zT PbTe: A Study", authors=["Jane Doe"], doi="10.1/x")
        b = self.paper(title="High zT PbTe A Study", authors=["Jane Doe"], doi="")
        self.assertEqual(len(dedupe_records([a, b])), 1)

    def test_manual_success_can_leave_auto_cursor_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            path.write_text(json.dumps({"seen_ids": ["old"], "last_success_utc": "2026-08-25T00:00:00+00:00"}))
            update_success_state(path, delivered_ids=["new"], completed_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc), advance_auto_state=False)
            state = load_state(path)
            self.assertEqual(state["last_success_utc"], "2026-08-25T00:00:00+00:00")
            self.assertEqual(state["seen_ids"], ["old"])

    def test_auto_success_updates_seen_and_cursor(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            update_success_state(path, delivered_ids=["doi:10.1/x"], completed_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc), advance_auto_state=True)
            state = load_state(path)
            self.assertIn("doi:10.1/x", state["seen_ids"])
            self.assertTrue(state["last_success_utc"].startswith("2026-09-01"))


if __name__ == "__main__":
    unittest.main()
