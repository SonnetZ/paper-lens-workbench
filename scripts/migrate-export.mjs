#!/usr/bin/env node
import path from "node:path";
import { defaultArchivePath, exportWorkspace, importGuide } from "./migrate-core.mjs";

const outputIndex = process.argv.indexOf("--output");
const archivePath = outputIndex >= 0
  ? path.resolve(process.argv[outputIndex + 1] || "")
  : defaultArchivePath(process.cwd());

if (outputIndex >= 0 && !process.argv[outputIndex + 1]) {
  throw new Error("Usage: npm run migrate:export -- --output <archive.tar.gz>");
}

const result = await exportWorkspace({ appRoot: process.cwd(), archivePath });
process.stdout.write(`Migration archive written: ${result.archivePath}\n\n${importGuide()}`);
