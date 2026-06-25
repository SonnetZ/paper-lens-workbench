import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CorpusSetup } from "@/components/CorpusSetup";

describe("CorpusSetup", () => {
  it("opens corpus setup as a dialog, saves paths, and reports synced screening rows", async () => {
    const onCorpusApplied = vi.fn();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/corpus-config" && !init) {
        return Response.json({
          config: {
            reviewDataDir: "/sample/review_data",
            paperMdDir: "/sample/papers_md",
            paperPdfDir: "/sample/papers_pdf",
            readerDbPath: "/sample/reader.sqlite",
            readerExportDir: "/sample/exports"
          },
          validation: {
            ok: true,
            issues: [],
            summary: {
              screeningCsv: true,
              controlledVocabularies: true,
              markdownFileCount: 1,
              pdfFileCount: 0,
              screeningRowCount: 0,
              addedScreeningRowCount: 0
            }
          }
        });
      }
      if (url === "/api/corpus-config" && init?.method === "PUT") {
        return Response.json({
          config: {
            reviewDataDir: "/real/review",
            paperMdDir: "/real/md",
            paperPdfDir: "/real/pdf",
            readerDbPath: "/sample/reader.sqlite",
            readerExportDir: "/sample/exports"
          },
          validation: {
            ok: true,
            issues: [],
            summary: {
              screeningCsv: true,
              controlledVocabularies: false,
              markdownFileCount: 42,
              pdfFileCount: 40,
              screeningRowCount: 42,
              addedScreeningRowCount: 41
            }
          }
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CorpusSetup onCorpusApplied={onCorpusApplied} />);

    expect(await screen.findByRole("button", { name: "Corpus setup" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("/sample/review_data")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Corpus setup" }));

    expect(await screen.findByDisplayValue("/sample/review_data")).toBeInTheDocument();
    await replaceValue("Review data folder", "/real/review");
    await replaceValue("Markdown papers folder", "/real/md");
    await replaceValue("PDF papers folder", "/real/pdf");
    await userEvent.click(screen.getByRole("button", { name: "Save corpus paths" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/corpus-config",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewDataDir: "/real/review",
            paperMdDir: "/real/md",
            paperPdfDir: "/real/pdf"
          })
        })
      )
    );
    expect(await screen.findByText("Corpus paths saved.")).toBeInTheDocument();
    expect(screen.getByText("42 Markdown files")).toBeInTheDocument();
    expect(screen.getByText("41 screening rows added")).toBeInTheDocument();
    expect(onCorpusApplied).toHaveBeenCalledTimes(1);
  });

  it("selects a corpus path from the local file tree", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/corpus-config" && !init) {
        return Response.json({
          config: {
            reviewDataDir: "/sample/review_data",
            paperMdDir: "/sample",
            paperPdfDir: "/sample/papers_pdf",
            readerDbPath: "/sample/reader.sqlite",
            readerExportDir: "/sample/exports"
          },
          validation: {
            ok: true,
            issues: [],
            summary: {
              screeningCsv: true,
              controlledVocabularies: true,
              markdownFileCount: 0,
              pdfFileCount: 0,
              screeningRowCount: 0,
              addedScreeningRowCount: 0
            }
          }
        });
      }
      if (String(url).startsWith("/api/file-browser")) {
        const requestedPath = new URL(`http://test.local${String(url)}`).searchParams.get("path");
        return Response.json({
          currentPath: requestedPath || "/sample",
          parentPath: "/",
          entries:
            requestedPath === "/sample/papers_md"
              ? []
              : [
                  { name: "papers_md", path: "/sample/papers_md", kind: "directory" },
                  { name: "notes.md", path: "/sample/notes.md", kind: "file" }
                ]
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CorpusSetup onCorpusApplied={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Corpus setup" }));
    await userEvent.click(screen.getByRole("button", { name: "Select Markdown papers folder" }));
    await userEvent.click(await screen.findByRole("button", { name: "papers_md" }));
    await userEvent.click(screen.getByRole("button", { name: "Use this folder" }));

    expect(screen.getByRole("textbox", { name: "Markdown papers folder" })).toHaveValue(
      "/sample/papers_md"
    );
  });
});

async function replaceValue(label: string, value: string) {
  const input = screen.getByRole("textbox", { name: label });
  await userEvent.clear(input);
  await userEvent.type(input, value);
}
