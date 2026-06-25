"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import type { PaperListItem } from "@/lib/types";

interface ExportResponse {
  export: {
    recordId: string;
    format: "markdown";
    path: string;
    evidenceCount: number;
  };
}

export function ReviewMaterialExport({ paper }: { paper: PaperListItem | null }) {
  const [status, setStatus] = useState<"idle" | "exporting" | "exported" | "error">("idle");
  const [message, setMessage] = useState("");
  const [exportPath, setExportPath] = useState("");

  if (!paper) return <p className="text-sm text-swiss-muted">No paper selected.</p>;

  const exportMaterial = async () => {
    setStatus("exporting");
    setMessage("");
    setExportPath("");

    try {
      const response = await fetch(`/api/papers/${paper.recordId}/export`, { method: "POST" });
      const data = (await response.json()) as Partial<ExportResponse> & { error?: string };
      if (!response.ok || !data.export) {
        throw new Error(data.error ?? "Unable to export review material");
      }
      setStatus("exported");
      setMessage(`Exported ${data.export.evidenceCount} evidence item(s).`);
      setExportPath(data.export.path);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to export review material");
    }
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={exportMaterial}
        disabled={status === "exporting"}
        className="inline-flex items-center justify-center gap-2 border border-swiss-rule px-3 py-2 text-sm font-semibold text-swiss-ink transition hover:border-swiss-red disabled:text-swiss-muted active:translate-y-px"
      >
        <DownloadSimple aria-hidden="true" size={16} weight="bold" />
        {status === "exporting" ? "Exporting review material" : "Export review material"}
      </button>
      {message ? (
        <p className={status === "error" ? "text-sm text-swiss-red" : "text-sm text-swiss-ink"}>
          {message}
        </p>
      ) : null}
      {exportPath ? (
        <p className="break-all border-t border-swiss-rule pt-2 font-mono text-xs text-swiss-muted">
          {exportPath}
        </p>
      ) : null}
    </div>
  );
}
