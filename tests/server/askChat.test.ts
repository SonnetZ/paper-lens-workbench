import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@/lib/types";
import {
  clearAskChatMessages,
  listAskChatMessages,
  saveAskChatMessage
} from "@/lib/server/askChat";

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(path.join(os.tmpdir(), "reader-ask-chat-"));
  return {
    llmMode: "mock",
    reviewDataDir: root,
    paperMdDir: root,
    paperPdfDir: root,
    readerDbPath: path.join(root, "reader.sqlite"),
    readerExportDir: path.join(root, "exports"),
    localLlmBaseUrl: "http://localhost:8000/v1",
    localLlmModel: "",
    onlineLlmBaseUrl: "",
    onlineLlmModel: "",
    onlineConfigSource: "manual",
    llmMaxInputChars: 24000
  };
}

describe("ask chat store", () => {
  it("keeps messages isolated by review project, paper, and payload scope", async () => {
    const config = await makeConfig();

    saveAskChatMessage(config, {
      reviewProjectId: "project-a",
      recordId: "FT0001",
      payloadScope: "Selection",
      role: "user",
      content: "Saved question",
      evidenceUsed: [],
      warnings: []
    });
    saveAskChatMessage(config, {
      reviewProjectId: "project-a",
      recordId: "FT0001",
      payloadScope: "Current full text",
      role: "assistant",
      content: "Full text answer",
      evidenceUsed: ["FT0001 / Current full text"],
      warnings: []
    });
    saveAskChatMessage(config, {
      reviewProjectId: "project-b",
      recordId: "FT0001",
      payloadScope: "Selection",
      role: "assistant",
      content: "Other project answer",
      evidenceUsed: [],
      warnings: []
    });

    expect(listAskChatMessages(config, "project-a", "FT0001", "Selection")).toMatchObject([
      { content: "Saved question", role: "user" }
    ]);

    clearAskChatMessages(config, "project-a", "FT0001", "Selection");

    expect(listAskChatMessages(config, "project-a", "FT0001", "Selection")).toEqual([]);
    expect(listAskChatMessages(config, "project-a", "FT0001", "Current full text")).toMatchObject([
      { content: "Full text answer", evidenceUsed: ["FT0001 / Current full text"] }
    ]);
    expect(listAskChatMessages(config, "project-b", "FT0001", "Selection")).toMatchObject([
      { content: "Other project answer" }
    ]);
  });
});
