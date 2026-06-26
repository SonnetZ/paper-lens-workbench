"use client";

import { Database, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type {
  KnowledgeBaseStatus,
  KnowledgeBaseSummary,
  KnowledgeSearchResult,
  PaperListItem
} from "@/lib/types";
import { InfoHint } from "@/components/InfoHint";

const emptyStatus: KnowledgeBaseStatus = {
  knowledgeBaseId: "default",
  knowledgeBaseName: "Default review",
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
    typeof candidate.knowledgeBaseId === "string" &&
    typeof candidate.knowledgeBaseName === "string" &&
    typeof candidate.documentCount === "number" &&
    typeof candidate.chunkCount === "number" &&
    typeof candidate.paperDocumentCount === "number" &&
    typeof candidate.artifactDocumentCount === "number" &&
    typeof candidate.evidenceDocumentCount === "number" &&
    typeof candidate.embeddingModel === "string" &&
    (candidate.updatedAt === null || typeof candidate.updatedAt === "string")
  );
}

export function KnowledgeBasePanel({
  paper,
  selectedKnowledgeBaseId,
  onKnowledgeBaseChange
}: {
  paper: PaperListItem | null;
  selectedKnowledgeBaseId?: string;
  onKnowledgeBaseChange?: (knowledgeBaseId: string) => void;
}) {
  const [localKnowledgeBaseId, setLocalKnowledgeBaseId] = useState("default");
  const activeKnowledgeBaseId = selectedKnowledgeBaseId ?? localKnowledgeBaseId;
  const [bases, setBases] = useState<KnowledgeBaseSummary[]>([]);
  const [status, setStatus] = useState<KnowledgeBaseStatus>(emptyStatus);
  const [query, setQuery] = useState("");
  const [newBaseName, setNewBaseName] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "creating" | "indexing" | "searching" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/knowledge-base?knowledgeBaseId=${encodeURIComponent(activeKnowledgeBaseId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Knowledge base status unavailable");
        return response.json();
      })
      .then((data: { bases?: KnowledgeBaseSummary[]; status?: unknown }) => {
        if (cancelled) return;
        if (!isKnowledgeBaseStatus(data.status)) {
          throw new Error("Knowledge base status unavailable");
        }
        setBases(data.bases ?? []);
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
  }, [activeKnowledgeBaseId]);

  const updateKnowledgeBase = (knowledgeBaseId: string) => {
    setLocalKnowledgeBaseId(knowledgeBaseId);
    onKnowledgeBaseChange?.(knowledgeBaseId);
    setResults([]);
  };

  const createBase = async () => {
    if (!newBaseName.trim()) return;
    setState("creating");
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newBaseName.trim() })
      });
      const data = (await response.json()) as {
        base?: KnowledgeBaseSummary;
        bases?: KnowledgeBaseSummary[];
        status?: KnowledgeBaseStatus;
        error?: string;
      };
      if (!response.ok || !data.base || !data.status) {
        throw new Error(data.error ?? "Unable to create knowledge base");
      }
      setNewBaseName("");
      setBases(data.bases ?? []);
      setStatus(data.status);
      updateKnowledgeBase(data.base.id);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to create knowledge base");
    }
  };

  const buildCorpus = async () => {
    setState("indexing");
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "build-corpus",
          knowledgeBaseId: activeKnowledgeBaseId
        })
      });
      const data = (await response.json()) as {
        status?: KnowledgeBaseStatus;
        bases?: KnowledgeBaseSummary[];
        ingested?: { documentCount: number; chunkCount: number };
        error?: string;
      };
      if (!response.ok || !data.status) throw new Error(data.error ?? "Unable to build corpus index");
      setBases(data.bases ?? bases);
      setStatus(data.status);
      setMessage(`Indexed ${data.ingested?.chunkCount ?? 0} chunk(s) into ${data.status.knowledgeBaseName}.`);
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
        body: JSON.stringify({
          includePaper: !includeArtifacts,
          includeArtifacts,
          knowledgeBaseId: activeKnowledgeBaseId
        })
      });
      const data = (await response.json()) as {
        status?: KnowledgeBaseStatus;
        bases?: KnowledgeBaseSummary[];
        ingested?: { documentCount: number; chunkCount: number };
        error?: string;
      };
      if (!response.ok || !data.status) throw new Error(data.error ?? "Unable to add knowledge");
      setBases(data.bases ?? bases);
      setStatus(data.status);
      setMessage(`Indexed ${data.ingested?.chunkCount ?? 0} chunk(s) into ${data.status.knowledgeBaseName}.`);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to add knowledge");
    }
  };

  const addIncludedArtifacts = async () => {
    setState("indexing");
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-included-artifacts",
          knowledgeBaseId: activeKnowledgeBaseId
        })
      });
      const data = (await response.json()) as {
        status?: KnowledgeBaseStatus;
        bases?: KnowledgeBaseSummary[];
        ingested?: { documentCount: number; chunkCount: number };
        error?: string;
      };
      if (!response.ok || !data.status) {
        throw new Error(data.error ?? "Unable to add included review outputs");
      }
      setBases(data.bases ?? bases);
      setStatus(data.status);
      setMessage(`Indexed ${data.ingested?.chunkCount ?? 0} included-review chunk(s).`);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to add included review outputs");
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
        body: JSON.stringify({
          query: query.trim(),
          topK: 6,
          knowledgeBaseId: activeKnowledgeBaseId
        })
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
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <label htmlFor="knowledge-base-select" className="text-xs font-semibold">
            Knowledge base
          </label>
          <InfoHint label="Choose the RAG index for this review. Build, add, search, and Ask with Knowledge search all use this selected base." />
        </div>
        <select
          id="knowledge-base-select"
          value={activeKnowledgeBaseId}
          onChange={(event) => updateKnowledgeBase(event.target.value)}
          className="border border-swiss-rule bg-white px-2 py-1.5 text-sm"
        >
          {(bases.length
            ? bases
            : [
                {
                  id: "default",
                  name: "Default review",
                  documentCount: 0,
                  chunkCount: 0,
                  updatedAt: null
                }
              ]
          ).map((base) => (
            <option key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            aria-label="New knowledge base name"
            value={newBaseName}
            onChange={(event) => setNewBaseName(event.target.value)}
            className="min-w-0 border border-swiss-rule px-2 py-1.5 text-sm"
            placeholder="New review knowledge base"
          />
          <button
            type="button"
            aria-label="Create knowledge base"
            onClick={createBase}
            disabled={!newBaseName.trim() || state === "creating"}
            className="workbench-button"
          >
            <Plus aria-hidden="true" size={14} weight="bold" />
            {state === "creating" ? "Creating" : "Create"}
          </button>
        </div>
      </div>
      <div className="workspace-status-strip grid-cols-2">
        <span className="col-span-2">{status.knowledgeBaseName}</span>
        <span>{status.documentCount} documents</span>
        <span>{status.chunkCount} chunks</span>
        <span>{status.paperDocumentCount} paper docs</span>
        <span>{status.artifactDocumentCount + status.evidenceDocumentCount} review docs</span>
        <span className="col-span-2">{status.embeddingModel}</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          aria-label="Build corpus index"
          onClick={buildCorpus}
          disabled={state === "indexing"}
          className="workbench-button"
        >
          <Database aria-hidden="true" size={14} weight="bold" />
          {state === "indexing" ? "Indexing" : "Build index"}
        </button>
        <button
          type="button"
          aria-label="Add current paper"
          onClick={() => addCurrent(false)}
          disabled={!paper || state === "indexing"}
          className="workbench-button"
        >
          <Plus aria-hidden="true" size={14} weight="bold" />
          Add paper
        </button>
        <button
          type="button"
          aria-label="Add review artifacts"
          onClick={() => addCurrent(true)}
          disabled={!paper || state === "indexing"}
          className="workbench-button"
        >
          <Plus aria-hidden="true" size={14} weight="bold" />
          Add artifacts
        </button>
        <button
          type="button"
          aria-label="Add included review outputs"
          onClick={addIncludedArtifacts}
          disabled={state === "indexing"}
          className="workbench-button"
        >
          <Plus aria-hidden="true" size={14} weight="bold" />
          Add included outputs
        </button>
      </div>
      <div className="grid gap-1.5 border-t border-swiss-rule pt-3">
        <div className="flex items-center gap-1">
          <label htmlFor="knowledge-search" className="text-xs font-semibold">
            Knowledge search
          </label>
          <InfoHint label="Search the selected knowledge base. Results appear below with record ID, source kind, score, locator, and matching text." />
        </div>
        <textarea
          id="knowledge-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-16 resize-y border border-swiss-rule px-2 py-1.5 text-sm leading-5"
        />
        <button
          type="button"
          aria-label="Search knowledge"
          onClick={search}
          disabled={!query.trim() || state === "searching"}
          className="workbench-button"
        >
          <MagnifyingGlass aria-hidden="true" size={14} weight="bold" />
          {state === "searching" ? "Searching" : "Search"}
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
