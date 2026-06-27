"use client";

import { CaretDown, CaretLeft, CaretRight, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
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
          : "min-h-0 bg-swiss-wash lg:h-[100dvh] lg:overflow-hidden lg:border-r lg:border-swiss-rule"
      }
    >
      {collapsed ? (
        <button
          type="button"
          aria-label="Expand paper list"
          onClick={() => onCollapsedChange?.(false)}
          className="paper-queue-collapse-button"
        >
          <CaretDown aria-hidden="true" weight="bold" className="size-4 lg:hidden" />
          <CaretRight aria-hidden="true" weight="bold" className="hidden size-4 lg:block" />
          <span className="paper-queue-collapsed-label">Queue</span>
          <span className="paper-queue-collapsed-count">{papers.length} records</span>
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
          <CaretUp aria-hidden="true" weight="bold" className="size-3.5 lg:hidden" />
          <CaretLeft aria-hidden="true" weight="bold" className="hidden size-3.5 lg:block" />
        </button>
      </div>
      <div className="border-b border-swiss-rule px-4 py-3">
        <h2 className="text-sm font-semibold">Review queue</h2>
        <p className="mt-1 font-mono text-xs text-swiss-muted">{queueCount}</p>
        <div className="relative mt-3">
          <MagnifyingGlass
            aria-hidden="true"
            size={14}
            weight="bold"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-swiss-muted"
          />
          <input
            id="review-queue-search"
            aria-label="Search review queue"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full border border-swiss-rule bg-white py-1.5 pl-7 pr-2 text-sm"
            placeholder="Record ID, title, filename"
          />
        </div>
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
