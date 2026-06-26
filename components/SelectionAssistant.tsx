"use client";

import {
  ChatCircleText,
  Copy,
  FloppyDisk,
  Translate,
  X
} from "@phosphor-icons/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type {
  EvidenceInput,
  ScopedAskAnswer,
  TranslationProvider
} from "@/lib/types";

gsap.registerPlugin(useGSAP);

export interface SelectionDraft {
  evidence: EvidenceInput;
  left: number;
  top: number;
}

export function SelectionAssistant({
  draft,
  question,
  answer,
  askStatus,
  askMessage,
  translationProvider,
  translation,
  translateStatus,
  translateMessage,
  questionId,
  providerId,
  onQuestionChange,
  onTranslationProviderChange,
  onTranslate,
  onSave,
  onAsk,
  onClose
}: {
  draft: SelectionDraft;
  question: string;
  answer: ScopedAskAnswer | null;
  askStatus: "idle" | "asking" | "error";
  askMessage: string;
  translationProvider: TranslationProvider;
  translation: string;
  translateStatus: "idle" | "translating" | "error";
  translateMessage: string;
  questionId: string;
  providerId: string;
  onQuestionChange: (value: string) => void;
  onTranslationProviderChange: (value: TranslationProvider) => void;
  onTranslate: () => void;
  onSave: () => void;
  onAsk: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef({ pointerId: -1, startClientX: 0, startClientY: 0, startX: 0, startY: 0 });
  const [copied, setCopied] = useState<string | null>(null);

  useGSAP(
    () => {
      if (!panelRef.current) return;
      const mm = gsap.matchMedia();
      gsap.set(panelRef.current, { x: 0, y: 0 });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          panelRef.current,
          { autoAlpha: 0, y: -6, scale: 0.985 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: "power2.out" }
        );
      });
      return () => mm.revert();
    },
    { dependencies: [draft.left, draft.top], scope: panelRef }
  );

  const copyText = async (name: string, text: string) => {
    await navigator.clipboard?.writeText(text);
    setCopied(name);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const beginDrag = (event: PointerEvent<HTMLElement>) => {
    if (!panelRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number(gsap.getProperty(panelRef.current, "x")),
      startY: Number(gsap.getProperty(panelRef.current, "y"))
    };
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    const drag = dragRef.current;
    if (!panel || drag.pointerId !== event.pointerId) return;
    const bounds = dragBounds(panel, draft);
    gsap.set(panel, {
      x: clamp(drag.startX + event.clientX - drag.startClientX, bounds.minX, bounds.maxX),
      y: clamp(drag.startY + event.clientY - drag.startClientY, bounds.minY, bounds.maxY)
    });
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current.pointerId = -1;
  };

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="Ask about selected text"
      data-selection-assistant
      className="selection-assistant absolute z-20 w-[min(380px,calc(100%-32px))] border-l-2 border-swiss-red bg-white p-3 shadow-[0_18px_40px_rgba(24,24,27,0.16)]"
      style={{
        left: `${draft.left}px`,
        top: `${draft.top}px`
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="selection-assistant-drag-handle min-w-0 flex-1"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <p className="line-clamp-2 text-xs leading-5 text-swiss-muted">
            {draft.evidence.quoteSnippet}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase text-swiss-muted">Drag</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Copy selected text"
            onClick={() => copyText("selection", draft.evidence.quoteSnippet)}
            className="workbench-icon-button workbench-icon-button-sm"
          >
            <Copy aria-hidden="true" size={13} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Close selection assistant"
            onClick={onClose}
            className="workbench-icon-button workbench-icon-button-sm"
          >
            <X aria-hidden="true" size={13} weight="bold" />
          </button>
        </div>
      </div>
      {copied === "selection" ? <p className="mt-1 text-xs text-swiss-muted">Copied</p> : null}
      <div className="mt-3 grid gap-1.5">
        <label htmlFor={questionId} className="text-xs font-semibold">
          Question about selection
        </label>
        <textarea
          id={questionId}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          className="min-h-16 resize-y border-0 border-b border-swiss-rule bg-swiss-wash px-2 py-1.5 text-sm leading-5 outline-none focus:border-swiss-red"
        />
      </div>
      <div className="mt-3 grid gap-1.5">
        <label htmlFor={providerId} className="text-xs font-semibold">
          Translation source
        </label>
        <select
          id={providerId}
          value={translationProvider}
          onChange={(event) => onTranslationProviderChange(event.target.value as TranslationProvider)}
          className="border border-swiss-rule bg-white px-2 py-1.5 text-xs"
        >
          <option value="opus">OPUS-MT</option>
          <option value="local">Local LLM</option>
          <option value="online">Online LLM</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-label="Save evidence" onClick={onSave} className="workbench-text-button">
          <FloppyDisk aria-hidden="true" size={14} weight="bold" />
          Save
        </button>
        <button
          type="button"
          aria-label="Translate selection"
          onClick={onTranslate}
          disabled={translateStatus === "translating"}
          className="workbench-text-button"
        >
          <Translate aria-hidden="true" size={14} weight="bold" />
          {translateStatus === "translating" ? "Translating" : "Translate"}
        </button>
        <button
          type="button"
          aria-label="Ask selection"
          onClick={onAsk}
          disabled={!question.trim() || askStatus === "asking"}
          className="workbench-text-button"
        >
          <ChatCircleText aria-hidden="true" size={14} weight="bold" />
          {askStatus === "asking" ? "Asking" : "Ask"}
        </button>
      </div>
      {translateMessage ? <p className="mt-3 text-xs text-swiss-red">{translateMessage}</p> : null}
      {translation ? (
        <div className="mt-3 border-t border-swiss-rule pt-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-5">{translation}</p>
            <button
              type="button"
              aria-label="Copy translation"
              onClick={() => copyText("translation", translation)}
              className="workbench-icon-button workbench-icon-button-sm shrink-0"
            >
              <Copy aria-hidden="true" size={13} weight="bold" />
            </button>
          </div>
          {copied === "translation" ? <p className="mt-1 text-xs text-swiss-muted">Copied</p> : null}
        </div>
      ) : null}
      {askMessage ? <p className="mt-3 text-xs text-swiss-red">{askMessage}</p> : null}
      {answer ? (
        <div className="mt-3 border-t border-swiss-rule pt-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-5">{answer.answer}</p>
            <button
              type="button"
              aria-label="Copy answer"
              onClick={() => copyText("answer", answer.answer)}
              className="workbench-icon-button workbench-icon-button-sm shrink-0"
            >
              <Copy aria-hidden="true" size={13} weight="bold" />
            </button>
          </div>
          {copied === "answer" ? <p className="mt-1 text-xs text-swiss-muted">Copied</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function dragBounds(panel: HTMLElement, draft: SelectionDraft) {
  const container = panel.parentElement;
  if (!container) return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
  const edge = 8;
  return {
    minX: container.scrollLeft + edge - draft.left,
    maxX: container.scrollLeft + container.clientWidth - panel.offsetWidth - edge - draft.left,
    minY: container.scrollTop + edge - draft.top,
    maxY: container.scrollTop + container.clientHeight - panel.offsetHeight - edge - draft.top
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
