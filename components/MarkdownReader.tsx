"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  EvidenceInput,
  EvidencePacket,
  RuntimeModelSettings,
  ScopedAskAnswer,
  TranslationProvider
} from "@/lib/types";
import { SelectionAssistant } from "@/components/SelectionAssistant";
import type { SelectionDraft } from "@/components/SelectionAssistant";

interface Props {
  recordId: string;
  sourcePath: string;
  markdown: string;
  modelSettings?: RuntimeModelSettings;
  onEvidence: (input: EvidenceInput) => void;
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

export function MarkdownReader({ recordId, sourcePath, markdown, modelSettings, onEvidence }: Props) {
  const articleRef = useRef<HTMLElement | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [selectionQuestion, setSelectionQuestion] = useState("");
  const [selectionAnswer, setSelectionAnswer] = useState<ScopedAskAnswer | null>(null);
  const [askStatus, setAskStatus] = useState<"idle" | "asking" | "error">("idle");
  const [askMessage, setAskMessage] = useState("");
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>("opus");
  const [translation, setTranslation] = useState("");
  const [translateStatus, setTranslateStatus] = useState<"idle" | "translating" | "error">("idle");
  const [translateMessage, setTranslateMessage] = useState("");

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

  const showSelectionAssistant = (event?: { target: EventTarget | null }) => {
    if (event?.target instanceof Element && event.target.closest("[data-selection-assistant]")) return;
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    if (!selected || !articleRef.current || !selection?.anchorNode) return;
    if (!articleRef.current.contains(selection.anchorNode)) return;
    const rect = selectionRect(selection);
    const position = selectionAssistantPosition(rect, articleRef.current);
    setSelectionDraft({
      evidence: buildEvidenceFromSelection(),
      left: position.left,
      top: position.top
    });
    setSelectionQuestion("");
    setSelectionAnswer(null);
    setAskStatus("idle");
    setAskMessage("");
    setTranslation("");
    setTranslateStatus("idle");
    setTranslateMessage("");
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

  const translateSelectedText = async () => {
    if (!selectionDraft) return;
    setTranslateStatus("translating");
    setTranslateMessage("");
    setTranslation("");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectionDraft.evidence.quoteSnippet,
          provider: translationProvider,
          modelSettings
        })
      });
      const data = (await response.json()) as { translation?: string; error?: string };
      if (!response.ok || !data.translation) throw new Error(data.error ?? "Unable to translate selection");
      setTranslation(data.translation);
      setTranslateStatus("idle");
    } catch (error) {
      setTranslateStatus("error");
      setTranslateMessage(error instanceof Error ? error.message : "Unable to translate selection");
    }
  };

  return (
    <section className="relative grid min-h-0">
      <article
        ref={articleRef}
        aria-label="Rendered markdown paper"
        onMouseUp={showSelectionAssistant}
        onKeyUp={showSelectionAssistant}
        className="markdown-paper relative overflow-auto bg-white px-6 py-6 md:px-10"
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
        {selectionDraft ? (
          <SelectionAssistant
            draft={selectionDraft}
            question={selectionQuestion}
            answer={selectionAnswer}
            askStatus={askStatus}
            askMessage={askMessage}
            translationProvider={translationProvider}
            translation={translation}
            translateStatus={translateStatus}
            translateMessage={translateMessage}
            questionId="selection-question"
            providerId="selection-translation-provider"
            onQuestionChange={setSelectionQuestion}
            onTranslationProviderChange={setTranslationProvider}
            onTranslate={translateSelectedText}
            onSave={() => onEvidence(selectionDraft.evidence)}
            onAsk={askAboutSelection}
            onClose={() => setSelectionDraft(null)}
          />
        ) : null}
      </article>
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

function selectionAssistantPosition(
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  container: HTMLElement
): { left: number; top: number } {
  const containerRect = container.getBoundingClientRect();
  const width = 360;
  const height = 260;
  const gap = 10;
  const edge = 16;
  const viewportWidth = container.clientWidth || containerRect.width;
  const viewportHeight = container.clientHeight || containerRect.height;
  const visibleLeft = container.scrollLeft + edge;
  const visibleTop = container.scrollTop + edge;
  const visibleRight = container.scrollLeft + viewportWidth - width - edge;
  const visibleBottom = container.scrollTop + viewportHeight - height - edge;
  const left = rect.left - containerRect.left + container.scrollLeft + rect.width / 2;
  const below = rect.top - containerRect.top + container.scrollTop + rect.height + gap;
  const above = rect.top - containerRect.top + container.scrollTop - height - gap;
  const top = below <= visibleBottom ? below : above >= visibleTop ? above : below;
  return {
    left: clampNumber(left, visibleLeft, visibleRight),
    top: clampNumber(top, visibleTop, visibleBottom)
  };
}
