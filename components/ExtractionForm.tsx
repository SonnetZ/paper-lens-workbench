"use client";

import { FloppyDisk, LinkSimple } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type {
  EvidencePacket,
  EvidenceRouteEvent,
  ExtractionArtifact,
  ExtractionArtifactInput,
  PaperListItem
} from "@/lib/types";
import { InfoHint } from "@/components/InfoHint";

const emptyExtraction: ExtractionArtifact = {
  recordId: "",
  methodTypology: "",
  promptingPractices: "",
  evaluationPractices: "",
  synthesisNote: "",
  evidenceLocator: "",
  updatedAt: ""
};

type ExtractionField = keyof ExtractionArtifactInput;

const attachableFields: Array<{ value: ExtractionField; label: string }> = [
  { value: "methodTypology", label: "Method typology" },
  { value: "promptingPractices", label: "Prompting practices" },
  { value: "evaluationPractices", label: "Evaluation practices" },
  { value: "synthesisNote", label: "Synthesis note" }
];

export function ExtractionForm({
  paper,
  evidence,
  evidenceRoute
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  evidenceRoute?: EvidenceRouteEvent | null;
}) {
  const [form, setForm] = useState<ExtractionArtifact>(emptyExtraction);
  const [attachTarget, setAttachTarget] = useState<ExtractionField>("methodTypology");
  const [appliedRouteId, setAppliedRouteId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const latestEvidence = useMemo(
    () => evidence.find((item) => item.recordId === paper?.recordId) ?? null,
    [evidence, paper?.recordId]
  );

  useEffect(() => {
    if (!paper) {
      setForm(emptyExtraction);
      setStatus("idle");
      setMessage("");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setMessage("");
    fetch(`/api/papers/${paper.recordId}/extraction`)
      .then((response) => {
        if (!response.ok) throw new Error("Extraction artifact not available");
        return response.json();
      })
      .then((data: { extraction: ExtractionArtifact }) => {
        if (cancelled) return;
        setForm((current) => mergeLoadedExtraction(data.extraction, current));
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setForm((current) =>
          mergeLoadedExtraction({ ...emptyExtraction, recordId: paper.recordId }, current)
        );
        setStatus("error");
        setMessage(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [paper]);

  useEffect(() => {
    if (
      !paper ||
      !evidenceRoute ||
      evidenceRoute.routeId === appliedRouteId ||
      evidenceRoute.evidence.recordId !== paper.recordId ||
      !evidenceRoute.target.startsWith("extraction.")
    ) {
      return;
    }

    const field = evidenceRoute.target.replace("extraction.", "") as ExtractionField;
    const text = evidenceText(evidenceRoute.evidence);
    setForm((current) => ({
      ...current,
      [field]: mergeText(String(current[field]), text),
      evidenceLocator: evidenceRoute.evidence.evidenceLocator
    }));
    setAppliedRouteId(evidenceRoute.routeId);
    if (status === "saved") setStatus("idle");
  }, [appliedRouteId, evidenceRoute, paper, status]);

  if (!paper) return <p className="text-sm text-swiss-muted">No paper selected.</p>;

  const update = (patch: Partial<ExtractionArtifact>) => {
    setForm((current) => ({ ...current, ...patch }));
    if (status === "saved") setStatus("idle");
  };

  const attachLatestEvidence = () => {
    if (!latestEvidence) return;
    const quote = latestEvidence.quoteSnippet || latestEvidence.reviewerNote;
    const evidenceText = quote
      ? `${latestEvidence.evidenceLocator}: ${quote}`
      : latestEvidence.evidenceLocator;
    update({
      [attachTarget]: mergeText(String(form[attachTarget]), evidenceText),
      evidenceLocator: latestEvidence.evidenceLocator
    });
  };

  const save = async () => {
    setStatus("saving");
    setMessage("");
    const payload: ExtractionArtifactInput = {
      methodTypology: form.methodTypology,
      promptingPractices: form.promptingPractices,
      evaluationPractices: form.evaluationPractices,
      synthesisNote: form.synthesisNote,
      evidenceLocator: form.evidenceLocator
    };

    try {
      const response = await fetch(`/api/papers/${paper.recordId}/extraction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save extraction");
      setForm(data.extraction);
      setStatus("saved");
      setMessage("Extraction saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save extraction");
    }
  };

  return (
    <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
      <TextAreaField
        id="method-typology"
        label="Method typology"
        value={form.methodTypology}
        onChange={(value) => update({ methodTypology: value })}
      />
      <TextAreaField
        id="prompting-practices-extraction"
        label="Prompting practices"
        value={form.promptingPractices}
        onChange={(value) => update({ promptingPractices: value })}
      />
      <TextAreaField
        id="evaluation-practices-extraction"
        label="Evaluation practices"
        value={form.evaluationPractices}
        onChange={(value) => update({ evaluationPractices: value })}
      />
      <TextAreaField
        id="synthesis-note"
        label="Synthesis note"
        value={form.synthesisNote}
        onChange={(value) => update({ synthesisNote: value })}
      />

      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <label htmlFor="extraction-evidence-locator" className="text-xs font-semibold">
            Extraction evidence locator (MD/PDF)
          </label>
          <InfoHint label="Use an MD heading, PDF page, or Evidence tray locator so this extraction note can be traced back to the source." />
        </div>
        <input
          id="extraction-evidence-locator"
          aria-label="Extraction evidence locator"
          value={form.evidenceLocator}
          onChange={(event) => update({ evidenceLocator: event.target.value })}
          className="min-w-0 border border-swiss-rule px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-swiss-rule pt-3">
        <div className="grid gap-1.5">
          <label htmlFor="extraction-attach-target" className="text-xs font-semibold">
            Attach evidence to
          </label>
          <select
            id="extraction-attach-target"
            value={attachTarget}
            onChange={(event) => setAttachTarget(event.target.value as ExtractionField)}
            className="border border-swiss-rule bg-white px-2 py-1.5 text-sm"
          >
            {attachableFields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          aria-label="Attach latest evidence"
          onClick={attachLatestEvidence}
          disabled={!latestEvidence}
          className="workbench-button self-end"
          title="Insert the newest Evidence tray item into the selected extraction field."
        >
          <LinkSimple aria-hidden="true" size={14} weight="bold" />
          Attach latest
        </button>
      </div>

      <button
        type="button"
        aria-label="Save extraction"
        onClick={save}
        disabled={status === "loading" || status === "saving"}
        className="workbench-button workbench-button-primary"
      >
        <FloppyDisk aria-hidden="true" size={15} weight="bold" />
        {status === "saving" ? "Saving" : "Save"}
      </button>
      {message ? (
        <p
          className={`border-t border-swiss-rule pt-2 text-sm ${
            status === "error" ? "text-swiss-red" : "text-swiss-ink"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-20 resize-y border border-swiss-rule px-2 py-1.5 text-sm leading-5"
      />
    </div>
  );
}

function mergeText(existing: string, addition: string): string {
  if (!existing.trim()) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing.trim()}\n\n${addition}`;
}

function evidenceText(evidence: EvidencePacket): string {
  const quote = evidence.quoteSnippet || evidence.reviewerNote;
  return quote ? `${evidence.evidenceLocator}: ${quote}` : evidence.evidenceLocator;
}

function mergeLoadedExtraction(
  loaded: ExtractionArtifact,
  current: ExtractionArtifact
): ExtractionArtifact {
  if (current.recordId && current.recordId !== loaded.recordId) return loaded;
  return {
    ...loaded,
    methodTypology: current.methodTypology.trim() ? current.methodTypology : loaded.methodTypology,
    promptingPractices: current.promptingPractices.trim()
      ? current.promptingPractices
      : loaded.promptingPractices,
    evaluationPractices: current.evaluationPractices.trim()
      ? current.evaluationPractices
      : loaded.evaluationPractices,
    synthesisNote: current.synthesisNote.trim() ? current.synthesisNote : loaded.synthesisNote,
    evidenceLocator: current.evidenceLocator.trim()
      ? current.evidenceLocator
      : loaded.evidenceLocator
  };
}
