import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const paperechoRoot = process.env.PAPERECHO_ROOT || '';

async function loadClassifier() {
  assert.ok(paperechoRoot, 'PAPERECHO_ROOT must be set for classifier integration tests');
  const modulePath = path.join(paperechoRoot, 'workflow', 'tools', 'stage1', 'rule_classifier.mjs');
  return import(`${pathToFileURL(modulePath).href}?te-test=${Date.now()}-${Math.random()}`);
}

async function classify(title, abstract = title) {
  const { classifyItem } = await loadClassifier();
  return classifyItem({ title, abstract, source_platform: 'openalex' });
}

test('thermoelectric materials terms are not hard-excluded by legacy biomedical rules', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Band structure engineering of GeTe for high thermoelectric performance',
    'GeTe shows enhanced zT through band convergence and carrier concentration optimization.',
  );
  assert.notEqual(result.grade, 'D', `expected thermoelectric GeTe paper to survive hard exclusion, got ${JSON.stringify(result)}`);
});

test('configured negative keywords still hard-exclude battery false positives', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Thermoelectric-inspired lithium-ion battery electrode design',
    'A lithium-ion battery electrode is optimized for electrochemical storage.',
  );
  assert.equal(result.grade, 'D');
  assert.ok(result.matched_signals?.includes('d_grade_rule:configured_negative_keyword'), JSON.stringify(result));
});

test('A grade is reserved for priority systems or explicit priority optimization', { skip: !paperechoRoot }, async () => {
  const cases = [
    ['Mg3Sb2 Bi alloying for thermoelectric transport', 'Bi alloying regulates electronic and phonon transport in Mg3Sb2 and improves zT.'],
    ['Enhanced thermoelectric performance in SnS through Na and Ag co-doping', 'Co-doping and band engineering improve power factor and zT in SnS.'],
    ['Multi-scale lattice strain engineering in GeTe alloys', 'GeTe strain engineering reduces deformation potential and improves thermoelectric performance.'],
    ['Interface engineered Ag2Se thermoelectric material', 'Ag2Se interface engineering improves phase stability and thermoelectric performance.'],
  ];
  for (const [title, abstract] of cases) {
    const result = await classify(title, abstract);
    assert.equal(result.grade, 'A', `${title}: ${JSON.stringify(result)}`);
  }
});

test('real publisher co-doping punctuation still reaches A', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Enhanced Thermoelectric Performance in Se Alloyed SnS Through Band Engineering, Na and Ag Co‐Doping, and Nanostructuring',
    'Co‐doping and band engineering improve power factor and zT in SnS.',
  );
  assert.equal(result.grade, 'A', JSON.stringify(result));
});

test('generic carrier concentration outside priority systems is B rather than A', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Effects of Sn Doping on Charge Transport and Thermoelectric Performance of Wittichenite',
    'Carrier concentration changes charge transport and improves thermoelectric performance in wittichenite.',
  );
  assert.equal(result.grade, 'B', JSON.stringify(result));
});

test('general thermoelectric mechanism papers are B, not automatically A', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Regulating phonon-carrier transport by interfacial symmetry breaking in thermoelectric multilayers',
    'Interfacial symmetry breaking regulates phonon and carrier transport and enhances thermoelectric performance.',
  );
  assert.equal(result.grade, 'B', JSON.stringify(result));
});

test('device-oriented thermoelectric papers without core materials optimization are C', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Dual-doped all-graphene fiber for flexible thermoelectric temperature sensing',
    'A flexible thermoelectric temperature sensor is demonstrated for wearable applications.',
  );
  assert.equal(result.grade, 'C', JSON.stringify(result));
});

test('photodetector false positives remain D', { skip: !paperechoRoot }, async () => {
  const result = await classify(
    'Flexible Bi2Te3 photothermoelectric position-sensitive detector',
    'A photodetector uses a photothermoelectric response for position sensing.',
  );
  assert.equal(result.grade, 'D', JSON.stringify(result));
});
