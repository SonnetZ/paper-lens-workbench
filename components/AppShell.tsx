"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EvidenceInput,
  EvidencePacket,
  EvidenceRouteEvent,
  EvidenceRouteInput,
  PaperListItem,
  RuntimeModelSettings
} from "@/lib/types";
import { EvidenceTray } from "@/components/EvidenceTray";
import { PaperQueue } from "@/components/PaperQueue";
import { ReaderShell } from "@/components/ReaderShell";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";

interface Props {
  initialPapers: PaperListItem[];
}

export function AppShell({ initialPapers }: Props) {
  const [papers, setPapers] = useState(initialPapers);
  const [selectedRecordId, setSelectedRecordId] = useState(initialPapers[0]?.recordId ?? null);
  const [modelSettings, setModelSettings] = useState<RuntimeModelSettings>({
    mode: "mock",
    localBaseUrl: "http://localhost:8000/v1",
    localModel: "",
    onlineBaseUrl: "",
    onlineModel: "",
    onlineConfigSource: "manual",
    onlineApiKey: ""
  });
  const [evidence, setEvidence] = useState<EvidencePacket[]>([]);
  const [evidenceRoute, setEvidenceRoute] = useState<EvidenceRouteEvent | null>(null);
  const [evidenceStatus, setEvidenceStatus] = useState<"idle" | "loading" | "saving" | "error">(
    "idle"
  );
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const selectedPaper = useMemo(
    () => papers.find((paper) => paper.recordId === selectedRecordId) ?? null,
    [papers, selectedRecordId]
  );

  useEffect(() => {
    if (!selectedRecordId) {
      setEvidence([]);
      setEvidenceStatus("idle");
      setEvidenceMessage("");
      return;
    }

    let cancelled = false;
    setEvidence([]);
    setEvidenceStatus("loading");
    setEvidenceMessage("");

    fetch(`/api/evidence?recordId=${encodeURIComponent(selectedRecordId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Evidence packets not available");
        return response.json();
      })
      .then((data: { evidence: EvidencePacket[] }) => {
        if (cancelled) return;
        setEvidence(data.evidence);
        setEvidenceStatus("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setEvidence([]);
        setEvidenceStatus("error");
        setEvidenceMessage(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRecordId]);

  const saveEvidence = async (input: EvidenceInput) => {
    setEvidenceStatus("saving");
    setEvidenceMessage("");
    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save evidence");
      setEvidence((items) => [data.evidence, ...items]);
      setEvidenceStatus("idle");
    } catch (error) {
      setEvidenceStatus("error");
      setEvidenceMessage(error instanceof Error ? error.message : "Unable to save evidence");
    }
  };

  const routeEvidence = (input: EvidenceRouteInput) => {
    setEvidenceRoute((current) => ({
      ...input,
      routeId: (current?.routeId ?? 0) + 1
    }));
  };

  const reloadPapers = async () => {
    const response = await fetch("/api/papers");
    const data = (await response.json()) as { papers: PaperListItem[] };
    if (!response.ok) throw new Error("Paper queue not available");
    setPapers(data.papers);
    setSelectedRecordId(data.papers[0]?.recordId ?? null);
  };

  const savePdfVerificationNote = async (
    evidenceId: string,
    pdfVerificationNote: string
  ) => {
    setEvidenceStatus("saving");
    setEvidenceMessage("");
    try {
      const response = await fetch("/api/evidence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId, pdfVerificationNote })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update evidence");
      setEvidence((items) =>
        items.map((item) => (item.id === data.evidence.id ? data.evidence : item))
      );
      setEvidenceStatus("idle");
    } catch (error) {
      setEvidenceStatus("error");
      setEvidenceMessage(error instanceof Error ? error.message : "Unable to update evidence");
    }
  };

  return (
    <main className="grid min-h-[100dvh] grid-cols-1 bg-white text-swiss-ink md:grid-cols-[300px_minmax(0,1fr)_360px]">
      <PaperQueue
        papers={papers}
        selectedRecordId={selectedRecordId}
        onSelect={setSelectedRecordId}
        onCorpusApplied={reloadPapers}
      />
      <section className="grid min-h-[60dvh] grid-rows-[1fr_auto] border-r border-swiss-rule">
        <ReaderShell
          paper={selectedPaper}
          onEvidence={saveEvidence}
        />
        <EvidenceTray
          recordId={selectedPaper?.recordId ?? null}
          evidence={evidence}
          status={evidenceStatus}
          message={evidenceMessage}
          onManualEvidence={saveEvidence}
          onRouteEvidence={routeEvidence}
          onPdfVerificationNote={savePdfVerificationNote}
        />
      </section>
      <ReviewWorkspace
        paper={selectedPaper}
        evidence={evidence}
        evidenceRoute={evidenceRoute}
        modelSettings={modelSettings}
        onModelSettingsChange={setModelSettings}
      />
    </main>
  );
}
