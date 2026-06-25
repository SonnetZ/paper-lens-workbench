import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const e2eDataRoot = path.join(os.tmpdir(), "paper-lens-workbench-e2e");
const e2eReviewDir = path.join(e2eDataRoot, "review_data");
const e2eMarkdownDir = path.join(e2eDataRoot, "papers_md");
const e2ePdfDir = path.join(e2eDataRoot, "papers_pdf");
const e2eExportDir = path.join(e2eDataRoot, "exports");
const e2ePort = 3217;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

fs.rmSync(e2eDataRoot, { recursive: true, force: true });
fs.mkdirSync(e2eDataRoot, { recursive: true });
fs.cpSync(path.resolve("sample-data/review_data"), e2eReviewDir, { recursive: true });
fs.cpSync(path.resolve("sample-data/papers_md"), e2eMarkdownDir, { recursive: true });
fs.cpSync(path.resolve("sample-data/papers_pdf"), e2ePdfDir, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry"
  },
  webServer: {
    command: `next dev -H 127.0.0.1 -p ${e2ePort}`,
    env: {
      REVIEW_DATA_DIR: e2eReviewDir,
      PAPER_MD_DIR: e2eMarkdownDir,
      PAPER_PDF_DIR: e2ePdfDir,
      READER_DB_PATH: path.join(e2eDataRoot, "reader.sqlite"),
      READER_EXPORT_DIR: e2eExportDir,
      LLM_MODE: "mock"
    },
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
