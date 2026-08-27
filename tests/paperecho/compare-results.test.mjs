import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildComparison, writeComparison } from '../../scripts/paperecho/compare-results.mjs';

test('buildComparison summarizes PaperEcho A/B/C/D grades', () => {
  const digest = {
    feeds: [{
      name: 'feed',
      papers: [
        { title: 'Paper A', doi: '10.1/a', canonical_id: 'doi:10.1/a' },
        { title: 'Paper B', doi: '10.1/b', canonical_id: 'doi:10.1/b' },
        { title: 'Paper C', doi: '10.1/c', canonical_id: 'doi:10.1/c' },
      ],
    }],
  };
  const snapshot = {
    schema_version: 1,
    papers: [
      { title: 'Paper A', final_grade: 'A', doi: '10.1/a' },
      { title: 'Paper B', rule_grade: 'B', doi: '10.1/b' },
      { title: 'Paper C', grade: 'D', doi: '10.1/c' },
    ],
  };

  const comparison = buildComparison(digest, snapshot);
  assert.equal(comparison.candidate_count, 3);
  assert.equal(comparison.paperecho_stored_count, 3);
  assert.deepEqual(comparison.grade_counts, { A: 1, B: 1, C: 0, D: 1, unknown: 0 });
  assert.equal(comparison.duplicate_reduction, 0);
  assert.deepEqual(comparison.top_by_grade.A, ['Paper A']);
});

test('writeComparison writes readable Markdown and JSON', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paperecho-compare-'));
  const comparison = {
    candidate_count: 3,
    paperecho_stored_count: 3,
    duplicate_reduction: 0,
    grade_counts: { A: 1, B: 1, C: 0, D: 1, unknown: 0 },
    top_by_grade: { A: ['Paper A'], B: ['Paper B'], C: [], D: ['Paper C'], unknown: [] },
  };
  await writeComparison(comparison, dir);
  const md = await fs.readFile(path.join(dir, 'comparison.md'), 'utf8');
  const json = JSON.parse(await fs.readFile(path.join(dir, 'comparison.json'), 'utf8'));
  assert.match(md, /## A/);
  assert.match(md, /Paper A/);
  assert.equal(json.grade_counts.B, 1);
});
