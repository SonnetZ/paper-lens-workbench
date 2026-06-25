"use client";

import { useMemo, useState } from "react";
import type {
  EvidencePacket,
  PaperListItem,
  PayloadScope,
  RuntimeModelSettings,
  ScopedAskAnswer
} from "@/lib/types";

export function AskPanel({
  paper,
  evidence,
  modelSettings
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  modelSettings?: RuntimeModelSettings;
}) {
  const [question, setQuestion] = useState("");
  const [payloadScope, setPayloadScope] = useState<PayloadScope>("Selection");
  const [answer, setAnswer] = useState<ScopedAskAnswer | null>(null);
  const [status, setStatus] = useState<"idle" | "asking" | "error">("idle");
  const [message, setMessage] = useState("");
  const currentEvidence = useMemo(
    () => evidence.filter((item) => item.recordId === paper?.recordId),
    [evidence, paper?.recordId]
  );
  const canAsk = Boolean(
    paper &&
      question.trim() &&
      (payloadScope === "Corpus retrieval" || currentEvidence.length > 0)
  );
  const scopeDescription =
    payloadScope === "Corpus retrieval"
      ? "Searches the local review knowledge base, then sends retrieved chunks."
      : "Uses evidence packets attached to this paper.";

  const ask = async () => {
    if (!paper || !canAsk) return;
    setStatus("asking");
    setMessage("");
    setAnswer(null);
    try {
      const response = await fetch(`/api/papers/${paper.recordId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          payloadScope,
          evidence: currentEvidence,
          modelSettings
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to answer question");
      setAnswer(data.answer);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to answer question");
    }
  };

  if (!paper) return <p className="text-sm text-swiss-muted">No paper selected.</p>;

  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="payload-scope" className="text-xs font-semibold">
          Payload scope
        </label>
        <select
          id="payload-scope"
          value={payloadScope}
          onChange={(event) => setPayloadScope(event.target.value as PayloadScope)}
          className="border border-swiss-rule bg-white px-2 py-1.5 text-sm"
        >
          <option value="Selection">Selection</option>
          <option value="Corpus retrieval">Corpus retrieval</option>
        </select>
        <p className="text-xs text-swiss-muted">{scopeDescription}</p>
      </div>
      <p className="workspace-status-line">
        Model: {modelLabel(modelSettings)}
      </p>
      <div className="grid gap-1.5">
        <label htmlFor="scoped-question" className="text-xs font-semibold">
          Question
        </label>
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
          onClick={ask}
          disabled={!canAsk || status === "asking"}
          className="border border-swiss-rule px-2 py-1.5 text-xs transition hover:border-swiss-red disabled:text-swiss-muted active:translate-y-px"
        >
          {status === "asking"
            ? payloadScope === "Corpus retrieval"
              ? "Asking with corpus retrieval"
              : "Asking with evidence"
            : payloadScope === "Corpus retrieval"
              ? "Ask with corpus retrieval"
              : "Ask with evidence"}
        </button>
      </div>
      {message ? <p className="text-sm text-swiss-red">{message}</p> : null}
      {answer ? (
        <div className="border-t border-swiss-rule pt-3">
          <p className="text-sm leading-5">{answer.answer}</p>
          <div className="mt-3 grid gap-1">
            <p className="font-mono text-xs uppercase text-swiss-muted">Evidence used</p>
            {answer.evidenceUsed.map((locator) => (
              <p key={locator} className="font-mono text-xs text-swiss-red">
                {locator}
              </p>
            ))}
          </div>
          {answer.warnings.length > 0 ? (
            <p className="mt-3 border-t border-swiss-rule pt-2 text-xs text-swiss-muted">
              {answer.warnings.join(" ")}
            </p>
          ) : null}
        </div>
      ) : null}
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
