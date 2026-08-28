import type { LatestReport, PaperView, ResearchConfig } from "../api/types";
import { generateWeeklySummary } from "./summary";

export const THERMOELECTRIC_CONFIG: ResearchConfig = {
  topics: [
    "thermoelectric",
    "thermoelectric machine learning",
    "composition property prediction",
    "doping optimization"
  ],
  priorityMaterials: ["GeTe", "Bi2Te3", "PbTe", "SnSe", "Ag2Se", "Mg3Sb2", "half-Heusler", "skutterudite"],
  mechanisms: ["weighted mobility", "B factor", "quality factor", "band convergence", "carrier concentration", "resonant level", "interface engineering", "strain engineering", "co-doping"],
  excludedTopics: ["battery", "photodetector", "photovoltaic", "spin Nernst", "anomalous Nernst"],
  priorityVenues: ["Advanced Materials", "Advanced Functional Materials", "Advanced Energy Materials", "Science Advances", "Energy & Environmental Science", "Joule", "Nature Communications", "Small"],
  researchers: [],
  strongEvidenceTerms: ["zT", "Seebeck", "power factor", "transport", "performance", "optimization"],
  peripheralTerms: ["flexible sensor", "wearable sensor", "photodetector"]
};

function paper(
  paperId: string,
  title: string,
  venue: string,
  grade: "A" | "B" | "C" | "D",
  score: number,
  reasons: string[],
  abstract: string
): PaperView {
  return {
    paperId,
    title,
    abstract,
    authors: [{ name: "Preview data" }],
    venue,
    publicationDate: new Date().toISOString().slice(0, 10),
    url: null,
    grade,
    score,
    reasons,
    feedbackState: null
  };
}

export function createDemoPapers(): PaperView[] {
  return [
    paper("demo-gete", "Strain engineering enables high thermoelectric performance in GeTe", "Advanced Energy Materials", "A", 82, ["Priority material: GeTe", "Mechanism: strain engineering", "Evidence: thermoelectric performance"], "Strain engineering is used to modify carrier transport and reduce detrimental scattering in GeTe. The study highlights a route toward higher thermoelectric performance through lattice and electronic-structure control."),
    paper("demo-sns", "Na/Ag co-doping optimization in SnS thermoelectrics", "Small", "A", 78, ["Topic: thermoelectric", "Mechanism: co-doping", "Evidence: optimization"], "Na/Ag co-doping is used to tune carrier concentration and transport in SnS. The work illustrates how coupled dopants can balance electrical and thermal transport."),
    paper("demo-mg3sb2", "Bi alloying and carrier optimization in Mg3Sb2", "Advanced Functional Materials", "A", 74, ["Priority material: Mg3Sb2", "Evidence: carrier optimization"], "Bi alloying is combined with carrier optimization in Mg3Sb2 to improve thermoelectric transport. The study targets the balance between carrier mobility, concentration, and lattice thermal conductivity."),
    paper("demo-ml", "Machine-learning-guided composition screening for thermoelectric materials", "Science Advances", "A", 70, ["Topic: thermoelectric machine learning", "Topic: composition property prediction"], "Machine learning is used to screen thermoelectric compositions and prioritize promising candidates. The workflow focuses on composition-derived information for rapid materials selection."),
    paper("demo-ag2se", "Interface-controlled transport in Ag2Se thermoelectric materials", "Journal of Materials Chemistry A", "B", 44, ["Priority material: Ag2Se", "Mechanism: interface engineering"], "Interface engineering is used to modify charge and heat transport in Ag2Se. The work links interfacial structure with thermoelectric transport behavior."),
    paper("demo-flex", "Flexible Bi2Te3 thermoelectric generator for temperature sensing", "Flexible Electronics", "C", 18, ["Priority material: Bi2Te3", "Peripheral context: flexible sensor"], "A flexible Bi2Te3 device is developed for temperature sensing and energy conversion."),
    paper("demo-photo", "Photothermoelectric position-sensitive detector based on Bi2Te3", "Device Physics", "D", -100, ["Excluded topic: photodetector"], "A Bi2Te3 photothermoelectric detector is demonstrated for position-sensitive sensing.")
  ];
}

export function createDemoReport(papers = createDemoPapers()): LatestReport {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const item of papers) counts[item.grade] += 1;
  return {
    runId: "demo-preview",
    lastSuccessfulUpdate: new Date().toISOString(),
    nextRunAt: null,
    gradeCounts: counts,
    sourceStatus: { mode: "preview" },
    topPapers: papers.filter(item => item.grade === "A").slice(0, 5),
    summary: generateWeeklySummary(papers)
  };
}
