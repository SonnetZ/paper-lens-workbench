import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

describe("next config", () => {
  it("keeps dev and production build output directories separate", () => {
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir).toBe(".next-dev");
    expect(nextConfig(PHASE_PRODUCTION_BUILD).distDir).toBe(".next");
  });
});
