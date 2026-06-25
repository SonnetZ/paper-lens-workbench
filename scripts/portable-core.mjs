import fs from "node:fs";
import path from "node:path";

export const requiredFiles = [
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

export const requiredPackageScripts = [
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

export function parseFlags(argv) {
  return {
    json: argv.includes("--json"),
    dryRun: argv.includes("--dry-run")
  };
}

export function buildPortableBoxReport(appRoot) {
  const root = path.resolve(appRoot);
  const issues = [];

  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(root, relativePath))) {
      issues.push({
        code: "MISSING_REQUIRED_FILE",
        relativePath,
        message: `Required portable app file is missing: ${relativePath}`
      });
    }
  }

  issues.push(...checkPackageScripts(root));

  let scannedFiles = 0;
  for (const relativePath of listPortableFiles(root, { scannableOnly: true })) {
    scannedFiles += 1;
    const text = fs.readFileSync(path.join(root, relativePath), "utf8");
    for (const hostPath of hostPathLeaks) {
      if (text.includes(hostPath)) {
        issues.push({
          code: "HOST_PATH_LEAK",
          relativePath,
          message: `Remove host-specific path: ${hostPath}`
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      appRoot: root,
      requiredFilesChecked: requiredFiles.length,
      packageScriptsChecked: requiredPackageScripts.length,
      scannedFiles
    }
  };
}

export function listPortableFiles(appRoot, options = {}) {
  const root = path.resolve(appRoot);
  if (!fs.existsSync(root)) return [];

  const result = [];
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (shouldIgnoreFile(relativePath, entry.name)) continue;
      if (options.scannableOnly && !shouldScan(relativePath)) continue;
      result.push(relativePath);
    }
  };

  walk(root);
  return result.sort();
}

function shouldIgnoreFile(relativePath, basename) {
  if (ignoredFiles.has(basename)) return true;
  if (basename.startsWith(".env") && basename !== ".env.example") return true;
  return isRuntimeDatabaseFile(relativePath);
}

function isRuntimeDatabaseFile(relativePath) {
  return /\.(sqlite|sqlite3|db)(-(wal|shm))?$/i.test(relativePath);
}

export function getArchiveName(appRoot) {
  const packageJson = readPackageJson(appRoot);
  return `${packageJson.name}-${packageJson.version}-portable.tar.gz`;
}

function checkPackageScripts(root) {
  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) return [];

  const packageJson = readPackageJson(root);
  return requiredPackageScripts
    .filter((scriptName) => !packageJson.scripts?.[scriptName])
    .map((scriptName) => ({
      code: "MISSING_PACKAGE_SCRIPT",
      relativePath: "package.json",
      message: `Required package script is missing: ${scriptName}`
    }));
}

function readPackageJson(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
}

function shouldScan(relativePath) {
  const basename = path.basename(relativePath);
  if (basename === ".env.example") return true;
  return scannableExtensions.has(path.extname(relativePath));
}
