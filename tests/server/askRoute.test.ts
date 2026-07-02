import { describe, expect, it, vi } from "vitest";

const answerScopedAsk = vi.hoisted(() => vi.fn());
const listAskChatMessages = vi.hoisted(() => vi.fn());
const saveAskChatMessage = vi.hoisted(() => vi.fn());
const clearAskChatMessages = vi.hoisted(() => vi.fn());
const resolveAppConfig = vi.hoisted(() => vi.fn());
const getEffectiveAppConfig = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/llmService", () => ({ answerScopedAsk }));
vi.mock("@/lib/server/askChat", () => ({
  listAskChatMessages,
  saveAskChatMessage,
  clearAskChatMessages
}));
vi.mock("@/lib/server/config", () => ({ resolveAppConfig }));
vi.mock("@/lib/server/corpusConfig", () => ({ getEffectiveAppConfig }));

describe("ask route", () => {
  it("returns saved chat messages for the selected project and scope", async () => {
    const { GET } = await import("@/app/api/papers/[recordId]/ask/route");
    resolveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    getEffectiveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    listAskChatMessages.mockReturnValue([
      {
        id: "ask_1",
        reviewProjectId: "project-a",
        recordId: "FT0001",
        payloadScope: "Current full text",
        role: "assistant",
        content: "Saved **answer**.",
        evidenceUsed: [],
        warnings: [],
        createdAt: "2026-07-03T00:00:00.000Z"
      }
    ]);

    const response = await GET(
      new Request("http://example.test?reviewProjectId=project-a&payloadScope=Current%20full%20text"),
      { params: Promise.resolve({ recordId: "FT0001" }) }
    );
    const body = (await response.json()) as { messages: Array<{ content: string }> };

    expect(listAskChatMessages).toHaveBeenCalledWith(
      expect.anything(),
      "project-a",
      "FT0001",
      "Current full text"
    );
    expect(body.messages[0].content).toBe("Saved **answer**.");
  });

  it("saves the user turn and assistant answer on POST", async () => {
    const { POST } = await import("@/app/api/papers/[recordId]/ask/route");
    resolveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    getEffectiveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    listAskChatMessages.mockReturnValue([]);
    saveAskChatMessage
      .mockReturnValueOnce({
        id: "ask_user",
        role: "user",
        content: "What is the evaluation design?",
        evidenceUsed: [],
        warnings: []
      })
      .mockReturnValueOnce({
        id: "ask_assistant",
        role: "assistant",
        content: "It uses **expert audit**.",
        evidenceUsed: ["FT0001 / Current full text"],
        warnings: []
      });
    answerScopedAsk.mockResolvedValue({
      recordId: "FT0001",
      payloadScope: "Current full text",
      answer: "It uses **expert audit**.",
      evidenceUsed: ["FT0001 / Current full text"],
      warnings: []
    });

    const response = await POST(
      new Request("http://example.test", {
        method: "POST",
        body: JSON.stringify({
          reviewProjectId: "project-a",
          question: "What is the evaluation design?",
          payloadScope: "Current full text",
          evidence: []
        })
      }),
      { params: Promise.resolve({ recordId: "FT0001" }) }
    );
    const body = (await response.json()) as { messages: Array<{ role: string }> };

    expect(answerScopedAsk).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        question: "What is the evaluation design?",
        chatHistory: []
      })
    );
    expect(saveAskChatMessage).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        reviewProjectId: "project-a",
        role: "user"
      })
    );
    expect(saveAskChatMessage).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        reviewProjectId: "project-a",
        role: "assistant",
        evidenceUsed: ["FT0001 / Current full text"]
      })
    );
    expect(body.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
  });

  it("clears saved chat messages for the selected scope", async () => {
    const { DELETE } = await import("@/app/api/papers/[recordId]/ask/route");
    resolveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });
    getEffectiveAppConfig.mockReturnValue({ readerDbPath: "/tmp/reader.sqlite" });

    const response = await DELETE(
      new Request("http://example.test?reviewProjectId=project-a&payloadScope=Selection"),
      { params: Promise.resolve({ recordId: "FT0001" }) }
    );

    expect(response.status).toBe(200);
    expect(clearAskChatMessages).toHaveBeenCalledWith(
      expect.anything(),
      "project-a",
      "FT0001",
      "Selection"
    );
  });
});
