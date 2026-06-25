import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EvidencePacket } from "@/lib/types";
import { EvidenceTray } from "@/components/EvidenceTray";

const savedEvidence: EvidencePacket = {
  id: "ev_1",
  recordId: "FT0001",
  sourceFormat: "markdown",
  sourcePath: "/paper.md",
  evidenceLocator: "Evaluation",
  quoteSnippet: "The authors compared model-suggested codes with human reviewer notes.",
  headingPath: "Evaluation",
  pageNumber: null,
  reviewerNote: "",
  pdfVerificationNote: "",
  createdAt: "2026-06-23T00:00:00.000Z"
};

describe("EvidenceTray", () => {
  it("creates manual evidence from a reviewer note", async () => {
    const onManualEvidence = vi.fn();

    render(
      <EvidenceTray
        recordId="FT0001"
        evidence={[]}
        onManualEvidence={onManualEvidence}
      />
    );

    await userEvent.type(
      screen.getByLabelText("Reviewer note"),
      "The paper fits because it evaluates LLM-supported qualitative coding."
    );
    const locator = screen.getByLabelText("Note locator");
    await userEvent.clear(locator);
    await userEvent.type(locator, "Reviewer memo");
    await userEvent.click(screen.getByRole("button", { name: "Add note as evidence" }));

    expect(onManualEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "FT0001",
        sourceFormat: "manual",
        sourcePath: null,
        evidenceLocator: "Reviewer memo",
        quoteSnippet: "",
        headingPath: null,
        pageNumber: null,
        reviewerNote: "The paper fits because it evaluates LLM-supported qualitative coding.",
        pdfVerificationNote: ""
      })
    );
  });

  it("saves a PDF verification note for a saved evidence packet", async () => {
    const onPdfVerificationNote = vi.fn();

    render(
      <EvidenceTray
        recordId="FT0001"
        evidence={[savedEvidence]}
        onPdfVerificationNote={onPdfVerificationNote}
      />
    );

    await userEvent.type(
      screen.getByLabelText("PDF verification note 1: Evaluation"),
      "Verified in PDF p. 9; table formatting checked."
    );
    await userEvent.click(screen.getByRole("button", { name: "Save PDF verification note" }));

    expect(onPdfVerificationNote).toHaveBeenCalledWith(
      "ev_1",
      "Verified in PDF p. 9; table formatting checked."
    );
  });

  it("routes a saved evidence packet to a selected review field", async () => {
    const onRouteEvidence = vi.fn();

    render(
      <EvidenceTray
        recordId="FT0001"
        evidence={[savedEvidence]}
        onRouteEvidence={onRouteEvidence}
      />
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Target field 1: Evaluation"),
      "extraction.evaluationPractices"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send evidence to field" }));

    expect(onRouteEvidence).toHaveBeenCalledWith({
      evidence: savedEvidence,
      target: "extraction.evaluationPractices"
    });
  });

  it("gives repeated evidence locators distinct target controls", async () => {
    const onRouteEvidence = vi.fn();
    const repeatedEvidence = [
      savedEvidence,
      { ...savedEvidence, id: "ev_2", quoteSnippet: "A second note under the same locator." }
    ];

    render(
      <EvidenceTray
        recordId="FT0001"
        evidence={repeatedEvidence}
        onRouteEvidence={onRouteEvidence}
      />
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Target field 2: Evaluation"),
      "screening.evaluationRelevanceNotes"
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Send evidence to field" })[1]);

    expect(onRouteEvidence).toHaveBeenCalledWith({
      evidence: repeatedEvidence[1],
      target: "screening.evaluationRelevanceNotes"
    });
  });
});
