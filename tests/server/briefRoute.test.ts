import { describe, expect, it, vi } from "vitest";

const readBriefArtifact = vi.hoisted(() => vi.fn());
const saveBriefArtifact = vi.hoisted(() => vi.fn());
const generateBrief = vi.hoisted(() => vi.fn());
const resolveAppConfig = vi.hoisted(() => vi.fn());
const getEffectiveAppConfig = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/brief", () => ({ readBriefArtifact, saveBriefArtifact }));
vi.mock("@/lib/server/llmService", () => ({ generateBrief }));
vi.mock("@/lib/server/config", () => ({ resolveAppConfig }));
vi.mock("@/lib/server/corpusConfig", () => ({ getEffectiveAppConfig }));

describe("brief route", () => {
  it("returns the saved brief for a project", async () => {
    const { GET } = await import("@/app/api/papers/[recordId]/brief/route");
    readBriefArtifact.mockReturnValue({
      recordId: "FT0001",
      reviewProjectId: "project-a",
      eligibilitySuggestion: "include",
      rationale: "Already saved.",
      readFirst: ["Abstract"],
      warnings: [],
      payloadScope: "Paper sections",
      modelSettings: undefined,
      updatedAt: "2026-06-29T00:00:00.000Z"
    });

    const response = await GET(new Request("http://example.test?reviewProjectId=project-a"), {
      params: Promise.resolve({ recordId: "FT0001" })
    });
    const body = (await response.json()) as { brief: { recordId: string } };

    expect(readBriefArtifact).toHaveBeenCalled();
    expect(body.brief.recordId).toBe("FT0001");
  });

  it("generates and saves the newest brief on POST", async () => {
    const { POST } = await import("@/app/api/papers/[recordId]/brief/route");
    resolveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    getEffectiveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    generateBrief.mockResolvedValue({
      recordId: "FT0001",
      eligibility_suggestion: "maybe",
      rationale: "Read methods before deciding.",
      read_first: ["Abstract", "Methods"],
      warnings: ["Draft only."]
    });
    saveBriefArtifact.mockReturnValue({
      recordId: "FT0001",
      reviewProjectId: "project-a",
      eligibilitySuggestion: "maybe",
      rationale: "Read methods before deciding.",
      readFirst: ["Abstract", "Methods"],
      warnings: ["Draft only."],
      payloadScope: "Paper sections",
      modelSettings: undefined,
      updatedAt: "2026-06-29T00:00:00.000Z"
    });

    const response = await POST(
      new Request("http://example.test", {
        method: "POST",
        body: JSON.stringify({
          reviewProjectId: "project-a",
          payloadScope: "Paper sections"
        })
      }),
      { params: Promise.resolve({ recordId: "FT0001" }) }
    );
    const body = (await response.json()) as { brief: { recordId: string } };

    expect(generateBrief).toHaveBeenCalled();
    expect(saveBriefArtifact).toHaveBeenCalledWith(
      expect.anything(),
      "project-a",
      "FT0001",
      expect.objectContaining({ eligibilitySuggestion: "maybe" })
    );
    expect(body.brief.recordId).toBe("FT0001");
  });
});
