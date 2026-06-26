"use client";

import { FloppyDisk, FolderOpen, Plus, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { CorpusValidationResult } from "@/lib/types";

interface CorpusConfigResponse {
  config: {
    reviewDataDir: string;
    paperMdDir: string;
    paperPdfDir: string;
    readerDbPath: string;
    readerExportDir: string;
  };
  validation: CorpusValidationResult;
}

interface FileBrowserListing {
  currentPath: string;
  parentPath: string | null;
  entries: Array<{
    name: string;
    path: string;
    kind: "directory" | "file";
  }>;
}

type PathFieldName = "reviewDataDir" | "paperMdDir" | "paperPdfDir";
type BrowserTarget = PathFieldName | "singleFile";

export function CorpusSetup({ onCorpusApplied }: { onCorpusApplied: () => void }) {
  const [reviewDataDir, setReviewDataDir] = useState("");
  const [paperMdDir, setPaperMdDir] = useState("");
  const [paperPdfDir, setPaperPdfDir] = useState("");
  const [singleFilePath, setSingleFilePath] = useState("");
  const [validation, setValidation] = useState<CorpusValidationResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [browserTarget, setBrowserTarget] = useState<BrowserTarget | null>(null);
  const [browser, setBrowser] = useState<FileBrowserListing | null>(null);
  const [browserStatus, setBrowserStatus] = useState<"idle" | "loading" | "error">("idle");
  const [browserMessage, setBrowserMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch("/api/corpus-config")
      .then((response) => {
        if (!response.ok) throw new Error("Corpus configuration API is not reachable");
        return response.json();
      })
      .then((data: CorpusConfigResponse) => {
        if (cancelled) return;
        setReviewDataDir(data.config.reviewDataDir);
        setPaperMdDir(data.config.paperMdDir);
        setPaperPdfDir(data.config.paperPdfDir);
        setValidation(data.validation);
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const paths = useMemo(
    () => ({ reviewDataDir, paperMdDir, paperPdfDir }),
    [reviewDataDir, paperMdDir, paperPdfDir]
  );

  const save = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/corpus-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewDataDir, paperMdDir, paperPdfDir })
      });
      const data = (await response.json()) as Partial<CorpusConfigResponse> & {
        error?: string;
      };
      if (!response.ok || !data.config || !data.validation) {
        throw new Error(data.error ?? "Unable to save corpus paths");
      }
      setReviewDataDir(data.config.reviewDataDir);
      setPaperMdDir(data.config.paperMdDir);
      setPaperPdfDir(data.config.paperPdfDir);
      setValidation(data.validation);
      setStatus("saved");
      setMessage("Corpus paths saved.");
      onCorpusApplied();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save corpus paths");
    }
  };

  const openBrowser = async (field: PathFieldName) => {
    setBrowserTarget(field);
    await loadBrowser(paths[field]);
  };

  const openSingleFileBrowser = async () => {
    setBrowserTarget("singleFile");
    await loadBrowser(reviewDataDir);
  };

  const loadBrowser = async (pathname: string) => {
    setBrowserStatus("loading");
    setBrowserMessage("");
    try {
      const response = await fetch(`/api/file-browser?path=${encodeURIComponent(pathname)}`);
      const data = (await response.json()) as FileBrowserListing & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to list directory");
      setBrowser(data);
      setBrowserStatus("idle");
    } catch (error) {
      setBrowserStatus("error");
      setBrowserMessage(error instanceof Error ? error.message : "Unable to list directory");
    }
  };

  const applyBrowserPath = () => {
    if (!browserTarget || !browser || browserTarget === "singleFile") return;
    setPathValue(browserTarget, browser.currentPath);
    setBrowserTarget(null);
    setBrowser(null);
  };

  const addSingleFile = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/corpus-config/source-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewDataDir, paperMdDir, paperPdfDir, filePath: singleFilePath })
      });
      const data = (await response.json()) as Partial<CorpusConfigResponse> & { error?: string };
      if (!response.ok || !data.validation) {
        throw new Error(data.error ?? "Unable to add paper source file");
      }
      setValidation(data.validation);
      setStatus("saved");
      setMessage("Paper file added to review queue.");
      onCorpusApplied();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to add paper source file");
    }
  };

  const setPathValue = (field: PathFieldName, value: string) => {
    if (field === "reviewDataDir") setReviewDataDir(value);
    if (field === "paperMdDir") setPaperMdDir(value);
    if (field === "paperPdfDir") setPaperPdfDir(value);
  };

  return (
    <section className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Corpus setup"
            onClick={() => setOpen(true)}
            className="workbench-button"
          >
            <FolderOpen aria-hidden="true" size={14} weight="bold" />
            Library paths
          </button>
          <span className="truncate font-mono text-[11px] text-swiss-muted">
            {validation
              ? `${validation.summary.markdownFileCount} MD / ${validation.summary.screeningRowCount} rows`
              : "Paths not loaded"}
          </span>
          {status !== "idle" ? (
            <span className="font-mono text-[11px] text-swiss-muted">{statusLabel(status)}</span>
          ) : null}
      </div>

      {message && !open ? (
        <p className={status === "error" ? "mt-2 text-xs text-swiss-red" : "mt-2 text-xs"}>
          {message}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Corpus setup"
            className="max-h-[88dvh] w-full max-w-3xl overflow-auto border border-swiss-rule bg-white"
          >
            <div className="flex items-center justify-between border-b border-swiss-rule px-4 py-3">
              <h2 className="text-sm font-semibold">Corpus setup</h2>
              <button
                type="button"
                aria-label="Close corpus setup"
                onClick={() => setOpen(false)}
                className="workbench-icon-button workbench-icon-button-sm"
              >
                <X aria-hidden="true" size={13} weight="bold" />
              </button>
            </div>
            <div className="grid gap-3 px-4 py-4">
              <PathField
                id="corpus-review-data-dir"
                label="Review data folder"
                selectLabel="Select Review data folder"
                value={reviewDataDir}
                onChange={setReviewDataDir}
                onSelect={() => openBrowser("reviewDataDir")}
              />
              <PathField
                id="corpus-paper-md-dir"
                label="Markdown papers folder"
                selectLabel="Select Markdown papers folder"
                value={paperMdDir}
                onChange={setPaperMdDir}
                onSelect={() => openBrowser("paperMdDir")}
              />
              <PathField
                id="corpus-paper-pdf-dir"
                label="PDF papers folder"
                selectLabel="Select PDF papers folder"
                value={paperPdfDir}
                onChange={setPaperPdfDir}
                onSelect={() => openBrowser("paperPdfDir")}
              />
              <div className="grid gap-1">
                <label htmlFor="corpus-single-paper-file" className="text-xs font-semibold">
                  Single paper file
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    id="corpus-single-paper-file"
                    value={singleFilePath}
                    onChange={(event) => setSingleFilePath(event.target.value)}
                    className="min-w-0 border border-r-0 border-swiss-rule px-2 py-1.5 font-mono text-xs"
                    placeholder="/absolute/path/to/paper.pdf"
                  />
                  <button
                    type="button"
                    aria-label="Select single paper file"
                    onClick={openSingleFileBrowser}
                    className="workbench-button rounded-none border-r-0"
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    aria-label="Add file"
                    onClick={addSingleFile}
                    disabled={!singleFilePath.trim() || status === "saving"}
                    className="workbench-button rounded-l-none"
                  >
                    <Plus aria-hidden="true" size={14} weight="bold" />
                    Add file
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label="Save corpus paths"
                onClick={save}
                disabled={status === "saving"}
                className="workbench-button"
              >
                <FloppyDisk aria-hidden="true" size={14} weight="bold" />
                {status === "saving" ? "Saving" : "Save paths"}
              </button>
            </div>

            {validation ? (
              <div className="grid grid-cols-2 gap-1 border-t border-swiss-rule px-4 py-3 font-mono text-[11px] text-swiss-muted">
                <span>
                  {validation.summary.screeningCsv ? "Screening CSV found" : "No screening CSV"}
                </span>
                <span>
                  {validation.summary.controlledVocabularies
                    ? "Vocabularies found"
                    : "No vocabularies file"}
                </span>
                <span>{validation.summary.markdownFileCount} Markdown files</span>
                <span>{validation.summary.pdfFileCount} PDF files</span>
                <span>{validation.summary.screeningRowCount} screening rows</span>
                <span>{validation.summary.addedScreeningRowCount} screening rows added</span>
              </div>
            ) : null}
            {validation?.issues.length ? (
              <ul className="grid gap-1 border-t border-swiss-rule px-4 py-3 text-xs text-swiss-red">
                {validation.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            {message ? (
              <p
                className={
                  status === "error"
                    ? "border-t border-swiss-rule px-4 py-3 text-xs text-swiss-red"
                    : "border-t border-swiss-rule px-4 py-3 text-xs"
                }
              >
                {message}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {browserTarget ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/20 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={browserTarget === "singleFile" ? "Select paper file" : "Select corpus folder"}
            className="max-h-[80dvh] w-full max-w-2xl overflow-auto border border-swiss-rule bg-white"
          >
            <div className="flex items-center justify-between border-b border-swiss-rule px-4 py-3">
              <h3 className="text-sm font-semibold">
                {browserTarget === "singleFile" ? "Select paper file" : "Select folder"}
              </h3>
              <button
                type="button"
                aria-label="Close file browser"
                onClick={() => {
                  setBrowserTarget(null);
                  setBrowser(null);
                }}
                className="workbench-icon-button workbench-icon-button-sm"
              >
                <X aria-hidden="true" size={13} weight="bold" />
              </button>
            </div>
            <div className="border-b border-swiss-rule px-4 py-3">
              <p className="break-all font-mono text-xs text-swiss-muted">
                {browser?.currentPath ?? (browserTarget === "singleFile" ? reviewDataDir : paths[browserTarget])}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {browserTarget !== "singleFile" ? (
                  <button
                    type="button"
                    aria-label="Use this folder"
                    onClick={applyBrowserPath}
                    disabled={!browser}
                    className="workbench-button"
                  >
                    Use this folder
                  </button>
                ) : null}
                {browser?.parentPath ? (
                  <button
                    type="button"
                    aria-label="Parent folder"
                    onClick={() => loadBrowser(browser.parentPath ?? "")}
                    className="workbench-button"
                  >
                    Parent folder
                  </button>
                ) : null}
              </div>
            </div>
            {browserStatus === "loading" ? (
              <p className="px-4 py-4 text-xs text-swiss-muted">Loading folder</p>
            ) : null}
            {browserStatus === "error" ? (
              <p className="px-4 py-4 text-xs text-swiss-red">{browserMessage}</p>
            ) : null}
            {browser ? (
              <div className="max-h-[48dvh] overflow-auto">
                {browser.entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    aria-label={entry.name}
                    onClick={() => {
                      if (entry.kind === "directory") {
                        void loadBrowser(entry.path);
                        return;
                      }
                      if (browserTarget === "singleFile" && isPaperFile(entry.name)) {
                        setSingleFilePath(entry.path);
                        setBrowserTarget(null);
                        setBrowser(null);
                      }
                    }}
                    disabled={entry.kind === "file" && (browserTarget !== "singleFile" || !isPaperFile(entry.name))}
                    className="grid w-full grid-cols-[88px_minmax(0,1fr)] border-b border-swiss-rule px-4 py-2 text-left text-xs transition enabled:hover:bg-swiss-wash disabled:text-swiss-muted"
                  >
                    <span className="font-mono uppercase">{entry.kind}</span>
                    <span className="truncate">{entry.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function PathField({
  id,
  label,
  selectLabel,
  value,
  onChange,
  onSelect
}: {
  id: string;
  label: string;
  selectLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: () => void;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto]">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 border border-r-0 border-swiss-rule px-2 py-1.5 font-mono text-xs"
        />
        <button
          type="button"
          aria-label={selectLabel}
          onClick={onSelect}
          className="workbench-button rounded-l-none"
        >
          Select
        </button>
      </div>
    </div>
  );
}

function statusLabel(status: "idle" | "loading" | "saving" | "saved" | "error") {
  if (status === "loading") return "loading";
  if (status === "saving") return "saving";
  if (status === "saved") return "saved";
  if (status === "error") return "error";
  return "paths";
}

function isPaperFile(filename: string): boolean {
  return /\.(md|pdf)$/i.test(filename);
}
