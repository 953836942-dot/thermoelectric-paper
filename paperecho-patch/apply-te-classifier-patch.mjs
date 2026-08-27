import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function applyPatch(filePath) {
  const resolved = path.resolve(filePath);
  let source = await fs.readFile(resolved, 'utf8');

  const configAnchor = 'const GRADING_RULES = TRIAGE_RULES.grading_rules || {};';
  if (!source.includes(configAnchor)) {
    throw new Error('PAPERECHO_PATCH_ANCHOR_MISSING:grading_rules');
  }
  if (!source.includes('legacy_biomedical_hard_excludes')) {
    source = source.replace(
      configAnchor,
      `${configAnchor}\nconst LEGACY_BIOMEDICAL_HARD_EXCLUDES = TRIAGE_RULES.legacy_biomedical_hard_excludes !== false;\nconst CONFIGURED_NEGATIVE_KEYWORDS = TRIAGE_RULES.keyword_policy?.negative_keywords || [];`,
    );
  }

  const countHitsAnchor = `function countHits(text, terms) {\n  return terms.filter((term) => matchesTerm(text, term));\n}`;
  if (!source.includes(countHitsAnchor)) {
    throw new Error('PAPERECHO_PATCH_ANCHOR_MISSING:countHits');
  }
  if (!source.includes('function configuredNegativeHit')) {
    source = source.replace(
      countHitsAnchor,
      `${countHitsAnchor}\n\nfunction configuredNegativeHit(text) {\n  return CONFIGURED_NEGATIVE_KEYWORDS.find((term) => matchesTerm(text, term)) || \"\";\n}`,
    );
  }

  const classifyAnchor = `  const journal = String(item.journal || \"\").toLowerCase().trim();\n\n  // D-grade rules have HIGHEST priority`;
  if (!source.includes(classifyAnchor)) {
    throw new Error('PAPERECHO_PATCH_ANCHOR_MISSING:classify');
  }
  if (!source.includes('d_grade_rule:configured_negative_keyword')) {
    source = source.replace(
      classifyAnchor,
      `  const journal = String(item.journal || \"\").toLowerCase().trim();\n\n  const configuredNegativeKeyword = configuredNegativeHit(text);\n  if (configuredNegativeKeyword) {\n    return {\n      grade: \"D\",\n      grade_label: LABELS.D,\n      grade_reason: \`Configured negative keyword: \${configuredNegativeKeyword}\`,\n      classification_reason: \"Matched configured negative keyword exclusion\",\n      hard_excluded: true,\n      matched_standard_rules: [],\n      matched_signals: [\"d_grade_rule:configured_negative_keyword\"],\n      writeback_ready: false,\n      triage_version: TRIAGE_VERSION,\n      standards_used: false,\n      flags: { uncertain: false, needs_review: false },\n      score: 0,\n      source: sourceLabel(item.source_platform, item.source_channel),\n      dedupe_key: buildDedupeKey(item),\n      scoring_detail: { d_grade_rule: \"configured_negative_keyword\", keyword: configuredNegativeKeyword },\n    };\n  }\n\n  // D-grade rules have HIGHEST priority`,
    );
  }

  const replacements = [
    ['if (isEnvironmentalPollutantFateStudy(text)) {', 'if (LEGACY_BIOMEDICAL_HARD_EXCLUDES && isEnvironmentalPollutantFateStudy(text)) {'],
    ['if (isKeywordOnlyMatchWithoutRelevance(text)) {', 'if (LEGACY_BIOMEDICAL_HARD_EXCLUDES && isKeywordOnlyMatchWithoutRelevance(text)) {'],
    ['if (isPureEngineeringOrMaterialsStudy(text)) {', 'if (LEGACY_BIOMEDICAL_HARD_EXCLUDES && isPureEngineeringOrMaterialsStudy(text)) {'],
    ['if (isPlantOnlyStudy(text)) {', 'if (LEGACY_BIOMEDICAL_HARD_EXCLUDES && isPlantOnlyStudy(text)) {'],
    ['if (isNonMammalianModelWithoutInsight(text)) {', 'if (LEGACY_BIOMEDICAL_HARD_EXCLUDES && isNonMammalianModelWithoutInsight(text)) {'],
    ['if (isOutOfScopeTopic(text)) {', 'if (LEGACY_BIOMEDICAL_HARD_EXCLUDES && isOutOfScopeTopic(text)) {'],
  ];
  for (const [from, to] of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`PAPERECHO_PATCH_ANCHOR_MISSING:${from}`);
    source = source.replace(from, to);
  }

  await fs.writeFile(resolved, source, 'utf8');
  return resolved;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node paperecho-patch/apply-te-classifier-patch.mjs <rule_classifier.mjs>');
    process.exit(2);
  }
  const patched = await applyPatch(target);
  console.log(`PATCHED=${patched}`);
}
