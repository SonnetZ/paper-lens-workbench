#!/usr/bin/env node
import { parseFlags } from "./portable-core.mjs";
import { runPortableSmokeCheck } from "./portable-smoke-core.mjs";

const flags = parseFlags(process.argv.slice(2));
const report = runPortableSmokeCheck(process.cwd(), { keepTemp: flags.json });

writeOutput(report, flags);
process.exit(report.ok ? 0 : 1);

function writeOutput(report, flags) {
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  if (report.ok) {
    process.stdout.write(
      [
        "Portable smoke check passed.",
        `Archive name: ${report.archiveName}`,
        `Unpacked app root: ${report.unpackedAppRoot}`
      ].join("\n") + "\n"
    );
    return;
  }

  process.stderr.write("Portable smoke check failed.\n");
  for (const step of report.steps) {
    process.stderr.write(`- ${step.name}: ${step.ok ? "ok" : "failed"}\n`);
  }
  for (const issue of report.issues) {
    process.stderr.write(`- ${issue.code} ${issue.relativePath}: ${issue.message}\n`);
  }
}
