import fs from "node:fs";
import path from "node:path";

export type PortableIssueCode =
  | "MISSING_REQUIRED_FILE"
  | "MISSING_PACKAGE_SCRIPT"
  | "HOST_PATH_LEAK";

export interface PortableBoxIssue {
  code: PortableIssueCode;
  relativePath: string;
  message: string;
}

export interface PortableBoxReport {
  ok: boolean;
  issues: PortableBoxIssue[];
  summary: {
    appRoot: string;
    requiredFilesChecked: number;
    packageScriptsChecked: number;
    scannedFiles: number;
  };
}

export interface PortablePackPlan {
  ok: boolean;
  archiveName: string;
  archivePath: string;
  includedFiles: string[];
  report: PortableBoxReport;
}

interface PortableBoxOptions {
  requiredFiles?: string[];
  packageScripts?: string[];
}

const requiredFiles = [
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "tsconfig.json",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  ".env.example",
  ".gitignore",
  "README.md",
  "PORTABLE.md",
  "docs/development.md",
  "app/layout.tsx",
  "app/page.tsx",
  "app/globals.css",
  "app/api/evidence/route.ts",
  "app/api/health/route.ts",
  "app/api/model-config/route.ts",
  "app/api/model-config/test/route.ts",
  "app/api/papers/[recordId]/ask/route.ts",
  "app/api/papers/[recordId]/brief/route.ts",
  "app/api/papers/[recordId]/export/route.ts",
  "app/api/papers/[recordId]/extraction/route.ts",
  "app/api/papers/[recordId]/markdown/route.ts",
  "app/api/papers/[recordId]/pdf/route.ts",
  "app/api/papers/[recordId]/route.ts",
  "app/api/papers/[recordId]/screening/route.ts",
  "app/api/papers/route.ts",
  "components/AppShell.tsx",
  "components/ArtifactView.tsx",
  "components/AskPanel.tsx",
  "components/EvidenceTray.tsx",
  "components/ExtractionForm.tsx",
  "components/MarkdownReader.tsx",
  "components/ModelSourceControl.tsx",
  "components/PaperQueue.tsx",
  "components/PayloadScopeBanner.tsx",
  "components/PdfReader.tsx",
  "components/ReaderShell.tsx",
  "components/ReviewMaterialExport.tsx",
  "components/ReviewWorkspace.tsx",
  "components/ScreeningForm.tsx",
  "lib/server/config.ts",
  "lib/server/csvStore.ts",
  "lib/server/sourceRegistry.ts",
  "lib/server/sqliteStore.ts",
  "lib/server/evidence.ts",
  "lib/server/extraction.ts",
  "lib/server/llmService.ts",
  "lib/server/modelConfig.ts",
  "lib/server/portableBox.ts",
  "lib/server/reviewExport.ts",
  "lib/server/screening.ts",
  "lib/types.ts",
  "migrations/001_initial.sql",
  "sample-data/scoping_review/full_text_screening.csv",
  "sample-data/scoping_review/controlled_vocabularies.json",
  "sample-data/papers_md/FT0001_sample.md",
  "sample-data/papers_pdf/README.md",
  "tests/server/config.test.ts",
  "tests/server/evidence.test.ts",
  "tests/server/extraction.test.ts",
  "tests/server/llmAsk.test.ts",
  "tests/server/modelConfig.test.ts",
  "tests/server/portableBox.test.ts",
  "tests/server/portableScripts.test.ts",
  "tests/server/portableSmoke.test.ts",
  "tests/server/reviewExport.test.ts",
  "tests/server/screening.test.ts",
  "tests/server/sourceRegistry.test.ts",
  "tests/client/AskPanel.test.tsx",
  "tests/client/AppShell.test.tsx",
  "tests/client/ScreeningForm.test.tsx",
  "tests/client/EvidenceTray.test.tsx",
  "tests/client/ExtractionForm.test.tsx",
  "tests/client/MarkdownReader.test.tsx",
  "tests/client/ModelSourceControl.test.tsx",
  "tests/client/PaperQueue.test.tsx",
  "tests/client/ReviewMaterialExport.test.tsx",
  "tests/setup.ts",
  "scripts/pack-portable.mjs",
  "scripts/portable-check.mjs",
  "scripts/portable-smoke.mjs",
  "scripts/portable-smoke-core.mjs",
  "scripts/portable-smoke-core.d.mts",
  "scripts/portable-core.mjs",
  "tests/e2e/reader.spec.ts",
  "scripts/portable-core.d.mts"
];

