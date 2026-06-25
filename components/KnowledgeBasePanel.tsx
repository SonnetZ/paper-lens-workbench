"use client";

import { useEffect, useState } from "react";
import type { KnowledgeBaseStatus, KnowledgeSearchResult, PaperListItem } from "@/lib/types";

const emptyStatus: KnowledgeBaseStatus = {
  documentCount: 0,
  chunkCount: 0,
  paperDocumentCount: 0,
  artifactDocumentCount: 0,
  evidenceDocumentCount: 0,
  embeddingModel: "portable-hash-v1",
  updatedAt: null
};

function isKnowledgeBaseStatus(value: unknown): value is KnowledgeBaseStatus {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<KnowledgeBaseStatus>;
  return (
    typeof candidate.documentCount === "number" &&
    typeof candidate.chunkCount === "number" &&
    typeof candidate.paperDocumentCount === "number" &&
    typeof candidate.artifactDocumentCount === "number" &&
    typeof candidate.evidenceDocumentCount === "number" &&
    typeof candidate.embeddingModel === "string" &&
    (candidate.updatedAt === null || typeof candidate.updatedAt === "string")
  );
}

export function KnowledgeBasePanel({ paper }: { paper: PaperListItem | null }) {
  const [status, setStatus] = useState<KnowledgeBaseStatus>(emptyStatus);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "indexing" | "searching" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch("/api/knowledge-base")
      .then((response) => {
        if (!response.ok) throw new Error("Knowledge base status unavailable");
        return response.json();
      })
      .then((data: { status?: unknown }) => {
        if (cancelled) return;
        if (!isKnowledgeBaseStatus(data.status)) {
          throw new Error("Knowledge base status unavailable");
        }
        setStatus(data.status);
        setState("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus(emptyStatus);
        setState("error");
        setMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildCorpus = async () => {
    setState("indexing");
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-base", { method: "POST" });
      const data = (await response.json()) as {
        status?: KnowledgeBaseStatus;
        ingested?: { documentCount: number; chunkCount: number };
        error?: string;
      };
      if (!response.ok || !data.status) throw new Error(data.error ?? "Unable to build corpus index");
      setStatus(data.status);
      setMessage(`Indexed ${data.ingested?.chunkCount ?? 0} chunk(s).`);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to build corpus index");
    }
  };

  const addCurrent = async (includeArtifacts: boolean) => {
    if (!paper) return;
    setState("indexing");
    setMessage("");
    try {
      const response = await fetch(`/api/papers/${paper.recordId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includePaper: !includeArtifacts, includeArtifacts })
      });
      const data = (await response.json()) as {
        status?: KnowledgeBaseStatus;
        ingested?: { documentCount: number; chunkCount: number };
        error?: string;
      };
      if (!response.ok || !data.status) throw new Error(data.error ?? "Unable to add knowledge");
      setStatus(data.status);
      setMessage(`Indexed ${data.ingested?.chunkCount ?? 0} chunk(s).`);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to add knowledge");
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setState("searching");
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-base/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), topK: 6 })
      });
      const data = (await response.json()) as {
        results?: KnowledgeSearchResult[];
        error?: string;
      };
      if (!response.ok || !data.results) throw new Error(data.error ?? "Unable to search knowledge");
      setResults(data.results);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to search knowledge");
    }
  };

  return (
    <section className="grid gap-3">
      <div className="workspace-status-strip grid-cols-2">
        <span>{status.documentCount} documents</span>
        <span>{status.chunkCount} chunks</span>
        <span>{status.paperDocumentCount} paper docs</span>
        <span>{status.artifactDocumentCount + status.evidenceDocumentCount} review docs</span>
        <span className="col-span-2">{status.embeddingModel}</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={buildCorpus}
          disabled={state === "indexing"}
          className="border border-swiss-rule px-2 py-1.5 text-xs transition hover:border-swiss-red disabled:text-swiss-muted active:translate-y-px"
        >
          {state === "indexing" ? "Indexing knowledge" : "Build corpus index"}
        </button>
        <button
          type="button"
          onClick={() => addCurrent(false)}
          disabled={!paper || state === "indexing"}
          className="border border-swiss-rule px-2 py-1.5 text-xs transition hover:border-swiss-red disabled:text-swiss-muted active:translate-y-px"
        >
          Add current paper
        </button>
        <button
          type="button"
          onClick={() => addCurrent(true)}
          disabled={!paper || state === "indexing"}
          className="border border-swiss-rule px-2 py-1.5 text-xs transition hover:border-swiss-red disabled:text-swiss-muted active:translate-y-px"
        >
          Add review artifacts
        </button>
      </div>
      <div className="grid gap-1.5 border-t border-swiss-rule pt-3">
        <label htmlFor="knowledge-search" className="text-xs font-semibold">
          Knowledge search
        </label>
        <textarea
          id="knowledge-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-16 resize-y border border-swiss-rule px-2 py-1.5 text-sm leading-5"
        />
        <button
          type="button"
          onClick={search}
          disabled={!query.trim() || state === "searching"}
          className="border border-swiss-rule px-2 py-1.5 text-xs transition hover:border-swiss-red disabled:text-swiss-muted active:translate-y-px"
        >
          {state === "searching" ? "Searching knowledge" : "Search knowledge"}
        </button>
      </div>
      {message ? (
        <p className={state === "error" ? "text-xs text-swiss-red" : "text-xs text-swiss-muted"}>
          {message}
        </p>
      ) : null}
      {results.length > 0 ? (
        <div className="grid gap-2 border-t border-swiss-rule pt-3">
          {results.map((result) => (
            <article key={result.chunkId} className="border-b border-swiss-rule pb-2">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-swiss-red">
                <span>{result.recordId}</span>
                <span>{result.sourceKind} / {result.score.toFixed(3)}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-swiss-muted">
                {result.headingPath || result.sourceId}
              </p>
              <p className="mt-1 text-sm leading-5 text-swiss-ink">{result.text}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
