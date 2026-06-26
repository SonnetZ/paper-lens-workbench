"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { PaperListItem } from "@/lib/types";
import { CorpusSetup } from "@/components/CorpusSetup";

interface Props {
  papers: PaperListItem[];
  selectedRecordId: string | null;
  collapsed?: boolean;
  onSelect: (recordId: string) => void;
  onCorpusApplied: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function PaperQueue({
  papers,
  selectedRecordId,
  collapsed = false,
  onSelect,
  onCorpusApplied,
  onCollapsedChange
}: Props) {
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
    <aside
      aria-label="Paper queue"
      className={
        collapsed
          ? "paper-queue-collapsed"
          : "min-h-0 border-r border-swiss-rule bg-swiss-wash md:h-[100dvh] md:overflow-hidden"
      }
    >
      {collapsed ? (
        <button
          type="button"
          aria-label="Expand paper list"
          onClick={() => onCollapsedChange?.(false)}
          className="paper-queue-collapse-button"
        >
          <CaretRight aria-hidden="true" weight="bold" className="size-4" />
          <span className="paper-queue-collapsed-count">{papers.length}</span>
        </button>
      ) : null}
      {collapsed ? null : (
        <>
      <div className="flex items-center justify-between gap-3 border-b border-swiss-rule bg-white px-4 py-2">
        <CorpusSetup onCorpusApplied={onCorpusApplied} />
        <button
          type="button"
          aria-label="Collapse paper list"
          onClick={() => onCollapsedChange?.(true)}
          className="workbench-icon-button workbench-icon-button-sm"
        >
          <CaretLeft aria-hidden="true" weight="bold" className="size-3.5" />
        </button>
      </div>
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
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="font-mono text-xs text-swiss-red">{paper.recordId}</span>
                {paper.hasMarkdown ? (
                  <span className="border border-swiss-rule px-1.5 py-0.5 font-mono text-[10px] text-swiss-muted">
                    MD
                  </span>
                ) : null}
                {paper.hasPdf ? (
                  <span className="border border-swiss-rule px-1.5 py-0.5 font-mono text-[10px] text-swiss-muted">
                    PDF
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-[11px] uppercase text-swiss-muted">
                {paper.reviewStatus || "unreviewed"}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-snug">
              {paper.title || paper.sourceFilename}
            </p>
          </button>
        ))}
        {filteredPapers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-swiss-muted">No matching records.</p>
        ) : null}
      </div>
        </>
      )}
    </aside>
  );
}
