import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EvidencePacket, EvidenceRouteEvent, PaperListItem } from "@/lib/types";
import { ExtractionForm } from "@/components/ExtractionForm";

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
    id: "ev_1",
    recordId: "FT0001",
    sourceFormat: "markdown",
    sourcePath: "/sample/FT0001_sample.md",
    evidenceLocator: "Evaluation > paragraph 1",
    quoteSnippet: "The authors compared model-suggested codes with human reviewer notes.",
    headingPath: "Evaluation",
    pageNumber: null,
    reviewerNote: "",
    pdfVerificationNote: "",
    createdAt: "2026-06-23T00:00:00.000Z"
  }
];

describe("ExtractionForm", () => {
  it("loads an extraction draft, attaches latest evidence, and saves", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init) {
        return Response.json({
          extraction: {
            recordId: "FT0001",
            methodTypology: "Human-in-the-loop codebook refinement.",
            promptingPractices: "",
            evaluationPractices: "",
            synthesisNote: "",
            evidenceLocator: "",
            updatedAt: ""
          }
        });
      }
      return Response.json({
        extraction: {
          recordId: "FT0001",
          ...JSON.parse(String(init.body)),
          updatedAt: "2026-06-23T00:00:00.000Z"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExtractionForm paper={paper} evidence={evidence} />);

    expect(await screen.findByDisplayValue("Human-in-the-loop codebook refinement.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Attach evidence to"), "evaluationPractices");
    await userEvent.click(screen.getByRole("button", { name: "Attach latest evidence" }));
    await userEvent.type(screen.getByLabelText("Synthesis note"), "Useful for evaluation synthesis.");
    await userEvent.click(screen.getByRole("button", { name: "Save extraction" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const saveCall = fetchMock.mock.calls[1];
    expect(saveCall[0]).toBe("/api/papers/FT0001/extraction");
    expect(saveCall[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(saveCall[1]?.body))).toMatchObject({
      methodTypology: "Human-in-the-loop codebook refinement.",
      evaluationPractices: expect.stringContaining(
        "The authors compared model-suggested codes with human reviewer notes."
      ),
      evidenceLocator: "Evaluation > paragraph 1",
      synthesisNote: "Useful for evaluation synthesis."
    });
    expect(await screen.findByText("Extraction saved")).toBeInTheDocument();
  });

  it("keeps routed evidence when the initial extraction load finishes afterward", async () => {
    const initialLoad = deferred<Response>();
    const fetchMock = vi.fn(async () => initialLoad.promise);
    vi.stubGlobal("fetch", fetchMock);
    const evidenceRoute: EvidenceRouteEvent = {
      routeId: 1,
      evidence: evidence[0],
      target: "extraction.evaluationPractices"
    };

    render(<ExtractionForm paper={paper} evidence={[]} evidenceRoute={evidenceRoute} />);

    await waitFor(() =>
      expect(screen.getByLabelText("Evaluation practices")).toHaveValue(
        "Evaluation > paragraph 1: The authors compared model-suggested codes with human reviewer notes."
      )
    );

    initialLoad.resolve(
      Response.json({
        extraction: {
          recordId: "FT0001",
          methodTypology: "Loaded method draft.",
          promptingPractices: "",
          evaluationPractices: "",
          synthesisNote: "",
          evidenceLocator: "",
          updatedAt: ""
        }
      })
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Method typology")).toHaveValue("Loaded method draft.")
    );
    expect(screen.getByLabelText("Evaluation practices")).toHaveValue(
      "Evaluation > paragraph 1: The authors compared model-suggested codes with human reviewer notes."
    );
    expect(screen.getByLabelText("Extraction evidence locator")).toHaveValue(
      "Evaluation > paragraph 1"
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
