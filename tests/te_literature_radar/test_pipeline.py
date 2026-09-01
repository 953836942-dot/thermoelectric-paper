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

WINDOW=SearchWindow("auto",dt.datetime(2026,8,25,tzinfo=dt.timezone.utc),dt.datetime(2026,9,1,tzinfo=dt.timezone.utc),True)
TEST_CONFIG={"search":{"analysis_candidate_limit":30},"research_profile":{"core":["thermoelectric"],"transport":["zT","power factor"],"design":["doping"],"data_driven":[],"priority_topics":[],"watched_materials":[]},"quality_tier_points":{"high":24},"target_authors":[]}

def make_te_paper(id="doi:10.1/a"):
    return PaperRecord(id=id,title="Thermoelectric zT optimization",authors=["A"],source="AFM",source_kind="journal",peer_review_status="peer_reviewed",source_tier="high",date="2026-08-31",doi=id.removeprefix("doi:"),url="https://x",abstract="Thermoelectric power factor and zT by doping",keywords=[],concepts=[],raw_source="test",notes=[])

class PipelineTests(unittest.TestCase):
    def test_one_source_failure_does_not_discard_other_sources(self):
        def good(c,w): return SourceResult([make_te_paper()],[])
        def bad(c,w): return SourceResult([],["OpenAlex: temporary failure"])
        payload=fetch_candidates(TEST_CONFIG,{},WINDOW,source_fetchers=[good,bad])
        self.assertEqual(payload["candidate_count"],1)
        self.assertEqual(len(payload["errors"]),1)
        self.assertEqual(len(payload["analysis_candidates"]),1)

    def test_seen_auto_paper_is_not_reanalyzed(self):
        payload=fetch_candidates(TEST_CONFIG,{"seen_ids":["doi:10.1/a"]},WINDOW,source_fetchers=[lambda c,w:SourceResult([make_te_paper()],[])])
        self.assertEqual(payload["fresh_count"],0)

    def test_manual_mode_can_revisit_seen_paper(self):
        manual=SearchWindow("lookback",WINDOW.start,WINDOW.end,False)
        payload=fetch_candidates(TEST_CONFIG,{"seen_ids":["doi:10.1/a"]},manual,source_fetchers=[lambda c,w:SourceResult([make_te_paper()],[])])
        self.assertEqual(payload["fresh_count"],1)

if __name__=="__main__": unittest.main()

class FinalizeTests(unittest.TestCase):
    def _load_finalize(self):
        import importlib.util, sys
        from pathlib import Path
        root=Path(__file__).resolve().parents[2]
        scripts=root/'te-literature-radar'/'scripts'
        if str(scripts) not in sys.path: sys.path.insert(0,str(scripts))
        spec=importlib.util.spec_from_file_location('finalize_radar',scripts/'finalize_radar.py')
        mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod

    def _fetch(self, advance=True):
        base=fetch_candidates(TEST_CONFIG,{},WINDOW,source_fetchers=[lambda c,w:SourceResult([make_te_paper()],[])])
        base['search_window']['advance_auto_state']=advance
        return base

    def _analysis(self, fetch):
        p=fetch['analysis_candidates'][0]
        return {'papers':[{'id':p['id'],'novelty':{'score':20,'types':['new dopant/alloy design'],'reason':'New doping design.','evidence_basis':'title_abstract_metadata'},'summary':{'purpose':'Improve thermoelectric zT.','innovation':'New doping design.','approach':'Doping.','results':[],'mechanism':'Thermoelectric power factor optimization.','significance':'Useful TE route.','limitations':['Metadata-only judgment.']},'radar_note':'Read it.'}]}

    def test_state_advances_after_successful_required_email(self):
        import tempfile, json
        from pathlib import Path
        mod=self._load_finalize(); fetch=self._fetch(True); analysis=self._analysis(fetch)
        with tempfile.TemporaryDirectory() as td:
            out=Path(td); config={'email':{'enabled':True,'from':'a@x','to':'b@x','smtp_username':'a@x'},'_config_dir':td}
            calls=[]
            mod.finalize(config,fetch,analysis,output_dir=out,send_func=lambda *a: calls.append(True),password_loader=lambda *a:'secret')
            state=json.loads((out/'state.json').read_text())
            self.assertTrue(state['last_success_utc']); self.assertTrue(calls)

    def test_state_does_not_advance_when_email_send_fails(self):
        import tempfile
        from pathlib import Path
        mod=self._load_finalize(); fetch=self._fetch(True); analysis=self._analysis(fetch)
        with tempfile.TemporaryDirectory() as td:
            out=Path(td); config={'email':{'enabled':True,'from':'a@x','to':'b@x','smtp_username':'a@x'},'_config_dir':td}
            with self.assertRaises(RuntimeError):
                mod.finalize(config,fetch,analysis,output_dir=out,send_func=lambda *a: (_ for _ in ()).throw(RuntimeError('send failed')),password_loader=lambda *a:'secret')
            self.assertFalse((out/'state.json').exists())

    def test_email_disabled_render_success_can_complete_auto_run(self):
        import tempfile
        from pathlib import Path
        mod=self._load_finalize(); fetch=self._fetch(True); analysis=self._analysis(fetch)
        with tempfile.TemporaryDirectory() as td:
            out=Path(td); mod.finalize({'email':{'enabled':False}},fetch,analysis,output_dir=out)
            self.assertTrue((out/'state.json').exists())

    def test_manual_finalize_does_not_write_state(self):
        import tempfile
        from pathlib import Path
        mod=self._load_finalize(); fetch=self._fetch(False); analysis=self._analysis(fetch)
        with tempfile.TemporaryDirectory() as td:
            out=Path(td); mod.finalize({'email':{'enabled':False}},fetch,analysis,output_dir=out)
            self.assertFalse((out/'state.json').exists())


