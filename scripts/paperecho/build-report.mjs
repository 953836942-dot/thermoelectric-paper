import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ORDER = { A: 0, B: 1, C: 2, D: 3, unknown: 4 };

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function gradeOf(paper) {
  const grade = String(paper.final_grade || paper.grade || paper.rule_grade || 'unknown').toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(grade) ? grade : 'unknown';
}

function dateText(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function paperUrl(paper) {
  if (paper.url) return paper.url;
  if (paper.doi) return `https://doi.org/${paper.doi}`;
  return '';
}

function sourceText(paper) {
  return paper.journal || paper.publicationTitle || paper.source_channel || paper.source_platform || '';
}

function normalizePapers(payload) {
  const raw = Array.isArray(payload) ? payload : (payload.papers || payload.items || []);
  return raw.map((paper) => ({
    title: paper.title || 'Untitled',
    abstract: paper.abstract || '',
    grade: gradeOf(paper),
    journal: sourceText(paper),
    date: dateText(paper.pubdate || paper.publication_date || paper.published_at),
    doi: paper.doi || '',
    url: paperUrl(paper),
    authors: Array.isArray(paper.authors) ? paper.authors : [],
    reason: paper.grade_reason || paper['推荐理由'] || paper.classification_reason || '',
    source_channel: paper.source_channel || '',
  })).sort((a, b) => {
    const gradeDiff = (ORDER[a.grade] ?? 9) - (ORDER[b.grade] ?? 9);
    if (gradeDiff) return gradeDiff;
    return String(b.date).localeCompare(String(a.date));
  });
}

function card(paper, top = false) {
  const meta = [paper.journal, paper.date, paper.authors.slice(0, 4).join(', ')].filter(Boolean).join(' · ');
  const title = paper.url
    ? `<a class="paper-title" href="${esc(paper.url)}" target="_blank" rel="noopener">${esc(paper.title)}</a>`
    : `<span class="paper-title">${esc(paper.title)}</span>`;
  const abstract = paper.abstract
    ? `<details><summary>Abstract</summary><p class="abstract">${esc(paper.abstract)}</p></details>`
    : '';
  return `<article class="paper ${top ? 'top-paper' : ''}">
    <div class="paper-head"><span class="badge grade-${esc(paper.grade)}">${esc(paper.grade)}</span>${title}</div>
    ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
    ${paper.reason ? `<div class="reason">${esc(paper.reason)}</div>` : ''}
    ${paper.doi ? `<div class="doi">DOI: ${esc(paper.doi)}</div>` : ''}
    ${abstract}
  </article>`;
}

function section(grade, papers) {
  const label = {
    A: 'A · Read first', B: 'B · Strong relevance', C: 'C · Broad relevance', D: 'D · Out of scope / false positive', unknown: 'Unknown'
  }[grade] || grade;
  return `<section id="grade-${grade}"><h2>${esc(label)} <span class="section-count">${papers.length}</span></h2>${papers.length ? papers.map((p) => card(p)).join('\n') : '<p class="empty">None this week.</p>'}</section>`;
}

export async function buildReport(papersPath, comparisonPath, outDir) {
  const papersPayload = JSON.parse(await fs.readFile(papersPath, 'utf8'));
  const comparison = JSON.parse(await fs.readFile(comparisonPath, 'utf8'));
  const papers = normalizePapers(papersPayload);
  const counts = { A: 0, B: 0, C: 0, D: 0, unknown: 0 };
  for (const paper of papers) counts[paper.grade] = (counts[paper.grade] || 0) + 1;

  const top = papers.filter((p) => p.grade === 'A');
  const generated = new Date().toISOString();
  const report = {
    generated_at: generated,
    candidate_count: comparison.candidate_count ?? papers.length,
    counts,
    papers,
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PaperEcho-TE Weekly</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202a;background:#f5f6f8;line-height:1.55}*{box-sizing:border-box}body{margin:0}.wrap{max-width:1100px;margin:0 auto;padding:36px 22px 80px}.hero{background:#fff;border:1px solid #e7e9ee;border-radius:20px;padding:28px 30px;box-shadow:0 8px 28px rgba(30,40,60,.06)}h1{font-size:34px;margin:0 0 5px;letter-spacing:-.02em}.subtitle{color:#667085;margin:0}.counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0 4px}.count{background:#f7f8fa;border-radius:14px;padding:14px 16px}.count strong{display:block;font-size:28px}.count span{font-size:13px;color:#667085}.top{margin:34px 0}.top h2,section h2{font-size:22px;margin:28px 0 14px}.section-count{font-size:14px;color:#667085;font-weight:500}.paper{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:17px 18px;margin:10px 0}.top-paper{border-left:5px solid #222;padding-left:15px}.paper-head{display:flex;gap:10px;align-items:flex-start}.paper-title{font-size:16px;font-weight:700;color:#182230;text-decoration:none}.paper-title:hover{text-decoration:underline}.badge{display:inline-flex;min-width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;font-weight:800;font-size:13px;background:#eef0f3}.grade-A{background:#e9f6ee}.grade-B{background:#eef3fb}.grade-C{background:#f5f1e7}.grade-D{background:#f6eaea}.meta,.doi{color:#667085;font-size:13px;margin:7px 0 0 38px}.reason{margin:9px 0 0 38px;font-size:14px;color:#344054}.abstract{color:#475467;font-size:14px}details{margin:8px 0 0 38px}summary{cursor:pointer;color:#667085;font-size:13px}.empty{color:#98a2b3}.note{margin-top:20px;color:#667085;font-size:13px}.links{margin-top:12px;font-size:14px}.links a{color:#344054}.footer{margin-top:42px;color:#98a2b3;font-size:12px}@media(max-width:700px){.counts{grid-template-columns:repeat(2,1fr)}.wrap{padding:20px 12px}.hero{padding:20px}.meta,.doi,.reason,details{margin-left:0}.paper-head{align-items:flex-start}}
</style></head><body><main class="wrap">
<div class="hero"><h1>PaperEcho-TE Weekly</h1><p class="subtitle">Thermoelectric literature triage · ${esc(generated.slice(0,10))}</p>
<div class="counts">
<div class="count"><strong>${counts.A}</strong><span>A · Read first</span></div><div class="count"><strong>${counts.B}</strong><span>B · Strong</span></div><div class="count"><strong>${counts.C}</strong><span>C · Broad</span></div><div class="count"><strong>${counts.D}</strong><span>D · Excluded</span></div>
</div><p class="note">Candidate papers: ${esc(report.candidate_count)}. A is intentionally strict; B/C keep useful context without crowding the read-first list.</p></div>
<section class="top"><h2>Top papers this week</h2>${top.length ? top.map((p) => card(p, true)).join('\n') : '<p class="empty">No A-grade papers this week.</p>'}</section>
${['A','B','C','D'].map((g) => section(g, papers.filter((p) => p.grade === g))).join('\n')}
<div class="links"><a href="report.json">Open structured report.json</a></div>
<div class="footer">Generated by the repository-side PaperEcho-TE layer. Classification is deterministic and configuration-driven; no LLM/API key is required for this report.</div>
</main></body></html>`;
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [papersPath, comparisonPath, outDir] = process.argv.slice(2);
  if (!papersPath || !comparisonPath || !outDir) {
    console.error('Usage: node scripts/paperecho/build-report.mjs <papers.json> <comparison.json> <out-dir>');
    process.exit(2);
  }
  const report = await buildReport(papersPath, comparisonPath, outDir);
  console.log(`REPORT_OK=1 A=${report.counts.A} B=${report.counts.B} C=${report.counts.C} D=${report.counts.D}`);
}
