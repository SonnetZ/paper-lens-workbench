import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface FileBrowserEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
}

export interface FileBrowserListing {
  currentPath: string;
  parentPath: string | null;
  entries: FileBrowserEntry[];
}

export async function listFileBrowserDirectory(inputPath?: string): Promise<FileBrowserListing> {
  const currentPath = path.resolve(inputPath?.trim() || os.homedir());
  const currentStat = await stat(currentPath);
  if (!currentStat.isDirectory()) {
    throw new Error("Selected path is not a directory");
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  return {
    currentPath,
    parentPath: parentPathFor(currentPath),
    entries: entries
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map((entry) => ({
        name: entry.name,
        path: path.join(currentPath, entry.name),
        kind: entry.isDirectory() ? ("directory" as const) : ("file" as const)
      }))
      .sort(compareEntries)
  };
}

function parentPathFor(currentPath: string): string | null {
  const parent = path.dirname(currentPath);
  return parent === currentPath ? null : parent;
}

function compareEntries(left: FileBrowserEntry, right: FileBrowserEntry): number {
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}
