import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { convertDigest } from './convert-paper-digest.mjs';

function gradeOf(paper = {}) {
  for (const field of ['final_grade', 'semantic_grade', 'rule_grade', 'grade']) {
    const value = String(paper[field] || '').trim().toUpperCase().slice(0, 1);
    if (['A', 'B', 'C', 'D'].includes(value)) return value;
  }
  return 'unknown';
}

export function buildComparison(digest = {}, snapshot = {}) {
  const candidateCount = convertDigest(digest).length;
  const papers = Array.isArray(snapshot?.papers) ? snapshot.papers : [];
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, unknown: 0 };
  const topByGrade = { A: [], B: [], C: [], D: [], unknown: [] };

  for (const paper of papers) {
    const grade = gradeOf(paper);
    gradeCounts[grade] += 1;
    const title = String(paper.title || '').trim();
    if (title && topByGrade[grade].length < 20) topByGrade[grade].push(title);
  }

  return {
    candidate_count: candidateCount,
    paperecho_stored_count: papers.length,
    duplicate_reduction: Math.max(0, candidateCount - papers.length),
    grade_counts: gradeCounts,
    top_by_grade: topByGrade,
  };
}

function markdown(comparison) {
  const lines = [
    '# PaperEcho Thermoelectric Evaluation',
    '',
    `- Unique paper-digest candidates: **${comparison.candidate_count}**`,
    `- PaperEcho stored papers: **${comparison.paperecho_stored_count}**`,
    `- Duplicate/invalid reduction after import: **${comparison.duplicate_reduction}**`,
    `- Grades: **A ${comparison.grade_counts.A} / B ${comparison.grade_counts.B} / C ${comparison.grade_counts.C} / D ${comparison.grade_counts.D} / unknown ${comparison.grade_counts.unknown}**`,
    '',
  ];
  for (const grade of ['A', 'B', 'C', 'D', 'unknown']) {
    lines.push(`## ${grade}`);
    const titles = comparison.top_by_grade[grade] || [];
    if (!titles.length) lines.push('- None');
    else for (const title of titles) lines.push(`- ${title}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export async function writeComparison(comparison, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outputDir, 'comparison.md'), markdown(comparison), 'utf8');
}

async function main() {
  const [, , digestPath, snapshotPath, outputDir] = process.argv;
  if (!digestPath || !snapshotPath || !outputDir) {
    console.error('Usage: node scripts/paperecho/compare-results.mjs <latest.json> <papers.json> <output-dir>');
    process.exit(2);
  }
  const digest = JSON.parse(await fs.readFile(digestPath, 'utf8'));
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  const comparison = buildComparison(digest, snapshot);
  await writeComparison(comparison, outputDir);
  console.log(JSON.stringify(comparison, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
