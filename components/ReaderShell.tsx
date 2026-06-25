"use client";

import { useEffect, useState } from "react";
import type { EvidenceInput, PaperListItem } from "@/lib/types";
import { MarkdownReader } from "@/components/MarkdownReader";
import { PdfReader } from "@/components/PdfReader";

interface Props {
  paper: PaperListItem | null;
  onEvidence: (input: EvidenceInput) => void;
}

export function ReaderShell({ paper, onEvidence }: Props) {
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [mode, setMode] = useState<"Markdown" | "PDF">("Markdown");

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
    <section className="grid min-h-0 grid-rows-[auto_1fr] bg-white">
      <header className="flex items-center justify-between border-b border-swiss-rule px-4 py-3">
        <div>
          <p className="font-mono text-xs text-swiss-red">{paper.recordId}</p>
          <h1 className="mt-1 line-clamp-1 text-lg font-semibold tracking-tight">
            {paper.title || paper.sourceFilename}
          </h1>
        </div>
        <div className="flex gap-1 font-mono text-xs">
          {(["Markdown", "PDF"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`border px-2 py-1 transition active:translate-y-px ${
                mode === item ? "border-swiss-red text-swiss-red" : "border-swiss-rule"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </header>
      {mode === "PDF" ? (
        paper.hasPdf ? (
          <PdfReader
            recordId={paper.recordId}
            pdfUrl={`/api/papers/${paper.recordId}/pdf`}
            sourcePath={paper.pdfPath}
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
          onEvidence={onEvidence}
        />
      ) : (
        <div className="p-6 text-sm text-swiss-muted">Markdown source not loaded.</div>
      )}
    </section>
  );
}
