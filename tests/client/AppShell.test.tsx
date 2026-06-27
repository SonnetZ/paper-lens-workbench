import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EvidencePacket, PaperListItem } from "@/lib/types";
import { AppShell } from "@/components/AppShell";

const papers: PaperListItem[] = [
  {
    recordId: "FT0001",
    title: "Sample AI-assisted interview analysis",
    firstAuthor: "Rivera",
    year: "2026",
    sourceFilename: "FT0001_sample.md",
    sourcePath: "FT0001_sample.md",
    decision: "",
    reviewStatus: "unreviewed",
    hasMarkdown: false,
    hasPdf: false,
    markdownPath: null,
    pdfPath: null,
    methodItemCount: 0,
    promptItemCount: 0,
    evaluationItemCount: 0
  }
];

const savedEvidence: EvidencePacket = {
  id: "ev_saved",
  recordId: "FT0001",
  sourceFormat: "manual",
  sourcePath: null,
  evidenceLocator: "Persisted memo",
  quoteSnippet: "",
  headingPath: null,
  pageNumber: null,
  reviewerNote: "Already saved evidence for this paper.",
  pdfVerificationNote: "",
  createdAt: "2026-06-23T00:00:00.000Z"
};

describe("AppShell evidence persistence", () => {
  it("keeps the reading column viewport-height with a bounded evidence tray", () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [] });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    expect(screen.getByRole("main")).toHaveClass("lg:h-[100dvh]");
    expect(screen.getByRole("complementary", { name: "Paper queue" })).toHaveClass(
      "lg:h-[100dvh]"
    );
    expect(screen.getByLabelText("Reading column")).toHaveClass("lg:h-[100dvh]");
    expect(screen.getByLabelText("Reading column")).toHaveClass(
      "grid-rows-[minmax(0,1fr)_auto]"
    );
    expect(screen.getByRole("complementary", { name: "Review workspace" })).toHaveClass(
      "lg:h-[100dvh]"
    );
    expect(screen.getByRole("complementary", { name: "Evidence tray" })).toHaveClass(
      "evidence-tray-expanded"
    );
  });

  it("can collapse and expand the paper list", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [] });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    await userEvent.click(screen.getByRole("button", { name: "Collapse paper list" }));
    expect(screen.getByRole("button", { name: "Expand paper list" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand paper list" }));
    expect(screen.getByRole("button", { name: "Collapse paper list" })).toBeInTheDocument();
  });

  it("can collapse and expand the review workspace", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [] });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    await userEvent.click(screen.getByRole("button", { name: "Collapse review workspace" }));
    expect(screen.getByRole("button", { name: "Expand review workspace" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("lg:grid-cols-[300px_minmax(0,1fr)_44px]");

    await userEvent.click(screen.getByRole("button", { name: "Expand review workspace" }));
    expect(screen.getByRole("button", { name: "Collapse review workspace" })).toBeInTheDocument();
  });

  it("loads persisted evidence for the selected paper", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [savedEvidence] });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    expect(await screen.findByText("Persisted memo")).toBeInTheDocument();
    expect(screen.getByText("1 evidence item(s) ready.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/evidence?recordId=FT0001");
  });

  it("saves manual evidence through the evidence API before showing it as attached", async () => {
    const createdEvidence: EvidencePacket = {
      ...savedEvidence,
      id: "ev_created",
      evidenceLocator: "Reviewer memo",
      reviewerNote: "Manual judgement from this reading pass."
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [] });
      }
      if (url === "/api/evidence" && init?.method === "POST") {
        return Response.json({ evidence: createdEvidence }, { status: 201 });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    await userEvent.type(
      screen.getByLabelText("Reviewer note"),
      "Manual judgement from this reading pass."
    );
    const locator = screen.getByLabelText("Note locator");
    await userEvent.clear(locator);
    await userEvent.type(locator, "Reviewer memo");
    await userEvent.click(screen.getByRole("button", { name: "Add note as evidence" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/evidence",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String)
        })
      );
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/evidence" && init?.method === "POST"
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      recordId: "FT0001",
      sourceFormat: "manual",
      evidenceLocator: "Reviewer memo",
      reviewerNote: "Manual judgement from this reading pass."
    });

    const tray = screen.getByRole("complementary", { name: "Evidence tray" });
    expect(await within(tray).findByText("Reviewer memo")).toBeInTheDocument();
    expect(screen.getByText("1 evidence item(s) ready.")).toBeInTheDocument();
  });

  it("routes a tray evidence packet into an extraction draft field", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [savedEvidence] });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    expect(await screen.findByText("Persisted memo")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Target field 1: Persisted memo"),
      "extraction.evaluationPractices"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send evidence to field" }));

    expect(screen.getByLabelText("Evaluation practices")).toHaveValue(
      "Persisted memo: Already saved evidence for this paper."
    );
    expect(screen.getByLabelText("Extraction evidence locator")).toHaveValue("Persisted memo");
  });

  it("saves a PDF verification note through the evidence API", async () => {
    const updatedEvidence: EvidencePacket = {
      ...savedEvidence,
      pdfVerificationNote: "Verified in PDF p. 4; figure caption checked."
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/evidence?recordId=FT0001") {
        return Response.json({ evidence: [savedEvidence] });
      }
      if (url === "/api/evidence" && init?.method === "PATCH") {
        return Response.json({ evidence: updatedEvidence });
      }
      if (url === "/api/papers/FT0001/screening") {
        return Response.json({ screening: screeningRow() });
      }
      if (url === "/api/papers/FT0001/extraction") {
        return Response.json({ extraction: extractionArtifact() });
      }
      return Response.json({ content: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell initialPapers={papers} />);

    expect(await screen.findByText("Persisted memo")).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("PDF verification note 1: Persisted memo"),
      "Verified in PDF p. 4; figure caption checked."
    );
    await userEvent.click(screen.getByRole("button", { name: "Save PDF verification note" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/evidence",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId: "ev_saved",
            pdfVerificationNote: "Verified in PDF p. 4; figure caption checked."
          })
        })
      )
    );
    expect(await screen.findByText("Verified in PDF p. 4; figure caption checked.")).toBeInTheDocument();
  });
});

function screeningRow() {
  return {
    recordId: "FT0001",
    decision: "",
    primaryExclusionReason: "",
    eligibilityRationale: "",
    typologyRelevanceNotes: "",
    evaluationRelevanceNotes: "",
    promptingPracticesNotes: "",
    evidenceLocator: "",
    reviewStatus: "unreviewed",
    secondReviewReason: "",
    reviewer: "",
    reviewDate: ""
  };
}

function extractionArtifact() {
  return {
    recordId: "FT0001",
    methodTypology: "",
    promptingPractices: "",
    evaluationPractices: "",
    synthesisNote: "",
    evidenceLocator: "",
    updatedAt: ""
  };
}
