import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPortablePackPlan,
  getPortableRequiredFiles,
  getPortableRequiredPackageScripts
} from "@/lib/server/portableBox";
import { listPortableFiles } from "../../scripts/portable-core.mjs";

const appRoot = process.cwd();

describe("portable scripts", () => {
  it("exposes stable package scripts for checking and packing the app box", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["portable:check"]).toBe("node scripts/portable-check.mjs");
    expect(packageJson.scripts["portable:pack"]).toBe("node scripts/pack-portable.mjs");
    expect(packageJson.scripts["portable:smoke"]).toBe("node scripts/portable-smoke.mjs");
    expect(packageJson.scripts["dev:local:cpu"]).toBe("bash scripts/dev-local.sh cpu");
    expect(packageJson.scripts["dev:local:gpu"]).toBe("bash scripts/dev-local.sh gpu");
    expect(packageJson.scripts["setup:local"]).toBe("bash scripts/setup-local.sh");
    expect(packageJson.scripts["migrate:export"]).toBe("node scripts/migrate-export.mjs");
    expect(packageJson.scripts["migrate:import"]).toBe("node scripts/migrate-import.mjs");
    expect(packageJson.scripts["translate:opus"]).toContain(
      "conda run -n lit_reviewer python scripts/opus_mt_translate_server.py"
    );
    expect(packageJson.scripts["embed:bge-m3:cpu"]).toContain(
      "scripts/bge_m3_embedding_server.py --device cpu"
    );
    expect(packageJson.scripts["embed:bge-m3:gpu"]).toContain(
      "scripts/bge_m3_embedding_server.py --device cuda"
    );
    expect(fs.existsSync(path.join(appRoot, "scripts/portable-check.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/pack-portable.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/portable-smoke.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/dev-local.sh"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/setup-local.sh"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/migrate-core.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/migrate-export.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/migrate-import.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "environment.local.yml"))).toBe(true);
    expect(fs.existsSync(path.join(appRoot, "scripts/bge_m3_embedding_server.py"))).toBe(true);
  });

  it("builds a machine-readable portable check report", () => {
    const plan = buildPortablePackPlan(appRoot);

    expect(plan.report.ok).toBe(true);
    expect(plan.report.issues).toEqual([]);
    expect(plan.report.summary.requiredFilesChecked).toBeGreaterThan(10);
    expect(plan.report.summary.scannedFiles).toBeGreaterThan(10);
  });

  it("plans a portable archive without including generated directories", () => {
    const plan = buildPortablePackPlan(appRoot);

    expect(plan.ok).toBe(true);
    expect(plan.archiveName).toMatch(/^paper-lens-workbench-0\.1\.0-portable\.tar\.gz$/);
    expect(plan.includedFiles).toContain("package.json");
    expect(plan.includedFiles).toContain("package-lock.json");
    expect(plan.includedFiles).toContain(".env.example");
    expect(plan.includedFiles).not.toContain("reader.sqlite");
    expect(plan.includedFiles.some((file) => file.startsWith("node_modules/"))).toBe(false);
    expect(plan.includedFiles.some((file) => file.startsWith(".next/"))).toBe(false);
    expect(plan.includedFiles.some((file) => file.startsWith("test-results/"))).toBe(false);
    expect(plan.includedFiles.some((file) => file.startsWith("paper-lens-data/"))).toBe(false);
  });

  it("keeps private runtime patterns in the local git ignore", () => {
    const gitignore = fs.readFileSync(path.join(appRoot, ".gitignore"), "utf8");

    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.*");
    expect(gitignore).toContain("!.env.example");
    expect(gitignore).toContain("*.sqlite");
    expect(gitignore).toContain("*.sqlite3");
    expect(gitignore).toContain("*.sqlite-wal");
    expect(gitignore).toContain("*.sqlite-shm");
    expect(gitignore).toContain("*.db");
  });

  it("keeps the TypeScript and CLI portable manifests in sync", async () => {
    const { requiredFiles, requiredPackageScripts } = await import(
      "../../scripts/portable-core.mjs"
    );

    expect(requiredFiles).toEqual(getPortableRequiredFiles());
    expect(requiredPackageScripts).toEqual(getPortableRequiredPackageScripts());
    expect(requiredFiles).toEqual(
      expect.arrayContaining([
        "app/api/evidence/route.ts",
        "app/api/health/route.ts",
        "app/api/corpus-config/source-file/route.ts",
        "app/api/model-config/route.ts",
        "app/api/model-config/test/route.ts",
        "app/api/papers/[recordId]/brief/route.ts",
        "app/api/papers/[recordId]/export/route.ts",
        "app/api/translate/route.ts",
        "tests/server/nextConfig.test.ts",
	        "components/BriefPanel.tsx",
	        "components/CorpusSetup.tsx",
	        "components/InfoHint.tsx",
	        "tests/client/InfoHint.test.tsx",
	        "components/ModelSourceControl.tsx",
	        "components/PdfReader.tsx",
	        "components/ReviewMaterialExport.tsx",
	        "components/SelectionAssistant.tsx",
        "lib/server/corpusConfig.ts",
        "lib/server/reviewExport.ts",
        "lib/server/translation.ts",
        "scripts/opus_mt_translate_server.py",
        "scripts/setup-local.sh",
        "scripts/migrate-core.mjs",
        "scripts/migrate-export.mjs",
        "scripts/migrate-import.mjs",
        "environment.local.yml",
        "scripts/bge_m3_embedding_server.py",
        "tests/server/localSetup.test.ts",
        "tests/server/migrationScripts.test.ts",
        "tests/server/translation.test.ts",
        "tests/client/ReviewMaterialExport.test.tsx",
        "tests/server/reviewExport.test.ts",
        "tests/server/portableScripts.test.ts",
        "scripts/portable-core.d.mts"
      ])
    );
    expect(requiredPackageScripts).toEqual(
      expect.arrayContaining([
        "translate:opus",
        "dev:local:cpu",
        "dev:local:gpu",
        "setup:local",
        "migrate:export",
        "migrate:import",
        "embed:bge-m3:cpu",
        "embed:bge-m3:gpu",
        "portable:check",
        "portable:pack",
        "portable:smoke"
      ])
    );
  });

  it("treats the portable handoff guide and archive smoke script as part of the box", () => {
    const requiredFiles = getPortableRequiredFiles();

    expect(requiredFiles).toContain("PORTABLE.md");
    expect(requiredFiles).toContain("scripts/dev-local.sh");
    expect(requiredFiles).toContain("scripts/setup-local.sh");
    expect(requiredFiles).toContain("scripts/migrate-core.mjs");
    expect(requiredFiles).toContain("scripts/migrate-export.mjs");
    expect(requiredFiles).toContain("scripts/migrate-import.mjs");
    expect(requiredFiles).toContain("environment.local.yml");
    expect(requiredFiles).toContain("scripts/portable-smoke.mjs");
    expect(requiredFiles).toContain("scripts/portable-smoke-core.mjs");
    expect(requiredFiles).toContain("scripts/portable-smoke-core.d.mts");
    expect(requiredFiles).toContain("tests/server/portableSmoke.test.ts");
  });

  it("keeps private runtime files out of the portable CLI file list", () => {
    const privateFiles = [
      [".env.local", "ONLINE_LLM_API_KEY=private\n"],
      [".env", "ONLINE_LLM_API_KEY=private\n"],
      ["reviewer.sqlite", "sqlite"],
      [path.join("nested-state", "corpus.sqlite"), "sqlite"]
    ];

    for (const [relativePath, content] of privateFiles) {
      const absolutePath = path.join(appRoot, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content);
    }

    try {
      const includedFiles = listPortableFiles(appRoot);

      expect(includedFiles).toContain(".env.example");
      expect(includedFiles).not.toContain(".env.local");
      expect(includedFiles).not.toContain(".env");
      expect(includedFiles).not.toContain("reviewer.sqlite");
      expect(includedFiles).not.toContain("nested-state/corpus.sqlite");
    } finally {
      for (const [relativePath] of privateFiles) {
        fs.rmSync(path.join(appRoot, relativePath), { force: true });
      }
      fs.rmSync(path.join(appRoot, "nested-state"), { force: true, recursive: true });
    }
  });
});
