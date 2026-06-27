"use client";

import { CaretDown, CaretLeft, CaretRight, CaretUp } from "@phosphor-icons/react";
import { useState } from "react";
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

type WorkspaceMode = "Assist" | "Evidence" | "Review";

const workspaceModes: Array<{
  value: WorkspaceMode;
  summary: string;
}> = [
  { value: "Assist", summary: "Ask, brief, and search while reading." },
  { value: "Evidence", summary: "Check saved packets and corpus context." },
  { value: "Review", summary: "Write screening and extraction fields." }
];

export function ReviewWorkspace({
  paper,
  evidence,
  evidenceRoute,
  modelSettings,
  onModelSettingsChange,
  knowledgeBaseId = "default",
  onKnowledgeBaseChange,
  collapsed = false,
  onCollapsedChange
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  evidenceRoute?: EvidenceRouteEvent | null;
  modelSettings: RuntimeModelSettings;
  onModelSettingsChange: (settings: RuntimeModelSettings) => void;
  knowledgeBaseId?: string;
  onKnowledgeBaseChange?: (knowledgeBaseId: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("Assist");

  if (collapsed) {
    return (
      <aside aria-label="Review workspace" className="review-workspace-collapsed">
        <button
          type="button"
          aria-label="Expand review workspace"
          onClick={() => onCollapsedChange?.(false)}
          className="review-workspace-collapse-button"
        >
          <CaretDown aria-hidden="true" weight="bold" className="size-4 lg:hidden" />
          <CaretLeft aria-hidden="true" weight="bold" className="hidden size-4 lg:block" />
          <span className="review-workspace-collapsed-label">Workspace</span>
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label="Review workspace" className="review-workspace-panel lg:h-[100dvh]">
      <header className="review-workspace-header">
        <div className="min-w-0">
          <p className="review-workspace-kicker">Workspace</p>
          <h2 className="review-workspace-title">{paper?.recordId ?? "No record"}</h2>
          <p className="review-workspace-summary">
            {workspaceModes.find((mode) => mode.value === activeMode)?.summary}
          </p>
        </div>
        <button
          type="button"
          aria-label="Collapse review workspace"
          onClick={() => onCollapsedChange?.(true)}
          className="workbench-icon-button workbench-icon-button-sm"
        >
          <CaretUp aria-hidden="true" weight="bold" className="size-3.5 lg:hidden" />
          <CaretRight aria-hidden="true" weight="bold" className="hidden size-3.5 lg:block" />
        </button>
      </header>
      <div className="workspace-mode-tabs" role="tablist" aria-label="Workspace task modes">
        {workspaceModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={activeMode === mode.value}
            onClick={() => setActiveMode(mode.value)}
            className="workspace-mode-tab"
          >
            {mode.value}
          </button>
        ))}
      </div>

      {activeMode === "Assist" ? (
        <WorkspaceModePanel label="Assist tools">
          <ArtifactView
            title="Model source"
            info="Choose Local or Online for Ask, translation, and model-assisted helpers. Click a source to open its settings."
            storageKey="review-workspace:model-source"
          >
            <ModelSourceControl value={modelSettings} onChange={onModelSettingsChange} />
          </ArtifactView>

          <ArtifactView
            title="Ask"
            info="Ask a question from attached evidence or from the local knowledge base. It will not send the full paper."
            storageKey="review-workspace:ask"
          >
            <AskPanel
              paper={paper}
              evidence={evidence}
              modelSettings={modelSettings}
              knowledgeBaseId={knowledgeBaseId}
            />
          </ArtifactView>
          <ArtifactView
            title="Brief"
            info="Generate a quick navigation brief: suggested decision, rationale, and sections to read first. Treat it as a draft."
            storageKey="review-workspace:brief"
          >
            <BriefPanel paper={paper} />
          </ArtifactView>

          <ArtifactView
            title="Knowledge base"
            info="Select a knowledge base and search its contents. All review knowledge operations use the selected base."
            storageKey="review-workspace:knowledge-base"
          >
            <KnowledgeBasePanel
              paper={paper}
              selectedKnowledgeBaseId={knowledgeBaseId}
              onKnowledgeBaseChange={onKnowledgeBaseChange}
            />
          </ArtifactView>
        </WorkspaceModePanel>
      ) : null}

      {activeMode === "Evidence" ? (
        <WorkspaceModePanel label="Evidence tools">
          <ArtifactView
            title="Evidence attached"
            info="Shows how many evidence packets are ready to use in Ask, screening, extraction, and export."
            storageKey="review-workspace:evidence-attached"
            defaultOpen
          >
            <div className="workspace-evidence-meter">
              <strong>{evidence.length}</strong>
              <span>{evidence.length === 1 ? "packet ready" : "packets ready"}</span>
            </div>
            {evidence.length === 0 ? (
              <p className="workspace-empty-line">Select text in MD or PDF to add evidence.</p>
            ) : (
              <ol className="workspace-evidence-list">
                {evidence.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <span>{item.evidenceLocator}</span>
                    <small>{item.sourceFormat}</small>
                  </li>
                ))}
              </ol>
            )}
          </ArtifactView>
          <ArtifactView
            title="Knowledge base"
            info="Select a knowledge base and search its contents. All review knowledge operations use the selected base."
            storageKey="review-workspace:evidence-knowledge-base"
          >
            <KnowledgeBasePanel
              paper={paper}
              selectedKnowledgeBaseId={knowledgeBaseId}
              onKnowledgeBaseChange={onKnowledgeBaseChange}
            />
          </ArtifactView>
        </WorkspaceModePanel>
      ) : null}

      {activeMode === "Review" ? (
        <WorkspaceModePanel label="Review tools">
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
        </WorkspaceModePanel>
      ) : null}
    </aside>
  );
}

function WorkspaceModePanel({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section role="tabpanel" aria-label={label} className="workspace-mode-panel">
      <div className="workspace-stack">{children}</div>
    </section>
  );
}
