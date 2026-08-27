import test from 'node:test';
import assert from 'node:assert/strict';

import { convertDigest } from '../../scripts/paperecho/convert-paper-digest.mjs';

const digest = {
  feeds: [
    {
      name: 'PRIORITY - Doping Optimization and Transport',
      papers: [
        {
          title: 'High-zT GeTe by band engineering',
          summary: 'GeTe thermoelectric performance improves through band convergence.',
          authors: ['A. Author', 'B. Author'],
          doi: '10.1000/gete.1',
          paper_id: 'openalex:W1',
          abstract_url: 'https://doi.org/10.1000/gete.1',
          published_at: '2026-08-25T00:00:00+00:00',
          source: 'openalex',
          canonical_id: 'doi:10.1000/gete.1'
        }
      ]
    },
    {
      name: 'Broad Thermoelectric Safety Net',
      papers: [
        {
          title: 'High-zT GeTe by band engineering',
          summary: 'Duplicate feed occurrence.',
          authors: ['A. Author'],
          doi: '10.1000/gete.1',
          paper_id: 'openalex:W1',
          abstract_url: 'https://doi.org/10.1000/gete.1',
          published_at: '2026-08-25T00:00:00+00:00',
          source: 'openalex',
          canonical_id: 'doi:10.1000/gete.1'
        },
        {
          title: 'Thermoelectric preprint without DOI',
          summary: 'Ag2Se flexible thermoelectric film.',
          authors: ['C. Author'],
          paper_id: 'arxiv:2608.12345',
          abstract_url: 'https://arxiv.org/abs/2608.12345',
          arxiv_id: '2608.12345',
          published_at: '2026-08-26T00:00:00+00:00',
          source: 'arxiv',
          canonical_id: 'arxiv:2608.12345'
        }
      ]
    }
  ]
};

test('convertDigest deduplicates canonical papers and maps PaperEcho fields', () => {
  const output = convertDigest(digest);
  assert.equal(output.length, 2);

  const gete = output.find((item) => item.doi === '10.1000/gete.1');
  assert.ok(gete);
  assert.equal(gete.abstract, 'GeTe thermoelectric performance improves through band convergence.');
  assert.equal(gete.openalex_id, 'W1');
  assert.equal(
    gete.source_channel,
    'PRIORITY - Doping Optimization and Transport | Broad Thermoelectric Safety Net'
  );

  const arxiv = output.find((item) => item.external_id === 'arxiv:2608.12345');
  assert.ok(arxiv);
  assert.equal(arxiv.url, 'https://arxiv.org/abs/2608.12345');
  assert.equal(arxiv.abstract, 'Ag2Se flexible thermoelectric film.');
});
