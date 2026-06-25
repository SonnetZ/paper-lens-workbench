import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EvidencePacket, EvidenceRouteEvent, PaperListItem } from "@/lib/types";
import { ScreeningForm } from "@/components/ScreeningForm";

const paper: PaperListItem = {
  recordId: "FT0001",
  title: "Sample AI-assisted interview analysis",
  firstAuthor: "Rivera",
  year: "2026",
  sourceFilename: "FT0001_sample.md",
  sourcePath: "FT0001_sample.md",
  decision: "",
  reviewStatus: "unreviewed",
  hasMarkdown: true,
  hasPdf: false,
  markdownPath: "/sample/FT0001_sample.md",
  pdfPath: null,
  methodItemCount: 0,
  promptItemCount: 0,
  evaluationItemCount: 0
};

const evidence: EvidencePacket[] = [
  {
    id: "draft_1",
    recordId: "FT0001",
    sourceFormat: "markdown",
    sourcePath: "/sample/FT0001_sample.md",
    evidenceLocator: "Methods > paragraph 2",
    quoteSnippet: "Human reviewers revised the codebook after LLM suggestions.",
    headingPath: "Methods",
    pageNumber: null,
    reviewerNote: "Good eligibility support.",
    pdfVerificationNote: "",
    createdAt: "2026-06-23T00:00:00.000Z"
  }
];

describe("ScreeningForm", () => {
  it("attaches selected evidence and saves screening data", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init) {
        return Response.json({
          screening: {
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
          }
        });
      }
      return Response.json({ screening: JSON.parse(String(init.body)) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ScreeningForm paper={paper} evidence={evidence} />);

    await userEvent.selectOptions(await screen.findByLabelText("Decision"), "include");
    expect(screen.getByText("Human decision: include")).toBeInTheDocument();
    expect(screen.getByLabelText("Review status")).toHaveValue("screened");
    await userEvent.click(screen.getByRole("button", { name: "Attach latest evidence" }));
    await userEvent.type(screen.getByLabelText("Reviewer"), "YZ");
    await userEvent.click(screen.getByRole("button", { name: "Save screening" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const saveCall = fetchMock.mock.calls[1];
    expect(saveCall[0]).toBe("/api/papers/FT0001/screening");
    expect(saveCall[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(saveCall[1]?.body))).toMatchObject({
      decision: "include",
      eligibilityRationale: expect.stringContaining("Human reviewers revised the codebook"),
      evidenceLocator: "Methods > paragraph 2",
      reviewStatus: "screened",
      reviewer: "YZ"
    });
    expect(await screen.findByText("Screening saved")).toBeInTheDocument();
  });

  it("shows when a saved model-assisted decision still needs human review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          screening: {
            recordId: "FT0001",
            decision: "include",
            primaryExclusionReason: "",
            eligibilityRationale: "Model-assisted inclusion rationale.",
            typologyRelevanceNotes: "",
            evaluationRelevanceNotes: "",
            promptingPracticesNotes: "",
            evidenceLocator: "Abstract",
            reviewStatus: "needs_human_check",
            secondReviewReason: "Full-text human verification still required.",
            reviewer: "Codex workflow test",
            reviewDate: "2026-06-24"
          }
        })
      )
    );

    render(<ScreeningForm paper={paper} evidence={[]} />);

    expect(await screen.findByText("Human decision: include")).toBeInTheDocument();
    expect(screen.getByText("Status: needs_human_check")).toBeInTheDocument();
    expect(screen.getByText("Reviewer: Codex workflow test")).toBeInTheDocument();
    expect(screen.getByText("Full-text human verification still required.")).toBeInTheDocument();
  });

  it("keeps routed evidence when the initial screening load finishes afterward", async () => {
    const initialLoad = deferred<Response>();
    const fetchMock = vi.fn(async () => initialLoad.promise);
    vi.stubGlobal("fetch", fetchMock);
    const evidenceRoute: EvidenceRouteEvent = {
      routeId: 1,
      evidence: evidence[0],
      target: "screening.evaluationRelevanceNotes"
    };

    render(<ScreeningForm paper={paper} evidence={[]} evidenceRoute={evidenceRoute} />);

    await waitFor(() =>
      expect(screen.getByLabelText("Evaluation relevance notes")).toHaveValue(
        "Methods > paragraph 2: Human reviewers revised the codebook after LLM suggestions."
      )
    );

    initialLoad.resolve(
      Response.json({
        screening: {
          recordId: "FT0001",
          decision: "maybe",
          primaryExclusionReason: "",
          eligibilityRationale: "Loaded eligibility note.",
          typologyRelevanceNotes: "",
          evaluationRelevanceNotes: "",
          promptingPracticesNotes: "",
          evidenceLocator: "",
          reviewStatus: "unreviewed",
          secondReviewReason: "",
          reviewer: "",
          reviewDate: ""
        }
      })
    );

    await waitFor(() => expect(screen.getByLabelText("Decision")).toHaveValue("maybe"));
    expect(screen.getByLabelText("Eligibility rationale")).toHaveValue("Loaded eligibility note.");
    expect(screen.getByLabelText("Evaluation relevance notes")).toHaveValue(
      "Methods > paragraph 2: Human reviewers revised the codebook after LLM suggestions."
    );
    expect(screen.getByLabelText("Screening evidence locator")).toHaveValue(
      "Methods > paragraph 2"
    );
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
