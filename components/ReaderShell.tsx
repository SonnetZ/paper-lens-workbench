"use client";

import { useEffect, useState } from "react";
import type { EvidenceInput, PaperListItem, RuntimeModelSettings } from "@/lib/types";
import { MarkdownReader } from "@/components/MarkdownReader";
import { PdfReader } from "@/components/PdfReader";

interface Props {
  paper: PaperListItem | null;
  modelSettings?: RuntimeModelSettings;
  evidenceCount?: number;
  knowledgeBaseId?: string;
  onEvidence: (input: EvidenceInput) => void;
}

type ReaderMode = "Markdown" | "PDF";

export function ReaderShell({
  paper,
  modelSettings,
  evidenceCount = 0,
  knowledgeBaseId = "default",
  onEvidence
}: Props) {
  const paperRecordId = paper?.recordId ?? "";
  const hasMarkdown = Boolean(paper?.hasMarkdown);
  const hasPdf = Boolean(paper?.hasPdf);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [mode, setMode] = useState<ReaderMode>(() => preferredReaderMode(hasMarkdown, hasPdf));

  useEffect(() => {
    setMode(preferredReaderMode(hasMarkdown, hasPdf));
  }, [paperRecordId, hasMarkdown, hasPdf]);

  useEffect(() => {
    setMarkdown("");
    setError("");
    if (!paper?.hasMarkdown) return;
    fetch(`/api/papers/${paper.recordId}/markdown`)
      .then((response) => {
        if (!response.ok) throw new Error("Markdown source not available");
        return response.json();
      })
      .then((data: { content: string }) => setMarkdown(data.content))
      .catch((err: Error) => setError(err.message));
  }, [paper]);

  if (!paper) {
    return (
      <div className="flex min-h-0 items-center justify-center bg-white p-6 text-sm text-swiss-muted">
        No paper selected
      </div>
    );
  }

  return (
    <section className="reader-shell grid min-h-0 grid-rows-[auto_1fr]">
      <header aria-label="Reading cockpit" role="region" className="reader-cockpit">
        <div className="reader-cockpit-primary">
          <div className="min-w-0">
            <p className="reader-cockpit-record">{paper.recordId}</p>
            <h1 className="reader-cockpit-title">{paper.title || paper.sourceFilename}</h1>
          </div>
          <div className="reader-cockpit-modes" aria-label="Reader mode">
            {(["Markdown", "PDF"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
                className="workbench-tab-button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <dl className="reader-cockpit-telemetry">
          <TelemetryItem label="Source" value={sourceSummary(hasMarkdown, hasPdf)} />
          <TelemetryItem label="Evidence" value={String(evidenceCount)} />
          <TelemetryItem label="Model" value={modelSettings?.mode ?? "mock"} />
          <TelemetryItem label="KB" value={knowledgeBaseId} />
        </dl>
      </header>
      {mode === "PDF" ? (
        paper.hasPdf ? (
          <PdfReader
            recordId={paper.recordId}
            pdfUrl={`/api/papers/${paper.recordId}/pdf`}
            sourcePath={paper.pdfPath}
            modelSettings={modelSettings}
            onEvidence={onEvidence}
          />
        ) : (
          <div className="p-6 text-sm text-swiss-muted">PDF source not available</div>
        )
      ) : error ? (
        <div className="p-6 text-sm text-swiss-red">{error}</div>
      ) : markdown ? (
        <MarkdownReader
          recordId={paper.recordId}
          sourcePath={paper.markdownPath ?? paper.sourcePath}
          markdown={markdown}
          modelSettings={modelSettings}
          onEvidence={onEvidence}
        />
      ) : (
        <div className="p-6 text-sm text-swiss-muted">Markdown source not loaded.</div>
      )}
    </section>
  );
}

function TelemetryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="reader-cockpit-chip">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <span className="sr-only">
        {label} {value}
      </span>
    </div>
  );
}

function sourceSummary(hasMarkdown: boolean, hasPdf: boolean): string {
  if (hasMarkdown && hasPdf) return "MD + PDF";
  if (hasMarkdown) return "MD";
  if (hasPdf) return "PDF";
  return "No source";
}

function preferredReaderMode(hasMarkdown: boolean, hasPdf: boolean): ReaderMode {
  return hasPdf ? "PDF" : "Markdown";
}
