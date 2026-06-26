"use client";

import {
  CaretLeft,
  CaretRight
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
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
  pdfUrl: string;
  sourcePath: string | null;
  modelSettings?: RuntimeModelSettings;
  onEvidence: (input: EvidenceInput) => void;
}

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

export function PdfReader({ recordId, pdfUrl, sourcePath, modelSettings, onEvidence }: Props) {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "rendering" | "idle" | "error">("loading");
  const [message, setMessage] = useState("");
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [selectionQuestion, setSelectionQuestion] = useState("");
  const [selectionAnswer, setSelectionAnswer] = useState<ScopedAskAnswer | null>(null);
  const [askStatus, setAskStatus] = useState<"idle" | "asking" | "error">("idle");
  const [askMessage, setAskMessage] = useState("");
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>("opus");
  const [translation, setTranslation] = useState("");
  const [translateStatus, setTranslateStatus] = useState<"idle" | "translating" | "error">("idle");
  const [translateMessage, setTranslateMessage] = useState("");

  const documentRef = useRef<Awaited<ReturnType<Awaited<PdfJsModule>["getDocument"]>["promise"]> | null>(
    null
  );
  const pdfjsRef = useRef<PdfJsModule | null>(null);
  const pageFrameRef = useRef<HTMLElement | null>(null);
  const pageLayerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage("");
    setPageCount(null);
    setSelectionDraft(null);

    loadPdfJs()
      .then((pdfjs) => {
        pdfjsRef.current = pdfjs;
        return pdfjs.getDocument({ url: pdfUrl, useSystemFonts: true }).promise;
      })
      .then((document) => {
        if (cancelled) {
          void document.destroy();
          return;
        }
        documentRef.current = document;
        setPageCount(document.numPages);
        setPageNumber((current) => clampPageNumber(current, document.numPages));
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        documentRef.current = null;
        setStatus("error");
        setMessage(error.message);
      });

    return () => {
      cancelled = true;
      const document = documentRef.current;
      documentRef.current = null;
      void document?.destroy();
    };
  }, [pdfUrl]);

  useEffect(() => {
    const document = documentRef.current;
    const pdfjs = pdfjsRef.current;
    const canvas = canvasRef.current;
    const pageLayer = pageLayerRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!document || !pdfjs || !canvas || !pageLayer || !textLayerContainer || !pageCount) return;

    let cancelled = false;
    let renderTask: { cancel?: () => void; promise: Promise<unknown> } | null = null;
    let textLayer: { cancel?: () => void; render: () => Promise<unknown> } | null = null;
    setStatus("rendering");
    setMessage("");
    setSelectionDraft(null);

    document
      .getPage(clampPageNumber(pageNumber, pageCount))
      .then(async (page) => {
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const frameWidth = pageFrameRef.current?.clientWidth || baseViewport.width;
        const scale = clampNumber((frameWidth - 32) / baseViewport.width, 0.75, 1.45);
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) throw new Error("PDF canvas is not available");

        pageLayer.style.width = `${viewport.width}px`;
        pageLayer.style.height = `${viewport.height}px`;
        textLayerContainer.style.setProperty("--scale-factor", String(viewport.scale));
        textLayerContainer.replaceChildren();
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvasContext.setTransform?.(outputScale, 0, 0, outputScale, 0, 0);

        renderTask = page.render({ canvasContext, viewport });
        const textContent = await page.getTextContent();
        textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport
        });
        await Promise.all([renderTask.promise, textLayer.render()]);
      })
      .then(() => {
        if (cancelled) return;
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message);
      });

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      textLayer?.cancel?.();
    };
  }, [pageCount, pageNumber]);

  const buildEvidenceFromSelection = (): EvidenceInput | null => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    if (!selected || !pageFrameRef.current || !selection?.anchorNode) return null;
    if (!pageFrameRef.current.contains(selection.anchorNode)) return null;
    return {
      recordId,
      sourceFormat: "pdf",
      sourcePath,
      evidenceLocator: `PDF p.${pageNumber}`,
      quoteSnippet: selected,
      headingPath: null,
      pageNumber,
      reviewerNote: "",
      pdfVerificationNote: ""
    };
  };

  const showSelectionAssistant = (event?: { target: EventTarget | null }) => {
    if (
      event?.target instanceof Node &&
      pageLayerRef.current &&
      !pageLayerRef.current.contains(event.target)
    ) {
      return;
    }
    const selection = window.getSelection();
    const evidence = buildEvidenceFromSelection();
    if (!evidence || !selection || !pageFrameRef.current) return;
    const rect = selectionRect(selection);
    const position = selectionAssistantPosition(rect, pageFrameRef.current);
    setSelectionDraft({
      evidence,
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
    if (!selectionDraft || !selectionQuestion.trim()) return;
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
          evidence: [evidenceInputToPacket(selectionDraft.evidence)]
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
    <section
      aria-label="PDF reader panel"
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"
    >
      <div className="flex items-center justify-between border-b border-swiss-rule px-4 py-2">
        <span className="font-mono text-xs text-swiss-muted">
          Page {pageNumber}
          {pageCount ? ` / ${pageCount}` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous PDF page"
            onClick={() => setPageNumber((current) => clampPageNumber(current - 1, pageCount ?? 1))}
            disabled={pageNumber <= 1}
            className="workbench-icon-button workbench-icon-button-sm"
          >
            <CaretLeft aria-hidden="true" size={13} weight="bold" />
          </button>
          <input
            aria-label="PDF page"
            value={pageNumber}
            onChange={(event) =>
              setPageNumber(clampPageNumber(Number(event.target.value) || 1, pageCount ?? Infinity))
            }
            type="number"
            min={1}
            max={pageCount ?? undefined}
            className="w-20 border border-swiss-rule px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            aria-label="Next PDF page"
            onClick={() => setPageNumber((current) => clampPageNumber(current + 1, pageCount ?? 1))}
            disabled={pageCount ? pageNumber >= pageCount : true}
            className="workbench-icon-button workbench-icon-button-sm"
          >
            <CaretRight aria-hidden="true" size={13} weight="bold" />
          </button>
        </div>
      </div>
      <article
        ref={pageFrameRef}
        aria-label="Rendered PDF page"
        onMouseUp={showSelectionAssistant}
        onKeyUp={showSelectionAssistant}
        className="pdf-reader-surface overflow-auto"
      >
        <div ref={pageLayerRef} className="pdf-page">
          <canvas ref={canvasRef} aria-label="PDF page canvas" className="pdf-page-canvas" />
          <div ref={textLayerRef} className="textLayer pdf-text-layer" />
        </div>
        {status === "loading" || status === "rendering" ? (
          <p className="pdf-reader-status">
            {status === "loading" ? "Loading PDF." : "Rendering PDF page."}
          </p>
        ) : null}
        {status === "error" ? <p className="pdf-reader-error">{message}</p> : null}
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
            questionId="pdf-selection-question"
            providerId="pdf-selection-translation-provider"
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

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();
  return pdfjs;
}

function evidenceInputToPacket(input: EvidenceInput): EvidencePacket {
  return {
    ...input,
    id: "unsaved-pdf-selection",
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

function clampPageNumber(value: number, pageCount: number): number {
  const pageNumber = Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.min(Math.max(pageNumber, 1), Math.max(pageCount, 1));
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
