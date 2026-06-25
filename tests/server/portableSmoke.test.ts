import { describe, expect, it } from "vitest";
import { runPortableSmokeCheck } from "../../scripts/portable-smoke-core.mjs";

const appRoot = process.cwd();

describe("portable smoke script", () => {
  it("checks the app after packing and unpacking it away from the source tree", () => {
    const report = runPortableSmokeCheck(appRoot);

    expect(report.ok).toBe(true);
    expect(report.archiveName).toMatch(/^paper-lens-workbench-0\.1\.0-portable\.tar\.gz$/);
    expect(report.unpackedAppRoot).toContain("paper-lens-workbench");
    expect(report.unpackedAppRoot).not.toContain(appRoot);
    expect(report.steps).toEqual([
      { name: "source-portability-check", ok: true },
      { name: "archive-pack", ok: true },
      { name: "archive-extract", ok: true },
      { name: "unpacked-portability-check", ok: true }
    ]);
  });
});
