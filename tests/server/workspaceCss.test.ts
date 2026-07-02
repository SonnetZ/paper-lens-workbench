import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(__dirname, "../..");

describe("workspace CSS", () => {
  it("keeps generated feedback from widening the workspace", () => {
    const css = readFileSync(path.join(appRoot, "app/globals.css"), "utf8");

    expect(css).toContain(".review-workspace-panel *");
    expect(css).toContain("min-width: 0");
    expect(css).toContain(".workspace-artifact-body");
    expect(css).toContain("overflow-wrap: anywhere");
  });
});
