"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EvidenceInput, EvidencePacket, ScopedAskAnswer } from "@/lib/types";

interface Props {
  recordId: string;
  sourcePath: string;
  markdown: string;
  onEvidence: (input: EvidenceInput) => void;
}

interface SelectionDraft {
  evidence: EvidenceInput;
  left: number;
  top: number;
}

function firstBodyParagraph(markdown: string): { heading: string; text: string } {
  const lines = markdown.split(/\r?\n/);
  let heading = "Document";
  for (const line of lines) {
    if (line.startsWith("## ")) heading = line.replace(/^##\s+/, "").trim();
    if (line.trim() && !line.startsWith("#")) {
      return { heading, text: line.trim() };
    }
  }
  return { heading, text: "" };
}

export function MarkdownReader({ recordId, sourcePath, markdown, onEvidence }: Props) {
  const articleRef = useRef<HTMLElement | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [selectionQuestion, setSelectionQuestion] = useState("");
  const [selectionAnswer, setSelectionAnswer] = useState<ScopedAskAnswer | null>(null);
  const [askStatus, setAskStatus] = useState<"idle" | "asking" | "error">("idle");
  const [askMessage, setAskMessage] = useState("");

  const selectedEvidence = useMemo(
    () => (selectionDraft ? evidenceInputToPacket(selectionDraft.evidence) : null),
    [selectionDraft]
  );

  const buildEvidenceFromSelection = (): EvidenceInput => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    const fallback = firstBodyParagraph(markdown);
    const selectedHeading = selected ? headingForSelection(selection, articleRef.current) : null;
    const heading = selectedHeading ?? fallback.heading;
    const quoteSnippet = selected || fallback.text;
    return {
      recordId,
      sourceFormat: "markdown",
      sourcePath,
      evidenceLocator: heading,
      quoteSnippet,
      headingPath: heading,
      pageNumber: null,
      reviewerNote: "",
      pdfVerificationNote: ""
    };
  };

  const captureSelection = () => {
    onEvidence(buildEvidenceFromSelection());
  };

  const showSelectionAssistant = () => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    if (!selected || !articleRef.current || !selection?.anchorNode) return;
    if (!articleRef.current.contains(selection.anchorNode)) return;
    const rect = selectionRect(selection);
    const containerRect = articleRef.current.getBoundingClientRect();
    setSelectionDraft({
      evidence: buildEvidenceFromSelection(),
      left: clampNumber(rect.left - containerRect.left + rect.width / 2, 16, containerRect.width - 376),
      top: clampNumber(rect.top - containerRect.top + rect.height + 10, 72, containerRect.height - 260)
    });
    setSelectionQuestion("");
    setSelectionAnswer(null);
    setAskStatus("idle");
    setAskMessage("");
  };

  const askAboutSelection = async () => {
    if (!selectionDraft || !selectedEvidence || !selectionQuestion.trim()) return;
    setAskStatus("asking");
    setAskMessage("");
    setSelectionAnswer(null);
    try {
      const response = await fetch(`/api/papers/${recordId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selectionQuestion.trim(),
          payloadScope: "Selection",
          evidence: [selectedEvidence]
        })
      });
      const data = (await response.json()) as {
        answer?: ScopedAskAnswer;
        error?: string;
      };
      if (!response.ok || !data.answer) throw new Error(data.error ?? "Unable to answer selection");
      setSelectionAnswer(data.answer);
      setAskStatus("idle");
    } catch (error) {
      setAskStatus("error");
      setAskMessage(error instanceof Error ? error.message : "Unable to answer selection");
    }
  };

  return (
    <section className="relative grid min-h-0 grid-rows-[auto_1fr]">
      <div className="flex items-center justify-between border-b border-swiss-rule px-4 py-2">
        <span className="font-mono text-xs text-swiss-muted">Markdown</span>
        <button
          type="button"
          onClick={captureSelection}
          className="border border-swiss-rule px-2 py-1 text-xs transition hover:border-swiss-red active:translate-y-px"
        >
          Save selection
        </button>
      </div>
      <article
        ref={articleRef}
        aria-label="Rendered markdown paper"
        onMouseUp={showSelectionAssistant}
        onKeyUp={showSelectionAssistant}
        className="markdown-paper overflow-auto bg-white px-6 py-6 md:px-10"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => (
              <a {...props} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
      {selectionDraft ? (
        <section
          role="dialog"
          aria-label="Ask about selected text"
          className="absolute z-20 w-[min(360px,calc(100%-32px))] border-l-2 border-swiss-red bg-white p-3 shadow-[0_18px_40px_rgba(24,24,27,0.16)]"
          style={{
            left: `${selectionDraft.left}px`,
            top: `${selectionDraft.top}px`
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 text-xs leading-5 text-swiss-muted">
              {selectionDraft.evidence.quoteSnippet}
            </p>
            <button
              type="button"
              aria-label="Close selection assistant"
              onClick={() => setSelectionDraft(null)}
              className="px-1 font-mono text-xs text-swiss-muted transition hover:text-swiss-red"
            >
              x
            </button>
          </div>
          <div className="mt-3 grid gap-1.5">
            <label htmlFor="selection-question" className="text-xs font-semibold">
              Question about selection
            </label>
            <textarea
              id="selection-question"
              value={selectionQuestion}
              onChange={(event) => setSelectionQuestion(event.target.value)}
              className="min-h-16 resize-y border-0 border-b border-swiss-rule bg-swiss-wash px-2 py-1.5 text-sm leading-5 outline-none focus:border-swiss-red"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onEvidence(selectionDraft.evidence)}
              className="px-0 text-xs font-semibold text-swiss-muted transition hover:text-swiss-red active:translate-y-px"
            >
              Save evidence
            </button>
            <button
              type="button"
              onClick={askAboutSelection}
              disabled={!selectionQuestion.trim() || askStatus === "asking"}
              className="border-b border-swiss-red px-0 py-1 text-xs font-semibold text-swiss-red transition disabled:border-swiss-rule disabled:text-swiss-muted active:translate-y-px"
            >
              {askStatus === "asking" ? "Asking selection" : "Ask selection"}
            </button>
          </div>
          {askMessage ? <p className="mt-3 text-xs text-swiss-red">{askMessage}</p> : null}
          {selectionAnswer ? (
            <p className="mt-3 border-t border-swiss-rule pt-3 text-sm leading-5">
              {selectionAnswer.answer}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function evidenceInputToPacket(input: EvidenceInput): EvidencePacket {
  return {
    ...input,
    id: "unsaved-selection",
    createdAt: new Date(0).toISOString()
  };
}

function selectionRect(selection: Selection): Pick<DOMRect, "left" | "top" | "width" | "height"> {
  if (selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height) return rect;
  }
  return { left: 32, top: 96, width: 0, height: 0 };
}

function headingForSelection(
  selection: Selection | null | undefined,
  article: HTMLElement | null
): string | null {
  if (!selection?.anchorNode || !article?.contains(selection.anchorNode)) return null;
  const anchorElement =
    selection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? (selection.anchorNode as Element)
      : selection.anchorNode.parentElement;
  const block = anchorElement?.closest("p,li,blockquote,pre,table,h1,h2,h3,h4,h5,h6");
  if (!block) return null;
  if (isHeading(block)) return block.textContent?.trim() || null;

  let current: Element | null = block;
  while (current && current.parentElement !== article) {
    current = current.parentElement;
  }

  let sibling = current?.previousElementSibling ?? null;
  while (sibling) {
    if (isHeading(sibling)) return sibling.textContent?.trim() || null;
    sibling = sibling.previousElementSibling;
  }
  return null;
}

function isHeading(element: Element): boolean {
  return /^H[1-6]$/.test(element.tagName);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
