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

  it("keeps the collapsed selection conversation badge away from PDF controls", () => {
    const css = readFileSync(path.join(appRoot, "app/globals.css"), "utf8");
    const trigger = css.match(/\.selection-conversation-trigger\s*\{([^}]*)\}/)?.[1] ?? "";
    const rail = css.match(/\.selection-conversation-rail\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(trigger).toContain("top: 50%");
    expect(trigger).toContain("transform: translateY(-50%)");
    expect(trigger).toContain("width: 44px");
    expect(rail).toContain("top: 56px");
  });
});
