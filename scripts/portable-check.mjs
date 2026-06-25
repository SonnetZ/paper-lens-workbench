#!/usr/bin/env node
import { buildPortableBoxReport, parseFlags } from "./portable-core.mjs";

const flags = parseFlags(process.argv.slice(2));
const report = buildPortableBoxReport(process.cwd());

if (flags.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else if (report.ok) {
  process.stdout.write(
    [
      "Portable box check passed.",
      `Required files checked: ${report.summary.requiredFilesChecked}`,
      `Package scripts checked: ${report.summary.packageScriptsChecked}`,
      `Source files scanned: ${report.summary.scannedFiles}`
    ].join("\n") + "\n"
  );
} else {
  process.stderr.write("Portable box check failed.\n");
  for (const issue of report.issues) {
    process.stderr.write(`- ${issue.code} ${issue.relativePath}: ${issue.message}\n`);
  }
}

process.exit(report.ok ? 0 : 1);
