import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
render=load("render_digest",Path("te-literature-radar/scripts/render_digest.py"))
sender=load("send_digest",Path("te-literature-radar/scripts/send_digest.py"))

def paper(grade="A",preprint=False):
    return {"id":"x","title":"Thermoelectric PbTe","source":"AFM","date":"2026-08-31","url":"https://x","peer_review_status":"preprint" if preprint else "peer_reviewed","radar_score":{"te_relevance":30,"research_quality":10 if preprint else 25,"novelty":19,"research_fit":8,"recency":10,"total":77 if preprint else 92,"grade":grade},"summary":{"purpose":"Improve TE.","innovation":"New design.","approach":"Doping.","results":["zT reaches 1.8."],"mechanism":"Carrier optimization.","significance":"Useful design route.","limitations":["Metadata-only judgment."]},"radar_note":"Read it."}

class RenderTests(unittest.TestCase):
    def payload(self,papers): return {"generated_at_utc":"2026-09-01T00:00:00+00:00","search_window":{"mode":"auto","start":"x","end":"y"},"papers":papers,"paper_count":len(papers),"errors":[]}
    def test_digest_has_approved_summary_sections(self):
        text=render.render_markdown(self.payload([paper("A"),paper("B"),paper("C")]))
        for value in ["## A — 必看","## B — 值得关注","## C — 浏览即可","**目的**","**创新**","**如何解决**","**效果**","**机制**","**意义**","**局限/注意**"]: self.assertIn(value,text)
    def test_preprint_warning_is_prominent(self): self.assertIn("Preprint — not peer reviewed",render.render_markdown(self.payload([paper("A",True)])))
    @patch.object(sender.smtplib, "SMTP")
    def test_smtp_is_mocked(self,mock_smtp):
        ec={"from":"a@x","to":"b@x","smtp_host":"smtp.x","smtp_port":587,"smtp_username":"a@x","use_starttls":True}
        msg=sender.build_message(ec,"subject","body","<p>body</p>"); sender.send_message(ec,msg,"secret")
        inst=mock_smtp.return_value.__enter__.return_value; inst.starttls.assert_called_once(); inst.login.assert_called_once_with("a@x","secret"); inst.send_message.assert_called_once()

if __name__=="__main__": unittest.main()
