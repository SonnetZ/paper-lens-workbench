"use client";

import {
  CaretDown,
  CaretUp,
  FloppyDisk,
  PaperPlaneTilt,
  Plus,
  Trash
} from "@phosphor-icons/react";
import { useState } from "react";
import type {
  EvidenceInput,
  EvidencePacket,
  EvidenceRouteInput,
  ReviewFieldTarget
} from "@/lib/types";
import { InfoHint } from "@/components/InfoHint";

const routeTargets: Array<{ value: ReviewFieldTarget; label: string }> = [
  { value: "screening.eligibilityRationale", label: "Screening: Eligibility rationale" },
  { value: "screening.typologyRelevanceNotes", label: "Screening: Typology relevance" },
  { value: "screening.evaluationRelevanceNotes", label: "Screening: Evaluation relevance" },
  { value: "screening.promptingPracticesNotes", label: "Screening: Prompting practices" },
  { value: "extraction.methodTypology", label: "Extraction: Method typology" },
  { value: "extraction.promptingPractices", label: "Extraction: Prompting practices" },
  { value: "extraction.evaluationPractices", label: "Extraction: Evaluation practices" },
  { value: "extraction.synthesisNote", label: "Extraction: Synthesis note" }
];

export function EvidenceTray({
  recordId,
  evidence,
  status = "idle",
  message = "",
  onManualEvidence,
  onRouteEvidence,
  onPdfVerificationNote,
  onDeleteEvidence
}: {
  recordId: string | null;
  evidence: EvidencePacket[];
  status?: "idle" | "loading" | "saving" | "error";
  message?: string;
  onManualEvidence?: (input: EvidenceInput) => void;
  onRouteEvidence?: (input: EvidenceRouteInput) => void;
  onPdfVerificationNote?: (evidenceId: string, note: string) => void;
  onDeleteEvidence?: (evidenceId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [reviewerNote, setReviewerNote] = useState("");
  const [locator, setLocator] = useState("Reviewer note");
  const [routeTargetsByEvidenceId, setRouteTargetsByEvidenceId] = useState<
    Record<string, ReviewFieldTarget>
  >({});
  const [pdfVerificationNotesByEvidenceId, setPdfVerificationNotesByEvidenceId] = useState<
    Record<string, string>
  >({});
  const canAddNote = Boolean(
    recordId && reviewerNote.trim() && locator.trim() && status !== "saving"
  );

  const addManualEvidence = () => {
    if (!recordId || !canAddNote) return;
    onManualEvidence?.({
      recordId,
      sourceFormat: "manual",
      sourcePath: null,
      evidenceLocator: locator.trim(),
      quoteSnippet: "",
      headingPath: null,
      pageNumber: null,
      reviewerNote: reviewerNote.trim(),
      pdfVerificationNote: ""
    });
    setReviewerNote("");
    setLocator("Reviewer note");
  };

  const statusText =
    status === "loading"
      ? "Loading evidence packets."
      : status === "saving"
        ? "Saving evidence packet."
        : message;

  return (
    <aside
      aria-labelledby="evidence-tray-title"
      className={`evidence-tray border-t border-swiss-rule bg-swiss-wash px-4 py-3 ${
        collapsed ? "evidence-tray-collapsed" : "evidence-tray-expanded"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 id="evidence-tray-title" className="text-sm font-semibold">
            Evidence tray
          </h2>
          <InfoHint label="Selected text and reviewer notes appear here." />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-swiss-muted">{evidence.length} items</span>
          <button
            type="button"
            aria-label={collapsed ? "Expand evidence tray" : "Collapse evidence tray"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
            className="workbench-icon-button workbench-icon-button-sm"
          >
            {collapsed ? (
              <CaretUp aria-hidden="true" weight="bold" className="size-3.5" />
            ) : (
              <CaretDown aria-hidden="true" weight="bold" className="size-3.5" />
            )}
          </button>
        </div>
      </div>
      {collapsed ? null : (
        <>
      {statusText ? (
        <p
          className={`mt-2 border-t border-swiss-rule pt-2 text-xs ${
            status === "error" ? "text-swiss-red" : "text-swiss-muted"
          }`}
        >
          {statusText}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2 border-t border-swiss-rule pt-3">
        <div className="grid gap-1.5">
          <label htmlFor="manual-evidence-note" className="text-xs font-semibold">
            Reviewer note
          </label>
          <textarea
            id="manual-evidence-note"
            value={reviewerNote}
            onChange={(event) => setReviewerNote(event.target.value)}
            className="min-h-16 resize-y border border-swiss-rule bg-white px-2 py-1.5 text-sm leading-5"
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="grid gap-1.5">
            <label htmlFor="manual-evidence-locator" className="text-xs font-semibold">
              Note locator
            </label>
            <input
              id="manual-evidence-locator"
              value={locator}
              onChange={(event) => setLocator(event.target.value)}
              className="min-w-0 border border-swiss-rule bg-white px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            aria-label="Add note as evidence"
            onClick={addManualEvidence}
            disabled={!canAddNote}
            className="workbench-button self-end"
          >
            <Plus aria-hidden="true" size={14} weight="bold" />
            Add note
          </button>
        </div>
      </div>
      <div className="evidence-list">
        {evidence.length === 0 ? (
        <p className="text-sm text-swiss-muted">No evidence yet.</p>
        ) : (
        <ol className="grid gap-2">
          {evidence.map((item, index) => {
            const pdfVerificationNote =
              pdfVerificationNotesByEvidenceId[item.id] ?? item.pdfVerificationNote;

            return (
              <li key={item.id} className="evidence-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-swiss-red">{item.evidenceLocator}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase text-swiss-muted">
                      {item.sourceFormat}
                      {item.pageNumber ? ` / p.${item.pageNumber}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete evidence ${index + 1}`}
                    onClick={() => onDeleteEvidence?.(item.id)}
                    disabled={status === "saving"}
                    className="workbench-icon-button workbench-icon-button-sm"
                  >
                    <Trash aria-hidden="true" size={13} weight="bold" />
                  </button>
                </div>
                <p className="mt-1 line-clamp-2">{item.quoteSnippet || item.reviewerNote}</p>
                {item.pdfVerificationNote.trim() ? (
                  <p className="mt-2 border-t border-swiss-rule pt-2 text-xs text-swiss-muted">
                    PDF verification note: {item.pdfVerificationNote}
                  </p>
                ) : null}
                <div className="mt-2 grid gap-1.5 border-t border-swiss-rule pt-2">
                  <label
                    htmlFor={`pdf-verification-note-${item.id}`}
                    className="text-xs font-semibold text-swiss-ink"
                  >
                    PDF verification note {index + 1}: {item.evidenceLocator}
                  </label>
                  <textarea
                    id={`pdf-verification-note-${item.id}`}
                    value={pdfVerificationNote}
                    onChange={(event) =>
                      setPdfVerificationNotesByEvidenceId((current) => ({
                        ...current,
                        [item.id]: event.target.value
                      }))
                    }
                    className="min-h-14 resize-y border border-swiss-rule bg-white px-2 py-1.5 text-xs leading-5"
                  />
                  <button
                    type="button"
                    aria-label="Save PDF verification note"
                    onClick={() => onPdfVerificationNote?.(item.id, pdfVerificationNote)}
                    disabled={status === "saving"}
                    className="workbench-button justify-self-start"
                  >
                    <FloppyDisk aria-hidden="true" size={14} weight="bold" />
                    Save note
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 border-t border-swiss-rule pt-2">
                  <div className="grid gap-1.5">
                    <label
                      htmlFor={`route-target-${item.id}`}
                      className="text-xs font-semibold text-swiss-ink"
                    >
                      Target field {index + 1}: {item.evidenceLocator}
                    </label>
                    <select
                      id={`route-target-${item.id}`}
                      value={
                        routeTargetsByEvidenceId[item.id] ?? "screening.eligibilityRationale"
                      }
                      onChange={(event) =>
                        setRouteTargetsByEvidenceId((current) => ({
                          ...current,
                          [item.id]: event.target.value as ReviewFieldTarget
                        }))
                      }
                      className="min-w-0 border border-swiss-rule bg-white px-2 py-1.5 text-xs"
                    >
                      {routeTargets.map((target) => (
                        <option key={target.value} value={target.value}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    aria-label="Send evidence to field"
                    onClick={() =>
                      onRouteEvidence?.({
                        evidence: item,
                        target:
                          routeTargetsByEvidenceId[item.id] ??
                          "screening.eligibilityRationale"
                      })
                    }
                    className="workbench-button self-end"
                  >
                    <PaperPlaneTilt aria-hidden="true" size={14} weight="bold" />
                    Send
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        )}
      </div>
        </>
      )}
    </aside>
  );
}
