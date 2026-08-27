import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('scripts/paperecho/build-report.mjs');

test('build-report creates a readable weekly homepage with grades and links', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paperecho-report-'));
  const papersPath = path.join(dir, 'papers.json');
  const comparisonPath = path.join(dir, 'comparison.json');
  const outDir = path.join(dir, 'delivery');

  await fs.writeFile(papersPath, JSON.stringify({
    papers: [
      {
        title: 'GeTe strain engineering for thermoelectric performance',
        abstract: 'High thermoelectric performance in GeTe.',
        final_grade: 'A', grade: 'A', journal: 'Advanced Energy Materials',
        pubdate: '2026-08-25T00:00:00Z', doi: '10.1000/gete', url: 'https://doi.org/10.1000/gete',
        grade_reason: 'Priority GeTe mechanism work.'
      },
      {
        title: 'Flexible thermoelectric sensor', final_grade: 'C', grade: 'C',
        journal: 'Example Journal', pubdate: '2026-08-24T00:00:00Z', url: 'https://example.com/flexible',
        grade_reason: 'Device-oriented work.'
      }
    ]
  }, null, 2));
  await fs.writeFile(comparisonPath, JSON.stringify({
    candidate_count: 2,
    grade_counts: { A: 1, B: 0, C: 1, D: 0, unknown: 0 }
  }, null, 2));

  const run = spawnSync(process.execPath, [script, papersPath, comparisonPath, outDir], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  assert.match(html, /PaperEcho-TE Weekly/i);
  assert.match(html, /Top papers this week/i);
  assert.match(html, /A[^0-9]*1/i);
  assert.match(html, /GeTe strain engineering/);
  assert.match(html, /Advanced Energy Materials/);
  assert.match(html, /Priority GeTe mechanism work/);
  assert.match(html, /https:\/\/doi\.org\/10\.1000\/gete/);
  assert.match(html, /Flexible thermoelectric sensor/);
  assert.match(html, /C/);

  const report = JSON.parse(await fs.readFile(path.join(outDir, 'report.json'), 'utf8'));
  assert.equal(report.counts.A, 1);
  assert.equal(report.counts.C, 1);
  assert.equal(report.papers.length, 2);
});
