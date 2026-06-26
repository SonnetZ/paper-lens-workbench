"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useState } from "react";
import type { PaperListItem } from "@/lib/types";

interface BriefResponse {
  brief?: {
    eligibility_suggestion?: string;
    rationale?: string;
    read_first?: string[];
    warnings?: string[];
  };
  error?: string;
}

export function BriefPanel({ paper }: { paper: PaperListItem | null }) {
  const [brief, setBrief] = useState<BriefResponse["brief"] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!paper) return <p className="text-sm text-swiss-muted">No paper selected.</p>;

  const generate = async () => {
    setStatus("loading");
    setMessage("");
    setBrief(null);
    try {
      const response = await fetch(`/api/papers/${paper.recordId}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payloadScope: "Selection" })
      });
      const data = (await response.json()) as BriefResponse;
      if (!response.ok || !data.brief) throw new Error(data.error ?? "Unable to generate brief");
      setBrief(data.brief);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to generate brief");
    }
  };

  return (
    <section className="grid gap-3">
      <p className="workspace-status-line">
        Draft navigation aid. Use it to decide what to read first, then verify against MD/PDF text.
      </p>
      <button
        type="button"
        aria-label="Generate brief"
        onClick={generate}
        disabled={status === "loading"}
        className="workbench-button"
      >
        <Sparkle aria-hidden="true" size={14} weight="bold" />
        {status === "loading" ? "Generating" : "Generate"}
      </button>
      {message ? (
        <p className={status === "error" ? "text-sm text-swiss-red" : "text-sm text-swiss-muted"}>
          {message}
        </p>
      ) : null}
      {brief ? (
        <div className="grid gap-2 border-t border-swiss-rule pt-3 text-sm">
          <p>
            <strong>Suggestion:</strong> {brief.eligibility_suggestion ?? "unknown"}
          </p>
          {brief.rationale ? <p>{brief.rationale}</p> : null}
          {brief.read_first?.length ? (
            <p className="text-swiss-muted">Read first: {brief.read_first.join(", ")}</p>
          ) : null}
          {brief.warnings?.length ? (
            <p className="text-xs text-swiss-muted">{brief.warnings.join(" ")}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
