"use client";

import { useState } from "react";
import type { EvidenceInput } from "@/lib/types";

interface Props {
  recordId: string;
  pdfUrl: string;
  sourcePath: string | null;
  onEvidence: (input: EvidenceInput) => void;
}

export function PdfReader({ recordId, pdfUrl, sourcePath, onEvidence }: Props) {
  const [pageNumber, setPageNumber] = useState(1);
  const [quoteSnippet, setQuoteSnippet] = useState("");

  return (
    <section
      aria-label="PDF reader panel"
      className="grid h-[calc(100dvh-150px)] min-h-[520px] grid-rows-[auto_minmax(0,1fr)_auto]"
    >
      <div className="flex items-center justify-between border-b border-swiss-rule px-4 py-2">
        <span className="font-mono text-xs text-swiss-muted">PDF page {pageNumber}</span>
        <input
          aria-label="PDF page"
          value={pageNumber}
          onChange={(event) => setPageNumber(Math.max(1, Number(event.target.value) || 1))}
          type="number"
          min={1}
          className="w-20 border border-swiss-rule px-2 py-1 font-mono text-xs"
        />
      </div>
      <iframe title="PDF preview" src={pdfUrl} className="min-h-0 w-full border-0 bg-swiss-wash" />
      <div className="border-t border-swiss-rule p-3">
        <label className="block text-xs font-medium" htmlFor="pdf-quote">
          Quote snippet or page note
        </label>
        <textarea
          id="pdf-quote"
          value={quoteSnippet}
          onChange={(event) => setQuoteSnippet(event.target.value)}
          className="mt-2 min-h-16 w-full resize-y border border-swiss-rule p-2 text-sm"
        />
        <button
          type="button"
          onClick={() =>
            onEvidence({
              recordId,
              sourceFormat: "pdf",
              sourcePath,
              evidenceLocator: `PDF p.${pageNumber}`,
              quoteSnippet,
              headingPath: null,
              pageNumber,
              reviewerNote: "",
              pdfVerificationNote: ""
            })
          }
          className="mt-2 border border-swiss-rule px-2 py-1 text-xs transition hover:border-swiss-red active:translate-y-px"
        >
          Capture PDF page evidence
        </button>
      </div>
    </section>
  );
}
