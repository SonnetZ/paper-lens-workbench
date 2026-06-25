#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildPortableBoxReport,
  getArchiveName,
  listPortableFiles,
  parseFlags
} from "./portable-core.mjs";

const flags = parseFlags(process.argv.slice(2));
const appRoot = process.cwd();
const report = buildPortableBoxReport(appRoot);
const archiveName = getArchiveName(appRoot);
const includedFiles = listPortableFiles(appRoot);
const archivePath = path.join(appRoot, "dist", archiveName);
const plan = {
  ok: report.ok,
  archiveName,
  archivePath,
  includedFiles,
  issues: report.issues
};

if (!report.ok) {
  writeOutput(plan, flags.json, true);
  process.exit(1);
}

if (!flags.dryRun) {
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  const result = spawnSync(
    "tar",
    ["-czf", archivePath, "--transform", "s,^,scoping-review-reader/,", ...includedFiles],
    {
      cwd: appRoot,
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || "tar failed without stderr output\n");
    process.exit(result.status ?? 1);
  }
}

writeOutput(plan, flags.json, false);

function writeOutput(planToWrite, asJson, failed) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(planToWrite, null, 2)}\n`);
    return;
  }

  const lines = failed
    ? ["Portable pack blocked by failed portability check."]
    : [
        flags.dryRun
          ? "Portable pack dry run passed."
          : `Portable archive written: ${planToWrite.archivePath}`,
        `Archive name: ${planToWrite.archiveName}`,
        `Included files: ${planToWrite.includedFiles.length}`
      ];

  const stream = failed ? process.stderr : process.stdout;
  stream.write(`${lines.join("\n")}\n`);
  for (const issue of planToWrite.issues) {
    stream.write(`- ${issue.code} ${issue.relativePath}: ${issue.message}\n`);
  }
}
