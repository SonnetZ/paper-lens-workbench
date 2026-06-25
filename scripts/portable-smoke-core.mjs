import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPortableBoxReport,
  getArchiveName,
  listPortableFiles
} from "./portable-core.mjs";

export function runPortableSmokeCheck(appRoot, options = {}) {
  const root = path.resolve(appRoot);
  const archiveName = getArchiveName(root);
  const archivePath = path.join(root, "dist", archiveName);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "scoping-reader-smoke-"));
  const unpackedAppRoot = path.join(tempRoot, "scoping-review-reader");
  const steps = [];
  const issues = [];

  const sourceReport = buildPortableBoxReport(root);
  steps.push({ name: "source-portability-check", ok: sourceReport.ok });
  issues.push(...sourceReport.issues);

  if (lastStepOk(steps)) {
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    const packResult = spawnSync(
      "tar",
      ["-czf", archivePath, "--transform", "s,^,scoping-review-reader/,", ...listPortableFiles(root)],
      { cwd: root, encoding: "utf8" }
    );
    steps.push({ name: "archive-pack", ok: packResult.status === 0 });
    if (packResult.status !== 0) {
      issues.push({
        code: "ARCHIVE_PACK_FAILED",
        relativePath: "dist",
        message:
          packResult.stderr ||
          packResult.error?.message ||
          "tar failed while creating the portable archive"
      });
    }
  }

  if (lastStepOk(steps)) {
    const extractResult = spawnSync("tar", ["-xzf", archivePath, "-C", tempRoot], {
      encoding: "utf8"
    });
    steps.push({
      name: "archive-extract",
      ok: extractResult.status === 0
    });
    if (extractResult.status !== 0) {
      issues.push({
        code: "ARCHIVE_EXTRACT_FAILED",
        relativePath: archivePath,
        message:
          extractResult.stderr ||
          extractResult.error?.message ||
          "tar failed while extracting the portable archive"
      });
    }
  }

  if (lastStepOk(steps)) {
    const unpackedReport = buildPortableBoxReport(unpackedAppRoot);
    steps.push({ name: "unpacked-portability-check", ok: unpackedReport.ok });
    issues.push(...unpackedReport.issues);
  }

  const report = {
    ok: issues.length === 0 && steps.every((step) => step.ok),
    archiveName,
    archivePath,
    unpackedAppRoot,
    steps,
    issues
  };

  if (!options.keepTemp) {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }

  return report;
}

function lastStepOk(steps) {
  return steps.length > 0 && steps[steps.length - 1].ok;
}
