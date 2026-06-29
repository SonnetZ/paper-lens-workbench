"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { PaperListItem, RuntimeModelSettings } from "@/lib/types";

interface BriefResponse {
  brief?: {
    recordId?: string;
    reviewProjectId?: string;
    eligibility_suggestion?: string;
    rationale?: string;
    read_first?: string[];
    warnings?: string[];
    payload_scope?: string;
    model_settings?: RuntimeModelSettings;
    updated_at?: string;
  } | null;
  error?: string;
}

export function BriefPanel({
  paper,
  modelSettings,
  reviewProjectId = "default"
}: {
  paper: PaperListItem | null;
  modelSettings?: RuntimeModelSettings;
  reviewProjectId?: string;
}) {
  const [brief, setBrief] = useState<BriefResponse["brief"]>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBrief() {
      if (!paper) {
        setBrief(null);
        setMessage("");
        setStatus("idle");
        return;
      }

      setBrief(null);
      setStatus("loading");
      setMessage("");
      try {
        const response = await fetch(
          `/api/papers/${paper.recordId}/brief?reviewProjectId=${encodeURIComponent(reviewProjectId)}`,
          { method: "GET" }
        );
        const data = (await response.json()) as BriefResponse;
        if (cancelled) return;
        setBrief(data.brief ?? null);
        setStatus("idle");
      } catch (error) {
        if (cancelled) return;
        setBrief(null);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to load brief");
      }
    }

    void loadBrief();
    return () => {
      cancelled = true;
    };
  }, [paper, reviewProjectId]);

  if (!paper) return <p className="text-sm text-swiss-muted">No paper selected.</p>;

  const generate = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/papers/${paper.recordId}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewProjectId,
          payloadScope: "Paper sections",
          modelSettings
        })
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
