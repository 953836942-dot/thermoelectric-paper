import { useEffect, useState } from "preact/hooks";
import type { LiteratureApiClient } from "../api/client";
import type { ResearchConfig } from "../api/types";
import { THERMOELECTRIC_CONFIG } from "../local/defaults";

interface ResearchPageProps {
  api: Pick<LiteratureApiClient, "getProfile" | "updateProfile">;
}

interface Draft {
  topics: string;
  priorityMaterials: string;
  mechanisms: string;
  researchers: string;
  excludedTopics: string;
  priorityVenues: string;
}

function lines(values: string[]): string {
  return values.join("\n");
}

function split(value: string): string[] {
  return [...new Set(value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean))];
}

function draftFromConfig(config: ResearchConfig): Draft {
  return {
    topics: lines(config.topics),
    priorityMaterials: lines(config.priorityMaterials),
    mechanisms: lines(config.mechanisms),
    researchers: lines(config.researchers.map(item => item.name)),
    excludedTopics: lines(config.excludedTopics),
    priorityVenues: lines(config.priorityVenues)
  };
}

function configFromDraft(draft: Draft, previous: ResearchConfig): ResearchConfig {
  return {
    ...previous,
    topics: split(draft.topics),
    priorityMaterials: split(draft.priorityMaterials),
    mechanisms: split(draft.mechanisms),
    researchers: split(draft.researchers).map(name => ({ name, openalexId: "" })),
    excludedTopics: split(draft.excludedTopics),
    priorityVenues: split(draft.priorityVenues)
  };
}

export function ResearchPage({ api }: ResearchPageProps) {
  const [base, setBase] = useState<ResearchConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void api.getProfile().then(profile => {
      setBase(profile.config);
      setDraft(draftFromConfig(profile.config));
    });
  }, [api]);

  if (!draft || !base) return <main class="dashboard-content"><p class="dashboard-status">Loading research settings…</p></main>;

  function update(field: keyof Draft, value: string) {
    setDraft(current => current ? { ...current, [field]: value } : current);
    setStatus(null);
  }

  async function save() {
    if (!split(draft.topics).length) {
      setStatus("Add at least one research topic.");
      return;
    }
    setSaving(true);
    try {
      const profile = await api.updateProfile({ config: configFromDraft(draft, base) });
      setBase(profile.config);
      setDraft(draftFromConfig(profile.config));
      setStatus("Saved locally in this browser.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  function loadThermoelectric() {
    setDraft(draftFromConfig(THERMOELECTRIC_CONFIG));
    setStatus("Thermoelectric starter loaded. Click Save to keep it.");
  }

  const fields: Array<{ key: keyof Draft; label: string; hint: string }> = [
    { key: "topics", label: "Research directions", hint: "One per line, e.g. thermoelectric machine learning" },
    { key: "priorityMaterials", label: "Priority materials / systems", hint: "e.g. GeTe, Bi2Te3, PbTe" },
    { key: "mechanisms", label: "Mechanisms / methods", hint: "e.g. doping optimization, band convergence" },
    { key: "researchers", label: "Researchers", hint: "Names are enough in B-lite" },
    { key: "priorityVenues", label: "Priority journals", hint: "e.g. Advanced Materials, Science Advances" },
    { key: "excludedTopics", label: "Exclude topics", hint: "e.g. battery, photodetector" }
  ];

  return (
    <main class="dashboard-content">
      <section class="dashboard-hero research-hero">
        <div>
          <p class="eyebrow">LOCAL-FIRST SETTINGS</p>
          <h1>Research settings</h1>
          <p class="dashboard-subtitle">These settings stay in this browser. No account or shared user database is required.</p>
        </div>
        <button class="secondary-button template-button" type="button" onClick={loadThermoelectric}>Load thermoelectric starter</button>
      </section>

      <section class="settings-grid">
        {fields.map(field => (
          <label class="settings-card" key={field.key}>
            <span class="settings-label">{field.label}</span>
            <span class="settings-hint">{field.hint}</span>
            <textarea value={draft[field.key]} onInput={event => update(field.key, (event.currentTarget as HTMLTextAreaElement).value)} rows={5} />
          </label>
        ))}
      </section>

      <div class="settings-actions">
        <button class="primary-button settings-save" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</button>
        {status ? <span class="settings-status" role="status">{status}</span> : null}
      </div>
    </main>
  );
}
