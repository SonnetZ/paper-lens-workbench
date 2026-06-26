"use client";

import { FloppyDisk, LinkSimple } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type {
  EvidencePacket,
  EvidenceRouteEvent,
  PaperListItem,
  ScreeningDecision,
  ScreeningRow,
  ScreeningUpdateInput
} from "@/lib/types";
import { InfoHint } from "@/components/InfoHint";

const emptyScreening: ScreeningRow = {
  recordId: "",
  decision: "",
  primaryExclusionReason: "",
  eligibilityRationale: "",
  typologyRelevanceNotes: "",
  evaluationRelevanceNotes: "",
  promptingPracticesNotes: "",
  evidenceLocator: "",
  reviewStatus: "unreviewed",
  secondReviewReason: "",
  reviewer: "",
  reviewDate: ""
};

export function ScreeningForm({
  paper,
  evidence,
  evidenceRoute
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  evidenceRoute?: EvidenceRouteEvent | null;
}) {
  const [form, setForm] = useState<ScreeningRow>(emptyScreening);
  const [appliedRouteId, setAppliedRouteId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const latestEvidence = useMemo(
    () => evidence.find((item) => item.recordId === paper?.recordId) ?? null,
    [evidence, paper?.recordId]
  );

  useEffect(() => {
    if (!paper) {
      setForm(emptyScreening);
      return;
    }
    setStatus("loading");
    setMessage("");
    fetch(`/api/papers/${paper.recordId}/screening`)
      .then((response) => {
        if (!response.ok) throw new Error("Screening row not found");
        return response.json();
      })
      .then((data: { screening: ScreeningRow }) => {
        setForm((current) => mergeLoadedScreening(data.screening, current));
        setStatus("idle");
      })
      .catch((error: Error) => {
        setForm((current) =>
          mergeLoadedScreening(
            { ...emptyScreening, recordId: paper.recordId, reviewStatus: paper.reviewStatus },
            current
          )
        );
        setMessage(error.message);
        setStatus("error");
      });
  }, [paper]);

  useEffect(() => {
    if (
      !paper ||
      !evidenceRoute ||
      evidenceRoute.routeId === appliedRouteId ||
      evidenceRoute.evidence.recordId !== paper.recordId ||
      !evidenceRoute.target.startsWith("screening.")
    ) {
      return;
    }

    const field = evidenceRoute.target.replace(
      "screening.",
      ""
    ) as keyof Pick<
      ScreeningRow,
      | "eligibilityRationale"
      | "typologyRelevanceNotes"
      | "evaluationRelevanceNotes"
      | "promptingPracticesNotes"
    >;
    const text = evidenceText(evidenceRoute.evidence);
    setForm((current) => ({
      ...current,
      [field]: mergeText(String(current[field]), text),
      evidenceLocator: evidenceRoute.evidence.evidenceLocator
    }));
    setAppliedRouteId(evidenceRoute.routeId);
    if (status === "saved") setStatus("idle");
  }, [appliedRouteId, evidenceRoute, paper, status]);

  if (!paper) {
    return <p className="text-sm text-swiss-muted">No paper selected.</p>;
  }

  const update = (patch: Partial<ScreeningRow>) => {
    setForm((current) => ({ ...current, ...patch }));
    if (status === "saved") setStatus("idle");
  };

  const attachLatestEvidence = () => {
    if (!latestEvidence) return;
    const quote = latestEvidence.quoteSnippet || latestEvidence.reviewerNote;
    update({
      evidenceLocator: latestEvidence.evidenceLocator,
      eligibilityRationale: quote
        ? mergeText(form.eligibilityRationale, quote)
        : form.eligibilityRationale
    });
  };

  const save = async () => {
    setStatus("saving");
    setMessage("");
    const payload: ScreeningUpdateInput = {
      decision: form.decision,
      primaryExclusionReason: form.primaryExclusionReason,
      eligibilityRationale: form.eligibilityRationale,
      typologyRelevanceNotes: form.typologyRelevanceNotes,
      evaluationRelevanceNotes: form.evaluationRelevanceNotes,
      promptingPracticesNotes: form.promptingPracticesNotes,
      evidenceLocator: form.evidenceLocator,
      reviewStatus: form.reviewStatus || "screened",
      secondReviewReason: form.secondReviewReason,
      reviewer: form.reviewer,
      reviewDate: form.reviewDate
    };

    try {
      const response = await fetch(`/api/papers/${paper.recordId}/screening`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save screening");
      setForm(data.screening);
      setStatus("saved");
      setMessage("Screening saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save screening");
    }
  };

  return (
    <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
      <div className="workspace-status-strip review-meta-grid">
        <p className="review-meta-chip">
          <span className="review-meta-label">Decision</span>
          <strong className="review-meta-value">{form.decision || "unspecified"}</strong>
        </p>
        <p className="review-meta-chip">
          <span className="review-meta-label">Status</span>
          <strong className="review-meta-value">{form.reviewStatus || "unreviewed"}</strong>
        </p>
        <p className="review-meta-chip">
          <span className="review-meta-label">Reviewer</span>
          <strong className="review-meta-value">{form.reviewer || "not assigned"}</strong>
        </p>
        {form.secondReviewReason ? (
          <p className="review-meta-chip review-meta-alert">
            {form.secondReviewReason}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="screening-decision" className="text-xs font-semibold">
          Decision
        </label>
        <select
          id="screening-decision"
          value={form.decision}
          onChange={(event) =>
            update({
              decision: event.target.value as ScreeningDecision,
              reviewStatus: event.target.value ? "screened" : form.reviewStatus
            })
          }
          className="border border-swiss-rule bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Unspecified</option>
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
          <option value="maybe">Maybe</option>
        </select>
      </div>

      <TextAreaField
        id="eligibility-rationale"
        label="Eligibility rationale"
        value={form.eligibilityRationale}
        onChange={(value) => update({ eligibilityRationale: value })}
      />

      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <label htmlFor="evidence-locator" className="text-xs font-semibold">
            Screening evidence locator (MD/PDF)
          </label>
          <InfoHint label="Attach latest copies the newest item from Evidence tray into this screening rationale and locator field. You can also type an MD heading, PDF page, or tray locator manually." />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            id="evidence-locator"
            aria-label="Screening evidence locator"
            value={form.evidenceLocator}
            onChange={(event) => update({ evidenceLocator: event.target.value })}
            className="min-w-0 border border-swiss-rule px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            aria-label="Attach latest evidence"
            onClick={attachLatestEvidence}
            disabled={!latestEvidence}
            className="workbench-button"
            title="Insert the newest Evidence tray item into the rationale and locator."
          >
            <LinkSimple aria-hidden="true" size={14} weight="bold" />
            Attach latest
          </button>
        </div>
      </div>

      {form.decision === "exclude" ? (
        <InputField
          id="primary-exclusion-reason"
          label="Primary exclusion reason"
          value={form.primaryExclusionReason}
          onChange={(value) => update({ primaryExclusionReason: value })}
        />
      ) : null}

      <TextAreaField
        id="typology-relevance"
        label="Typology relevance notes"
        value={form.typologyRelevanceNotes}
        onChange={(value) => update({ typologyRelevanceNotes: value })}
      />
      <TextAreaField
        id="evaluation-relevance"
        label="Evaluation relevance notes"
        value={form.evaluationRelevanceNotes}
        onChange={(value) => update({ evaluationRelevanceNotes: value })}
      />
      <TextAreaField
        id="prompting-practices"
        label="Prompting practices notes"
        value={form.promptingPracticesNotes}
        onChange={(value) => update({ promptingPracticesNotes: value })}
      />

      <div className="grid grid-cols-2 gap-2">
        <InputField
          id="review-status"
          label="Review status"
          value={form.reviewStatus}
          onChange={(value) => update({ reviewStatus: value })}
        />
        <InputField
          id="second-review-reason"
          label="Second review reason"
          value={form.secondReviewReason}
          onChange={(value) => update({ secondReviewReason: value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InputField
          id="reviewer"
          label="Reviewer"
          value={form.reviewer}
          onChange={(value) => update({ reviewer: value })}
        />
        <InputField
          id="review-date"
          label="Review date"
          value={form.reviewDate}
          onChange={(value) => update({ reviewDate: value })}
        />
      </div>

      <button
        type="button"
        aria-label="Save screening"
        onClick={save}
        disabled={status === "saving" || status === "loading"}
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

function InputField({
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
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-swiss-rule px-2 py-1.5 text-sm"
      />
    </div>
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

function mergeLoadedScreening(loaded: ScreeningRow, current: ScreeningRow): ScreeningRow {
  if (current.recordId && current.recordId !== loaded.recordId) return loaded;
  return {
    ...loaded,
    decision: current.decision || loaded.decision,
    primaryExclusionReason: current.primaryExclusionReason.trim()
      ? current.primaryExclusionReason
      : loaded.primaryExclusionReason,
    eligibilityRationale: current.eligibilityRationale.trim()
      ? current.eligibilityRationale
      : loaded.eligibilityRationale,
    typologyRelevanceNotes: current.typologyRelevanceNotes.trim()
      ? current.typologyRelevanceNotes
      : loaded.typologyRelevanceNotes,
    evaluationRelevanceNotes: current.evaluationRelevanceNotes.trim()
      ? current.evaluationRelevanceNotes
      : loaded.evaluationRelevanceNotes,
    promptingPracticesNotes: current.promptingPracticesNotes.trim()
      ? current.promptingPracticesNotes
      : loaded.promptingPracticesNotes,
    evidenceLocator: current.evidenceLocator.trim()
      ? current.evidenceLocator
      : loaded.evidenceLocator,
    reviewStatus: current.reviewStatus !== "unreviewed" ? current.reviewStatus : loaded.reviewStatus,
    secondReviewReason: current.secondReviewReason.trim()
      ? current.secondReviewReason
      : loaded.secondReviewReason,
    reviewer: current.reviewer.trim() ? current.reviewer : loaded.reviewer,
    reviewDate: current.reviewDate.trim() ? current.reviewDate : loaded.reviewDate
  };
}
