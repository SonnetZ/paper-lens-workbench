"use client";

import type {
  EvidencePacket,
  EvidenceRouteEvent,
  PaperListItem,
  RuntimeModelSettings
} from "@/lib/types";
import { AskPanel } from "@/components/AskPanel";
import { ArtifactView } from "@/components/ArtifactView";
import { ExtractionForm } from "@/components/ExtractionForm";
import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";
import { ModelSourceControl } from "@/components/ModelSourceControl";
import { PayloadScopeBanner } from "@/components/PayloadScopeBanner";
import { ReviewMaterialExport } from "@/components/ReviewMaterialExport";
import { ScreeningForm } from "@/components/ScreeningForm";

export function ReviewWorkspace({
  paper,
  evidence,
  evidenceRoute,
  modelSettings,
  onModelSettingsChange
}: {
  paper: PaperListItem | null;
  evidence: EvidencePacket[];
  evidenceRoute?: EvidenceRouteEvent | null;
  modelSettings: RuntimeModelSettings;
  onModelSettingsChange: (settings: RuntimeModelSettings) => void;
}) {
  return (
    <aside className="min-h-0 overflow-auto bg-swiss-wash">
      <header className="border-b border-swiss-rule bg-white px-4 py-3">
        <h2 className="text-sm font-semibold">Review workspace</h2>
        <p className="mt-1 font-mono text-xs text-swiss-muted">{paper?.recordId ?? "No record"}</p>
      </header>
      <div className="grid gap-5 p-4">
        <WorkspaceGroup title="Model">
          <ModelSourceControl value={modelSettings} onChange={onModelSettingsChange} />
          <PayloadScopeBanner scope="Selection" />
        </WorkspaceGroup>

        <WorkspaceGroup title="AI help">
          <ArtifactView title="Ask">
            <AskPanel paper={paper} evidence={evidence} modelSettings={modelSettings} />
          </ArtifactView>
          <ArtifactView title="Brief">
            Model-assisted briefs are draft navigation aids. They do not save review data.
          </ArtifactView>
        </WorkspaceGroup>

        <WorkspaceGroup title="Corpus">
          <ArtifactView title="Knowledge base">
            <KnowledgeBasePanel paper={paper} />
          </ArtifactView>
        </WorkspaceGroup>

        <WorkspaceGroup title="Human record">
          <ArtifactView title="Screening">
            <ScreeningForm paper={paper} evidence={evidence} evidenceRoute={evidenceRoute} />
          </ArtifactView>
          <ArtifactView title="Extraction">
            <ExtractionForm paper={paper} evidence={evidence} evidenceRoute={evidenceRoute} />
          </ArtifactView>
          <ArtifactView title="Review material">
            <ReviewMaterialExport paper={paper} />
          </ArtifactView>
          <ArtifactView title="Evidence attached">
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
