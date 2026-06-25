import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listFileBrowserDirectory } from "@/lib/server/fileBrowser";

describe("file browser", () => {
  it("lists directories first and keeps files visible for orientation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "reader-file-browser-"));
    await mkdir(path.join(root, "papers_md"));
    await mkdir(path.join(root, "review_data"));
    await writeFile(path.join(root, "notes.md"), "# Notes\n", "utf-8");

    const listing = await listFileBrowserDirectory(root);

    expect(listing.currentPath).toBe(root);
    expect(listing.parentPath).toBe(path.dirname(root));
    expect(listing.entries.map((entry) => `${entry.kind}:${entry.name}`)).toEqual([
      "directory:papers_md",
      "directory:review_data",
      "file:notes.md"
    ]);
  });
});
