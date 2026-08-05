#!/usr/bin/env node
import path from "node:path";
import { importWorkspace } from "./migrate-core.mjs";

const fileIndex = process.argv.indexOf("--file");
const filename = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
if (!filename) throw new Error("Usage: npm run migrate:import -- --file <archive.tar.gz> [--force]");

const result = await importWorkspace({
  appRoot: process.cwd(),
  archivePath: path.resolve(filename),
  force: process.argv.includes("--force")
});
process.stdout.write(`Workspace imported. Database: ${result.readerDbPath}\nStart with: npm run dev:local:cpu\n`);