const requiredPackageScripts = [
  "dev",
  "build",
  "lint",
  "test",
  "e2e",
  "portable:check",
  "portable:pack",
  "portable:smoke"
];

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "dist",
  "playwright-report",
  "test-results",
  "exports"
]);

const ignoredFiles = new Set(["tsconfig.tsbuildinfo"]);

const scannableExtensions = new Set([
  ".css",
  ".csv",
  ".env",
  ".example",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt"
]);

const hostPathLeaks = [
  ["/home", "yusongzhang"].join("/"),
  ["local_LLMs", "qwen3.5", "tools", "lit_reviewer"].join("/")
];

export function getPortableRequiredFiles(): string[] {
  return [...requiredFiles];
}

export function getPortableRequiredPackageScripts(): string[] {
  return [...requiredPackageScripts];
}

export function buildPortablePackPlan(appRoot: string): PortablePackPlan {
  const root = path.resolve(appRoot);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ) as { name: string; version: string };
  const archiveName = `${packageJson.name}-${packageJson.version}-portable.tar.gz`;
  const report = buildPortableBoxReport(root);

  return {
    ok: report.ok,
    archiveName,
    archivePath: path.join(root, "dist", archiveName),
    includedFiles: listPortableFiles(root),
    report
  };
}

export function scanTextForHostPathLeaks(
  relativePath: string,
  text: string
): PortableBoxIssue[] {
  return hostPathLeaks
    .filter((hostPath) => text.includes(hostPath))
    .map((hostPath) => ({
      code: "HOST_PATH_LEAK",
      relativePath,
      message: `Remove host-specific path: ${hostPath}`
    }));
}

export function buildPortableBoxReport(
  appRoot: string,
  options: PortableBoxOptions = {}
): PortableBoxReport {
  const root = path.resolve(appRoot);
  const filesToRequire = options.requiredFiles ?? requiredFiles;
  const scriptsToRequire = options.packageScripts ?? requiredPackageScripts;
  const issues: PortableBoxIssue[] = [];

  for (const relativePath of filesToRequire) {
    if (!fs.existsSync(path.join(root, relativePath))) {
      issues.push({
        code: "MISSING_REQUIRED_FILE",
        relativePath,
        message: `Required portable app file is missing: ${relativePath}`
      });
    }
  }

  issues.push(...checkPackageScripts(root, scriptsToRequire));

  let scannedFiles = 0;
  for (const relativePath of listScannableFiles(root)) {
    scannedFiles += 1;
    const text = fs.readFileSync(path.join(root, relativePath), "utf8");
    issues.push(...scanTextForHostPathLeaks(relativePath, text));
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      appRoot: root,
      requiredFilesChecked: filesToRequire.length,
      packageScriptsChecked: scriptsToRequire.length,
      scannedFiles
    }
  };
}

function checkPackageScripts(root: string, scriptsToRequire: string[]): PortableBoxIssue[] {
  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) return [];

  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  return scriptsToRequire
    .filter((scriptName) => !packageJson.scripts?.[scriptName])
    .map((scriptName) => ({
      code: "MISSING_PACKAGE_SCRIPT" as const,
      relativePath: "package.json",
      message: `Required package script is missing: ${scriptName}`
    }));
}

function listScannableFiles(root: string): string[] {
  return listPortableFiles(root, true);
}

function listPortableFiles(root: string, scannableOnly = false): string[] {
  if (!fs.existsSync(root)) return [];

  const result: string[] = [];
  const walk = (currentDir: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (shouldIgnoreFile(relativePath, entry.name)) continue;
      if (scannableOnly && !shouldScan(relativePath)) continue;
      result.push(relativePath);
    }
  };

  walk(root);
  return result.sort();
}

function shouldIgnoreFile(relativePath: string, basename: string): boolean {
  if (ignoredFiles.has(basename)) return true;
  if (basename.startsWith(".env") && basename !== ".env.example") return true;
  return isRuntimeDatabaseFile(relativePath);
}

function isRuntimeDatabaseFile(relativePath: string): boolean {
  return /\.(sqlite|sqlite3|db)(-(wal|shm))?$/i.test(relativePath);
}

function shouldScan(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (basename === ".env.example") return true;
  return scannableExtensions.has(path.extname(relativePath));
}
