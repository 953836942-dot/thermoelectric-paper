import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const paperechoRoot = process.env.PAPERECHO_ROOT || '';

async function loadClassifier() {
  assert.ok(paperechoRoot, 'PAPERECHO_ROOT must be set for classifier integration tests');
  const modulePath = path.join(paperechoRoot, 'workflow', 'tools', 'stage1', 'rule_classifier.mjs');
  return import(`${pathToFileURL(modulePath).href}?te-test=${Date.now()}`);
}

test('thermoelectric materials terms are not hard-excluded by legacy biomedical rules', { skip: !paperechoRoot }, async () => {
  const { classifyItem } = await loadClassifier();
  const result = classifyItem({
    title: 'Band structure engineering of GeTe for high thermoelectric performance',
    abstract: 'GeTe shows enhanced zT through band convergence and carrier concentration optimization.',
    source_platform: 'openalex',
  });

  assert.notEqual(result.grade, 'D', `expected thermoelectric GeTe paper to survive hard exclusion, got ${JSON.stringify(result)}`);
});

test('configured negative keywords still hard-exclude battery false positives', { skip: !paperechoRoot }, async () => {
  const { classifyItem } = await loadClassifier();
  const result = classifyItem({
    title: 'Thermoelectric-inspired lithium-ion battery electrode design',
    abstract: 'A lithium-ion battery electrode is optimized for electrochemical storage.',
    source_platform: 'openalex',
  });

  assert.equal(result.grade, 'D');
  assert.ok(result.matched_signals?.includes('d_grade_rule:configured_negative_keyword'), JSON.stringify(result));
});
