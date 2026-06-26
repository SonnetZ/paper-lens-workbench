"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type {
  EvidencePacket,
  EvidenceRouteEvent,
  PaperListItem,
  RuntimeModelSettings
} from "@/lib/types";
import { AskPanel } from "@/components/AskPanel";
import { ArtifactView } from "@/components/ArtifactView";
import { BriefPanel } from "@/components/BriefPanel";
import { ExtractionForm } from "@/components/ExtractionForm";
import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";
import { ModelSourceControl } from "@/components/ModelSourceControl";
import { ReviewMaterialExport } from "@/components/ReviewMaterialExport";
import { ScreeningForm } from "@/components/ScreeningForm";

export function ReviewWorkspace({
  paper,
  evidence,
  evidenceRoute,
  modelSettings,
  onModelSettingsChange,
  collapsed = false,
  onCollapsedChange
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  evidenceRoute?: EvidenceRouteEvent | null;
  modelSettings: RuntimeModelSettings;
  onModelSettingsChange: (settings: RuntimeModelSettings) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  if (collapsed) {
    return (
      <aside aria-label="Review workspace" className="review-workspace-collapsed">
        <button
          type="button"
          aria-label="Expand review workspace"
          onClick={() => onCollapsedChange?.(false)}
          className="review-workspace-collapse-button"
        >
          <CaretLeft aria-hidden="true" weight="bold" className="size-4" />
          <span className="review-workspace-collapsed-label">Workspace</span>
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label="Review workspace" className="min-h-0 overflow-auto bg-swiss-wash md:h-[100dvh]">
      <header className="flex items-start justify-between gap-3 border-b border-swiss-rule bg-white px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Review workspace</h2>
          <p className="mt-1 font-mono text-xs text-swiss-muted">{paper?.recordId ?? "No record"}</p>
        </div>
        <button
          type="button"
          aria-label="Collapse review workspace"
          onClick={() => onCollapsedChange?.(true)}
          className="workbench-icon-button workbench-icon-button-sm"
        >
          <CaretRight aria-hidden="true" weight="bold" className="size-3.5" />
        </button>
      </header>
      <div className="grid gap-5 p-4">
        <WorkspaceGroup title="Model">
          <ArtifactView
            title="Model source"
            info="Choose Local or Online for Ask, translation, and model-assisted helpers. Click a source to open its settings."
            storageKey="review-workspace:model-source"
          >
            <ModelSourceControl value={modelSettings} onChange={onModelSettingsChange} />
          </ArtifactView>
        </WorkspaceGroup>

        <WorkspaceGroup title="AI help">
          <ArtifactView
            title="Ask"
            info="Ask a question from attached evidence or from the local knowledge base. It will not send the full paper."
            storageKey="review-workspace:ask"
          >
            <AskPanel paper={paper} evidence={evidence} modelSettings={modelSettings} />
          </ArtifactView>
          <ArtifactView
            title="Brief"
            info="Generate a quick navigation brief: suggested decision, rationale, and sections to read first. Treat it as a draft."
            storageKey="review-workspace:brief"
          >
            <BriefPanel paper={paper} />
          </ArtifactView>
        </WorkspaceGroup>

        <WorkspaceGroup title="Corpus">
          <ArtifactView
            title="Knowledge base"
            info="Index papers and saved review notes, then search them for evidence-aware reading support."
            storageKey="review-workspace:knowledge-base"
          >
            <KnowledgeBasePanel paper={paper} />
          </ArtifactView>
        </WorkspaceGroup>

        <WorkspaceGroup title="Human record">
          <ArtifactView
            title="Screening"
            info="Record the include/exclude/maybe decision and cite the evidence locator from MD or PDF."
            storageKey="review-workspace:screening"
          >
            <ScreeningForm paper={paper} evidence={evidence} evidenceRoute={evidenceRoute} />
          </ArtifactView>
          <ArtifactView
            title="Extraction"
            info="Capture method, prompting, evaluation, and synthesis notes with evidence-backed locators."
            storageKey="review-workspace:extraction"
          >
            <ExtractionForm paper={paper} evidence={evidence} evidenceRoute={evidenceRoute} />
          </ArtifactView>
          <ArtifactView
            title="Review material"
            info="Export this paper's screening, extraction, and evidence chain as a markdown review packet."
            storageKey="review-workspace:review-material"
          >
            <ReviewMaterialExport paper={paper} />
          </ArtifactView>
          <ArtifactView
            title="Evidence attached"
            info="Shows how many evidence packets are ready to use in Ask, screening, extraction, and export."
            storageKey="review-workspace:evidence-attached"
          >
            {evidence.length === 0 ? "No evidence selected." : `${evidence.length} evidence item(s) ready.`}
          </ArtifactView>
        </WorkspaceGroup>
      </div>
    </aside>
  );
}

function WorkspaceGroup({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section role="region" aria-label={title} className="workspace-group">
      <h3 className="workspace-group-title">{title}</h3>
      <div className="workspace-stack">{children}</div>
    </section>
  );
}
