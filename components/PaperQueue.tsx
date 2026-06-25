"use client";

import { useMemo, useState } from "react";
import type { PaperListItem } from "@/lib/types";
import { CorpusSetup } from "@/components/CorpusSetup";

interface Props {
  papers: PaperListItem[];
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
  onCorpusApplied: () => void;
}

export function PaperQueue({ papers, selectedRecordId, onSelect, onCorpusApplied }: Props) {
  const [query, setQuery] = useState("");
  const filteredPapers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return papers;
    return papers.filter((paper) =>
      [
        paper.recordId,
        paper.title,
        paper.sourceFilename,
        paper.sourcePath,
        paper.reviewStatus,
        paper.decision
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [papers, query]);
  const queueCount = query.trim()
    ? `${filteredPapers.length} of ${papers.length} records`
    : `${papers.length} records`;

  return (
    <aside className="min-h-0 border-r border-swiss-rule bg-swiss-wash">
      <CorpusSetup onCorpusApplied={onCorpusApplied} />
      <div className="border-b border-swiss-rule px-4 py-3">
        <h2 className="text-sm font-semibold">Review queue</h2>
        <p className="mt-1 font-mono text-xs text-swiss-muted">{queueCount}</p>
        <label htmlFor="review-queue-search" className="mt-3 block text-xs font-semibold">
          Search review queue
        </label>
        <input
          id="review-queue-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1 w-full border border-swiss-rule bg-white px-2 py-1.5 text-sm"
          placeholder="Record ID, title, filename"
        />
      </div>
      <div className="max-h-[calc(100dvh-370px)] overflow-auto">
        {filteredPapers.map((paper) => (
          <button
            key={paper.recordId}
            type="button"
            onClick={() => onSelect(paper.recordId)}
            className={`block w-full border-b border-swiss-rule px-4 py-3 text-left transition active:translate-y-px ${
              selectedRecordId === paper.recordId ? "bg-white" : "hover:bg-white"
            }`}
            aria-label={`${paper.recordId} ${paper.title || paper.sourceFilename}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-swiss-red">{paper.recordId}</span>
              <span className="font-mono text-[11px] uppercase text-swiss-muted">
                {paper.reviewStatus || "unreviewed"}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-snug">
              {paper.title || paper.sourceFilename}
            </p>
            <div className="mt-2 flex gap-1 font-mono text-[11px]">
              {paper.hasMarkdown ? (
                <span className="border border-swiss-rule px-1.5 py-0.5">MD</span>
              ) : null}
              {paper.hasPdf ? (
                <span className="border border-swiss-rule px-1.5 py-0.5">PDF</span>
              ) : null}
            </div>
          </button>
        ))}
        {filteredPapers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-swiss-muted">No matching records.</p>
        ) : null}
      </div>
    </aside>
  );
}
