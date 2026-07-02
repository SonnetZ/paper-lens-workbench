"use client";

import { useEffect, useMemo, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  AskChatMessage,
  EvidencePacket,
  PaperListItem,
  PayloadScope,
  RuntimeModelSettings
} from "@/lib/types";
import { InfoHint } from "@/components/InfoHint";

export function AskPanel({
  paper,
  evidence,
  modelSettings,
  knowledgeBaseId = "default"
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  modelSettings?: RuntimeModelSettings;
  knowledgeBaseId?: string;
}) {
  const [question, setQuestion] = useState("");
  const [payloadScope, setPayloadScope] = useState<PayloadScope>("Selection");
  const [messages, setMessages] = useState<AskChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "asking" | "error">("idle");
  const [message, setMessage] = useState("");
  const reviewProjectId = knowledgeBaseId || "default";
  const recordId = paper?.recordId ?? "";
  const currentEvidence = useMemo(
    () => evidence.filter((item) => item.recordId === paper?.recordId),
    [evidence, paper?.recordId]
  );
  const chatUrl = useMemo(() => {
    if (!recordId) return "";
    const params = new URLSearchParams({
      reviewProjectId,
      payloadScope
    });
    return `/api/papers/${encodeURIComponent(recordId)}/ask?${params.toString()}`;
  }, [recordId, payloadScope, reviewProjectId]);
  const canAsk = Boolean(
    paper &&
      question.trim() &&
      (payloadScope === "Corpus retrieval" ||
        payloadScope === "Current full text" ||
        currentEvidence.length > 0)
  );
  const scopeDescription =
    payloadScope === "Corpus retrieval"
      ? "Search the selected knowledge base and answer from retrieved chunks."
      : payloadScope === "Current full text"
        ? "Answer from the currently selected paper text."
        : "Answer only from evidence packets attached in the tray.";

  useEffect(() => {
    if (!chatUrl) {
      setMessages([]);
      return;
    }
    const controller = new AbortController();
    setMessage("");
    fetch(chatUrl, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { messages?: AskChatMessage[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load chat");
        setMessages(data.messages ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to load chat");
      });
    return () => controller.abort();
  }, [chatUrl]);

  const ask = async () => {
    if (!paper || !canAsk) return;
    setStatus("asking");
    setMessage("");
    try {
      const response = await fetch(`/api/papers/${encodeURIComponent(paper.recordId)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewProjectId,
          question: question.trim(),
          payloadScope,
          evidence: payloadScope === "Selection" ? currentEvidence : [],
          knowledgeBaseId,
          modelSettings
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to answer question");
      setMessages(data.messages ?? []);
      setQuestion("");
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to answer question");
    }
  };

  const clearChat = async () => {
    if (!paper || !chatUrl) return;
    setStatus("idle");
    setMessage("");
    try {
      const response = await fetch(chatUrl, { method: "DELETE" });
      const data = (await response.json()) as { messages?: AskChatMessage[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to clear chat");
      setMessages(data.messages ?? []);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to clear chat");
    }
  };

  if (!paper) return <p className="text-sm text-swiss-muted">No paper selected.</p>;

  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <label htmlFor="payload-scope" className="text-xs font-semibold">
            Payload scope
          </label>
          <InfoHint label={scopeDescription} />
        </div>
        <select
          id="payload-scope"
          value={payloadScope}
          onChange={(event) => setPayloadScope(event.target.value as PayloadScope)}
          className="border border-swiss-rule bg-white px-2 py-1.5 text-sm"
        >
          <option value="Selection">Attached evidence</option>
          <option value="Current full text">Current full text</option>
          <option value="Corpus retrieval">Knowledge search</option>
        </select>
      </div>
      <p className="workspace-status-line">
        Model: {modelLabel(modelSettings)}
        {payloadScope === "Corpus retrieval" ? ` / KB: ${knowledgeBaseId}` : ""}
      </p>
      {messages.length > 0 ? (
        <div className="ask-chat" aria-label="Ask chat history">
          <div className="ask-chat-header">
            <p className="font-mono text-xs text-swiss-muted">{messages.length} message(s)</p>
            <button type="button" onClick={clearChat} className="workbench-button">
              Clear chat
            </button>
          </div>
          <div className="grid gap-2">
            {messages.map((item) => (
              <article
                key={item.id}
                className={`ask-message ${
                  item.role === "assistant" ? "ask-message-assistant" : "ask-message-user"
                }`}
              >
                <p className="ask-message-role">{item.role === "assistant" ? "Assistant" : "Reviewer"}</p>
                {item.role === "assistant" ? (
                  <div className="ask-markdown">
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
                      {item.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-5">{item.content}</p>
                )}
                {item.role === "assistant" && item.evidenceUsed.length > 0 ? (
                  <div className="mt-2 grid gap-1 border-t border-swiss-rule pt-2">
                    <p className="font-mono text-xs uppercase text-swiss-muted">Evidence used</p>
                    {item.evidenceUsed.map((locator) => (
                      <p key={locator} className="font-mono text-xs text-swiss-red">
                        {locator}
                      </p>
                    ))}
                  </div>
                ) : null}
                {item.role === "assistant" && item.warnings.length > 0 ? (
                  <p className="mt-2 text-xs text-swiss-muted">{item.warnings.join(" ")}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <label htmlFor="scoped-question" className="text-xs font-semibold">
            Question
          </label>
          <InfoHint label="Ask a narrow reading question. For best results, attach a selected paragraph or search the knowledge base." />
        </div>
        <textarea
          id="scoped-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-h-20 resize-y border border-swiss-rule px-2 py-1.5 text-sm leading-5"
        />
      </div>
      <div className="flex items-center justify-between border-t border-swiss-rule pt-2">
        <span className="font-mono text-xs text-swiss-muted">
          {currentEvidence.length} evidence packet(s)
        </span>
        <button
          type="button"
          aria-label={
            payloadScope === "Corpus retrieval"
              ? "Ask with corpus retrieval"
              : payloadScope === "Current full text"
                ? "Ask with current full text"
                : "Ask with evidence"
          }
          onClick={ask}
          disabled={!canAsk || status === "asking"}
          className="workbench-button"
        >
          <PaperPlaneTilt aria-hidden="true" size={14} weight="bold" />
          {status === "asking" ? "Asking" : "Ask"}
        </button>
      </div>
      {message ? <p className="text-sm text-swiss-red">{message}</p> : null}
    </section>
  );
}

function modelLabel(settings?: RuntimeModelSettings): string {
  if (!settings || settings.mode === "mock") return "mock";
  if (settings.mode === "local") {
    return `local / ${settings.localModel || settings.localBaseUrl || "not tested"}`;
  }
  const source =
    settings.onlineConfigSource === "cc_switch"
      ? "cc switch"
      : settings.onlineConfigSource === "env"
        ? "configured environment"
        : "manual";
  return `${source} / ${settings.onlineModel || "not tested"}`;
}
