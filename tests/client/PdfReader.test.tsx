import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfReader } from "@/components/PdfReader";

const pdfMocks = vi.hoisted(() => ({
  destroy: vi.fn(),
  getDocument: vi.fn(),
  getPage: vi.fn(),
  getTextContent: vi.fn(),
  render: vi.fn()
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => {
  class TextLayer {
    container: HTMLElement;

    constructor({ container }: { container: HTMLElement }) {
      this.container = container;
    }

    render() {
      const span = document.createElement("span");
      span.textContent = "Alpha extraction text. Second line.";
      this.container.append(span);
      return Promise.resolve();
    }

    cancel() {}
  }

  return {
    GlobalWorkerOptions: {},
    getDocument: pdfMocks.getDocument,
    TextLayer
  };
});

describe("PdfReader", () => {
  beforeEach(() => {
    pdfMocks.destroy.mockReset();
    pdfMocks.getDocument.mockReset();
    pdfMocks.getPage.mockReset();
    pdfMocks.getTextContent.mockReset();
    pdfMocks.render.mockReset();
    pdfMocks.render.mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() });
    pdfMocks.getTextContent.mockResolvedValue({ items: [], styles: {} });
    pdfMocks.getPage.mockResolvedValue({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale,
        rotation: 0,
        rawDims: {
          pageWidth: 600,
          pageHeight: 800,
          pageX: 0,
          pageY: 0
        }
      }),
      getTextContent: pdfMocks.getTextContent,
      render: pdfMocks.render
    });
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: pdfMocks.getPage,
        destroy: pdfMocks.destroy
      })
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the available reader height for a selectable rendered PDF page", async () => {
    render(
      <PdfReader
        recordId="FT0001"
        pdfUrl="/api/papers/FT0001/pdf"
        sourcePath="/sample/FT0001.pdf"
        onEvidence={vi.fn()}
      />
    );

    expect(screen.getByLabelText("PDF reader panel")).toHaveClass("h-full");
    expect(screen.getByLabelText("PDF reader panel")).toHaveClass("min-h-0");
    expect(await screen.findByRole("article", { name: "Rendered PDF page" })).toHaveClass(
      "pdf-reader-surface"
    );
    expect(screen.getByLabelText("PDF page canvas").closest(".pdf-page")).not.toBeNull();
    expect(await screen.findByText("Alpha extraction text. Second line.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Extracted PDF page text")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use selected PDF text" })).not.toBeInTheDocument();
    expect(pdfMocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: "/api/papers/FT0001/pdf" }));
  });

  it("moves between PDF pages with previous and next controls", async () => {
    render(
      <PdfReader
        recordId="FT0001"
        pdfUrl="/api/papers/FT0001/pdf"
        sourcePath="/sample/FT0001.pdf"
        onEvidence={vi.fn()}
      />
    );

    expect(await screen.findByText("Page 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous PDF page" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next PDF page" }));

    expect(await screen.findByText("Page 2 / 3")).toBeInTheDocument();
    await waitFor(() => expect(pdfMocks.getPage).toHaveBeenCalledWith(2));
  });

  it("opens an inline question box for selected PDF text and saves it as evidence", async () => {
    const onEvidence = vi.fn();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        answer: {
          recordId: "FT0001",
          payloadScope: "Selection",
          answer: "The selected PDF passage describes the evaluation workflow.",
          evidenceUsed: ["PDF p.1"],
          warnings: []
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PdfReader
        recordId="FT0001"
        pdfUrl="/api/papers/FT0001/pdf"
        sourcePath="/sample/FT0001.pdf"
        onEvidence={onEvidence}
      />
    );

    const selectedText = await screen.findByText("Alpha extraction text. Second line.");
    vi.spyOn(
      screen.getByRole("article", { name: "Rendered PDF page" }),
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
      anchorNode: selectedText.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 120, top: 160, width: 90, height: 18 })
      }),
      toString: () => "Alpha extraction text"
    } as unknown as Selection);

    fireEvent.mouseUp(selectedText);

    const dialog = screen.getByRole("dialog", { name: "Ask about selected text" });
    expect(dialog).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Question about selection"),
      "What does this say about evaluation?"
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ask selection" })).toBeEnabled()
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask selection" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/papers/FT0001/ask",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toEqual(
      expect.objectContaining({
        question: "What does this say about evaluation?",
        payloadScope: "Selection",
        evidence: [
          expect.objectContaining({
            recordId: "FT0001",
            sourceFormat: "pdf",
            sourcePath: "/sample/FT0001.pdf",
            evidenceLocator: "PDF p.1",
            quoteSnippet: "Alpha extraction text",
            headingPath: null,
            pageNumber: 1
          })
        ]
      })
    );
    expect(
      await screen.findByText("The selected PDF passage describes the evaluation workflow.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save evidence" }));

    expect(onEvidence).toHaveBeenCalledWith({
      recordId: "FT0001",
      sourceFormat: "pdf",
      sourcePath: "/sample/FT0001.pdf",
      evidenceLocator: "PDF p.1",
      quoteSnippet: "Alpha extraction text",
      headingPath: null,
      pageNumber: 1,
      reviewerNote: "",
      pdfVerificationNote: ""
    });
  });

  it("translates selected PDF text with the default OPUS-MT provider", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ translation: "研究人员评估了该工具。", provider: "opus" })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PdfReader
        recordId="FT0001"
        pdfUrl="/api/papers/FT0001/pdf"
        sourcePath="/sample/FT0001.pdf"
        onEvidence={vi.fn()}
      />
    );

    const selectedText = await screen.findByText("Alpha extraction text. Second line.");
    vi.spyOn(
      screen.getByRole("article", { name: "Rendered PDF page" }),
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
      anchorNode: selectedText.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 120, top: 160, width: 90, height: 18 })
      }),
      toString: () => "The researchers evaluated the tool."
    } as unknown as Selection);

    fireEvent.mouseUp(selectedText);
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

  it("keeps the PDF selection popup visible when selected text is near the viewport bottom", async () => {
    render(
      <PdfReader
        recordId="FT0001"
        pdfUrl="/api/papers/FT0001/pdf"
        sourcePath="/sample/FT0001.pdf"
        onEvidence={vi.fn()}
      />
    );

    const selectedText = await screen.findByText("Alpha extraction text. Second line.");
    const article = screen.getByRole("article", { name: "Rendered PDF page" });
    Object.defineProperty(article, "clientWidth", { configurable: true, value: 720 });
    Object.defineProperty(article, "clientHeight", { configurable: true, value: 540 });
    Object.defineProperty(article, "scrollTop", { configurable: true, value: 1000 });
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
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: selectedText.firstChild,
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ left: 160, top: 600, width: 90, height: 18 })
      }),
      toString: () => "Alpha extraction text"
    } as unknown as Selection);

    fireEvent.mouseUp(selectedText);

    expect(screen.getByRole("dialog", { name: "Ask about selected text" })).toHaveStyle({
      left: "125px",
      top: "1230px"
    });
  });
});