class AcceptanceTests(unittest.TestCase):
    def test_four_case_v1_acceptance(self):
        from te_radar.analysis import merge_analysis
        cfg={
            'search':{'analysis_candidate_limit':30},
            'research_profile':{'core':['thermoelectric'],'transport':['zT','power factor','Seebeck coefficient'],'design':['doping'],'data_driven':['machine learning'],'priority_topics':['doping','machine learning'],'watched_materials':['PbTe']},
            'quality_tier_points':{'premier':28,'high':24,'solid':16,'preprint':8},
            'target_authors':['Target Author']
        }
        def rec(pid,title,abstract,tier,status='peer_reviewed',author='A',source='Journal'):
            doi=pid.removeprefix('doi:') if pid.startswith('doi:') else ''
            return PaperRecord(id=pid,title=title,authors=[author],source=source,source_kind='preprint' if status=='preprint' else 'journal',peer_review_status=status,source_tier=tier,date='2026-08-31',doi=doi,url='https://x',abstract=abstract,keywords=[],concepts=[],raw_source='test',notes=['Preprint — not peer reviewed'] if status=='preprint' else [])
        papers=[
            rec('doi:10.1/afm','Thermoelectric PbTe zT optimization by doping','Thermoelectric power factor and Seebeck coefficient improve; zT reaches 1.8.','high',source='Advanced Functional Materials'),
            rec('doi:10.1/nature','Anomalous Nernst response in a magnetic film','Spin-caloritronic response is studied.','premier',source='Nature'),
            rec('doi:10.1/solid','Thermoelectric PbTe zT optimization with new doping','Thermoelectric power factor and Seebeck coefficient are optimized by doping.','solid',source='Solid Journal'),
            rec('arxiv:1','Thermoelectric PbTe machine learning doping discovery','Thermoelectric zT and power factor screening by machine learning and doping.','preprint','preprint','Target Author','arXiv'),
        ]
        payload=fetch_candidates(cfg,{},WINDOW,source_fetchers=[lambda c,w:SourceResult(papers,[])])
        ids={p['id'] for p in payload['analysis_candidates']}
        self.assertNotIn('doi:10.1/nature',ids)
        analyses=[]
        for p in payload['analysis_candidates']:
            novelty=19 if p['peer_review_status']=='preprint' else (20 if p['source_tier']=='solid' else 16)
            results=['zT reaches 1.8.'] if p['id']=='doi:10.1/afm' else []
            analyses.append({'id':p['id'],'novelty':{'score':novelty,'types':['new dopant/alloy design'],'reason':'New doping design.','evidence_basis':'title_abstract_metadata'},'summary':{'purpose':'Improve thermoelectric performance.','innovation':'New doping design.','approach':'Doping and screening.','results':results,'mechanism':'Thermoelectric power factor optimization.','significance':'Useful thermoelectric design route.','limitations':['Metadata-only judgment.']},'radar_note':'Read for thermoelectric design.'})
        final=merge_analysis(payload,{'papers':analyses})
        by={p['id']:p for p in final['papers']}
        self.assertIn(by['doi:10.1/afm']['radar_score']['grade'],{'A','B'})
        self.assertIn(by['doi:10.1/solid']['radar_score']['grade'],{'A','B'})
        self.assertIn(by['arxiv:1']['radar_score']['grade'],{'A','B','C'})
        self.assertIn('Preprint — not peer reviewed',by['arxiv:1']['notes'])
        self.assertEqual(by['doi:10.1/afm']['summary']['results'],['zT reaches 1.8.'])
