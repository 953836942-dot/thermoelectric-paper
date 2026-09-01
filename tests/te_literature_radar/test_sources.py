import datetime as dt
import json
import unittest
from unittest.mock import patch

try:
    from .helpers import import_te_radar
except ImportError:
    from helpers import import_te_radar

import_te_radar()
from te_radar.time_window import SearchWindow
from te_radar.sources.crossref import fetch_crossref
from te_radar.sources.openalex import fetch_openalex
from te_radar.sources.arxiv import fetch_arxiv
from te_radar.sources.rss import fetch_rss

WINDOW = SearchWindow("range", dt.datetime(2026,8,29,tzinfo=dt.timezone.utc), dt.datetime(2026,9,1,23,59,tzinfo=dt.timezone.utc), False)
CROSSREF_FIXTURE = {"message":{"items":[{"DOI":"10.1000/te.1","title":["High-performance thermoelectric PbTe"],"author":[{"given":"A","family":"Author"}],"published-online":{"date-parts":[[2026,8,30]]},"container-title":["Advanced Functional Materials"],"abstract":"<jats:p>Thermoelectric zT reaches 1.8.</jats:p>","subject":["Materials Science"],"URL":"https://doi.org/10.1000/te.1"}]}}
OPENALEX_FIXTURE = {"results":[{"id":"https://openalex.org/W1","doi":"https://doi.org/10.1000/te.2","title":"Machine learning discovery of thermoelectric compounds","publication_date":"2026-08-31","type":"article","authorships":[{"author":{"display_name":"B. Author"}}],"primary_location":{"source":{"display_name":"Advanced Materials"},"landing_page_url":"https://example.test/paper"},"abstract_inverted_index":{"Thermoelectric":[0],"screening":[1],"materials":[2]},"concepts":[{"display_name":"Thermoelectricity"}]}],"meta":{"next_cursor":None}}
ARXIV_FIXTURE = '''<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2608.12345</id><updated>2026-08-31T10:00:00Z</updated><published>2026-08-31T10:00:00Z</published><title>Thermoelectric ML study</title><summary>New thermoelectric screening method.</summary><author><name>C Author</name></author></entry></feed>'''
RSS_FIXTURE = '''<rss><channel><item><title>Inside TE paper</title><link>https://example.test/1</link><pubDate>Sun, 30 Aug 2026 10:00:00 GMT</pubDate><description>Thermoelectric zT study</description></item><item><title>Old paper</title><link>https://example.test/2</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate><description>Old</description></item></channel></rss>'''

class SourceTests(unittest.TestCase):
    @patch("te_radar.sources.crossref.http_get", return_value=json.dumps(CROSSREF_FIXTURE).encode())
    def test_crossref_normalizes(self, _):
        cfg={"search":{"per_query_rows":10},"target_journals":[{"name":"Advanced Functional Materials","tier":"high","issn":["1616-3028"]}]}
        result=fetch_crossref(cfg,WINDOW)
        self.assertEqual(result.papers[0].doi,"10.1000/te.1")
        self.assertEqual(result.papers[0].source_tier,"high")
        self.assertIn("zT reaches 1.8",result.papers[0].abstract)

    @patch("te_radar.sources.openalex.http_get", return_value=json.dumps(OPENALEX_FIXTURE).encode())
    def test_openalex_reconstructs_abstract_and_inherits_configured_tier(self, _):
        cfg={
            "search":{"per_query_rows":10},
            "openalex":{"enabled":True,"queries":["thermoelectric"]},
            "target_journals":[{"name":"Advanced Materials","tier":"elite","issn":[]}],
        }
        result=fetch_openalex(cfg,WINDOW)
        self.assertEqual(result.papers[0].abstract,"Thermoelectric screening materials")
        self.assertEqual(result.papers[0].peer_review_status,"peer_reviewed")
        self.assertEqual(result.papers[0].source_tier,"elite")

    @patch("te_radar.sources.arxiv.http_get", return_value=ARXIV_FIXTURE.encode())
    def test_arxiv_is_preprint(self, _):
        cfg={"search":{"per_query_rows":10},"arxiv":{"enabled":True,"queries":["thermoelectric"]}}
        paper=fetch_arxiv(cfg,WINDOW).papers[0]
        self.assertEqual(paper.peer_review_status,"preprint")
        self.assertIn("Preprint — not peer reviewed",paper.notes)

    @patch("te_radar.sources.rss.http_get", return_value=RSS_FIXTURE.encode())
    def test_rss_filters_date(self, _):
        cfg={"search":{"per_query_rows":10},"rss_feeds":[{"name":"Feed","url":"https://example.test/feed"}]}
        result=fetch_rss(cfg,WINDOW)
        self.assertEqual([p.title for p in result.papers],["Inside TE paper"])

if __name__ == "__main__": unittest.main()
