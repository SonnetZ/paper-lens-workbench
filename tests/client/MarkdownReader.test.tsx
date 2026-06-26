import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MarkdownReader } from "@/components/MarkdownReader";

describe("MarkdownReader", () => {
  it("renders markdown as a readable article with headings, lists, code, and tables", () => {
    const onEvidence = vi.fn();

    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={[
          "# Title",
          "",
          "## Methods",
          "",
          "A paragraph with `codebook` detail.",
          "",
          "- First observation",
          "- Second observation",
          "",
          "| Dimension | Evidence |",
          "| --- | --- |",
          "| Prompting | Reported prompt text |",
          "",
          "> Human oversight was retained.",
          "",
          "[Appendix](https://example.test/appendix)",
          "",
          "![Figure 1](https://example.test/figure.png)"
        ].join("\n")}
        onEvidence={onEvidence}
      />
    );

    const article = screen.getByRole("article", { name: "Rendered markdown paper" });
    expect(article).toHaveClass("markdown-paper");
    expect(screen.getByRole("heading", { name: "Title", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Methods", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("First observation")).toBeInTheDocument();
    expect(screen.getByText("codebook")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appendix" })).toHaveAttribute(
      "href",
      "https://example.test/appendix"
    );
    expect(screen.getByRole("img", { name: "Figure 1" })).toHaveAttribute(
      "src",
      "https://example.test/figure.png"
    );
  });

  it("does not render a redundant markdown toolbar", () => {
    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={"# Title\n\n## Methods\n\nHuman reviewers revised the codebook."}
        onEvidence={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Save selection" })).not.toBeInTheDocument();
  });

  it("uses the selected paragraph heading as the evidence locator", async () => {
    const onEvidence = vi.fn();

    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={[
          "# Title",
          "",
          "## Methods",
          "",
          "Human reviewers revised the codebook.",
          "",
          "## Evaluation",
          "",
          "The authors compared model-suggested codes with human reviewer notes."
        ].join("\n")}
        onEvidence={onEvidence}
      />
    );

    const selectedParagraph = screen.getByText(
      "The authors compared model-suggested codes with human reviewer notes."
    );
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: selectedParagraph.firstChild,
      toString: () => "model-suggested codes"
    } as Selection);

    fireEvent.mouseUp(screen.getByRole("article", { name: "Rendered markdown paper" }));
    await userEvent.click(screen.getByRole("button", { name: "Save evidence" }));

    expect(onEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceLocator: "Evaluation",
        headingPath: "Evaluation",
        quoteSnippet: "model-suggested codes"
      })
    );
  });

  it("opens an inline question box for selected markdown text and asks with scoped evidence", async () => {
    const onEvidence = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        answer: {
          recordId: "FT0001",
          payloadScope: "Selection",
          answer: "The passage describes human checking after AI coding.",
          evidenceUsed: ["Evaluation"],
          warnings: []
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={[
          "# Title",
          "",
          "## Evaluation",
          "",
          "The authors compared model-suggested codes with human reviewer notes."
        ].join("\n")}
        onEvidence={onEvidence}
      />
    );

    const selectedParagraph = screen.getByText(
      "The authors compared model-suggested codes with human reviewer notes."
    );
    vi.spyOn(
      screen.getByRole("article", { name: "Rendered markdown paper" }),
      "getBoundingClientRect"
    ).mockReturnValue({
      left: 80,
      top: 100,
      width: 720,
      height: 540,
      right: 800,
      bottom: 640,
      x: 80,
      y: 100,
      toJSON: () => ({})
    } as DOMRect);
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: selectedParagraph.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 120, top: 160, width: 90, height: 18 })
      }),
      toString: () => "model-suggested codes"
    } as unknown as Selection);

    fireEvent.mouseUp(screen.getByRole("article", { name: "Rendered markdown paper" }));

    const dialog = screen.getByRole("dialog", { name: "Ask about selected text" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveStyle({ left: "85px", top: "88px" });
    await userEvent.type(
      screen.getByLabelText("Question about selection"),
      "What does this imply for validation?"
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask selection" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/papers/FT0001/ask",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.body).toBeTypeOf("string");
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody).toEqual(
      expect.objectContaining({
        question: "What does this imply for validation?",
        payloadScope: "Selection",
        evidence: [
          expect.objectContaining({
            recordId: "FT0001",
            sourceFormat: "markdown",
            sourcePath: "/paper.md",
            evidenceLocator: "Evaluation",
            quoteSnippet: "model-suggested codes",
            headingPath: "Evaluation"
          })
        ]
      })
    );
    expect(
      await screen.findByText("The passage describes human checking after AI coding.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save evidence" }));
    expect(onEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceLocator: "Evaluation",
        quoteSnippet: "model-suggested codes"
      })
    );
  });

  it("translates selected markdown text with the default OPUS-MT provider", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ translation: "研究人员评估了该工具。", provider: "opus" })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={"# Title\n\n## Methods\n\nThe researchers evaluated the tool."}
        onEvidence={vi.fn()}
      />
    );

    const selectedParagraph = screen.getByText("The researchers evaluated the tool.");
    vi.spyOn(
      screen.getByRole("article", { name: "Rendered markdown paper" }),
      "getBoundingClientRect"
    ).mockReturnValue({
      left: 80,
      top: 100,
      width: 720,
      height: 540,
      right: 800,
      bottom: 640,
      x: 80,
      y: 100,
      toJSON: () => ({})
    } as DOMRect);
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: selectedParagraph.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 120, top: 160, width: 90, height: 18 })
      }),
      toString: () => "The researchers evaluated the tool."
    } as unknown as Selection);

    fireEvent.mouseUp(screen.getByRole("article", { name: "Rendered markdown paper" }));
    await userEvent.click(screen.getByRole("button", { name: "Translate selection" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/translate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        text: "The researchers evaluated the tool.",
        provider: "opus"
      })
    );
    expect(await screen.findByText("研究人员评估了该工具。")).toBeInTheDocument();
  });

  it("copies selected markdown text from the selection assistant", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={"# Title\n\n## Methods\n\nThe researchers evaluated the tool."}
        onEvidence={vi.fn()}
      />
    );

    const selectedParagraph = screen.getByText("The researchers evaluated the tool.");
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: selectedParagraph.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 120, top: 160, width: 90, height: 18 })
      }),
      toString: () => "researchers evaluated"
    } as unknown as Selection);

    fireEvent.mouseUp(screen.getByRole("article", { name: "Rendered markdown paper" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy selected text" }));

    expect(writeText).toHaveBeenCalledWith("researchers evaluated");
  });

  it("anchors the selection popup to the selected text inside a scrolled markdown page", () => {
    render(
      <MarkdownReader
        recordId="FT0001"
        sourcePath="/paper.md"
        markdown={"# Title\n\n## Methods\n\nThe researchers evaluated the tool."}
        onEvidence={vi.fn()}
      />
    );

    const article = screen.getByRole("article", { name: "Rendered markdown paper" });
    Object.defineProperty(article, "clientWidth", { configurable: true, value: 720 });
    Object.defineProperty(article, "clientHeight", { configurable: true, value: 540 });
    Object.defineProperty(article, "scrollTop", { configurable: true, value: 900 });
    Object.defineProperty(article, "scrollLeft", { configurable: true, value: 0 });
    vi.spyOn(article, "getBoundingClientRect").mockReturnValue({
      left: 80,
      top: 100,
      width: 720,
      height: 540,
      right: 800,
      bottom: 640,
      x: 80,
      y: 100,
      toJSON: () => ({})
    } as DOMRect);
    const selectedParagraph = screen.getByText("The researchers evaluated the tool.");
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: selectedParagraph.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 160, top: 180, width: 90, height: 18 })
      }),
      toString: () => "researchers evaluated"
    } as unknown as Selection);

    fireEvent.mouseUp(article);

    const dialog = screen.getByRole("dialog", { name: "Ask about selected text" });
    expect(article).toContainElement(dialog);
    expect(dialog).toHaveStyle({ left: "125px", top: "1008px" });
  });
});
