import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPortablePackPlan,
  buildPortableBoxReport,
  getPortableRequiredFiles,
  scanTextForHostPathLeaks
} from "@/lib/server/portableBox";

const appRoot = process.cwd();

describe("portable app box", () => {
  it("declares the files that make the app movable", () => {
    expect(getPortableRequiredFiles()).toEqual(
      expect.arrayContaining([
        "package.json",
        "package-lock.json",
        ".env.example",
        "README.md",
        "docs/development.md",
        "app/page.tsx",
        "lib/server/config.ts",
        "migrations/001_initial.sql",
        "sample-data/review_data/full_text_screening.csv",
        "sample-data/review_data/controlled_vocabularies.json",
        "sample-data/papers_md/FT0001_sample.md"
      ])
    );
  });

  it("passes the portability report for this app root", () => {
    const report = buildPortableBoxReport(appRoot);

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.requiredFilesChecked).toBeGreaterThan(10);
    expect(report.summary.scannedFiles).toBeGreaterThan(10);
  });

  it("flags source files that leak host-specific parent paths", () => {
    const homePath = ["/home", "yusongzhang"].join("/");
    const repoPath = ["local_LLMs", "qwen3.5", "tools", "lit_reviewer"].join("/");
    const issues = scanTextForHostPathLeaks(
      "docs/note.md",
      `Default corpus path: ${homePath}/${repoPath}/papers`
    );

    expect(issues).toEqual([
      {
        code: "HOST_PATH_LEAK",
        relativePath: "docs/note.md",
        message: `Remove host-specific path: ${homePath}`
      },
      {
        code: "HOST_PATH_LEAK",
        relativePath: "docs/note.md",
        message: `Remove host-specific path: ${repoPath}`
      }
    ]);
  });

  it("does not treat generated development directories as portable source files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-portable-"));
    fs.mkdirSync(path.join(root, ".next"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".next", "trace"),
      [["/home", "yusongzhang"].join("/"), ["local_LLMs", "qwen3.5", "tools", "lit_reviewer"].join("/")].join("/")
    );

    const report = buildPortableBoxReport(root, {
      requiredFiles: [],
      packageScripts: []
    });

    expect(report.ok).toBe(true);
    expect(report.summary.scannedFiles).toBe(0);
  });

  it("does not include private env files or local sqlite databases in pack plans", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-portable-"));
    fs.mkdirSync(path.join(root, "nested"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "portable-test", version: "0.0.1", scripts: {} })
    );
    fs.writeFileSync(path.join(root, ".env.example"), "LLM_MODE=mock\n");
    fs.writeFileSync(path.join(root, ".env.local"), "ONLINE_LLM_API_KEY=private\n");
    fs.writeFileSync(path.join(root, ".env"), "ONLINE_LLM_API_KEY=private\n");
    fs.writeFileSync(path.join(root, ".env.production"), "ONLINE_LLM_API_KEY=private\n");
    fs.writeFileSync(path.join(root, "reader.sqlite"), "sqlite");
    fs.writeFileSync(path.join(root, "reviewer.sqlite"), "sqlite");
    fs.writeFileSync(path.join(root, "nested", "corpus.sqlite"), "sqlite");

    const { includedFiles } = buildPortablePackPlan(root);

    expect(includedFiles).toContain(".env.example");
    expect(includedFiles).not.toContain(".env.local");
    expect(includedFiles).not.toContain(".env");
    expect(includedFiles).not.toContain(".env.production");
    expect(includedFiles).not.toContain("reader.sqlite");
    expect(includedFiles).not.toContain("reviewer.sqlite");
    expect(includedFiles).not.toContain("nested/corpus.sqlite");
  });
});
