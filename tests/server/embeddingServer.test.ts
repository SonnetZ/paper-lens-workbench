import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = process.cwd();

describe("BGE-M3 embedding server", () => {
  it("exposes an OpenAI-compatible embeddings route with shared CPU/GPU parameters", () => {
    const script = readFileSync(path.join(appRoot, "scripts/bge_m3_embedding_server.py"), "utf8");

    expect(script).toContain('"/v1/embeddings"');
    expect(script).toContain('"data"');
    expect(script).toContain("SentenceTransformer");
    expect(script).toContain("--device");
    expect(script).toContain("BAAI/bge-m3");
    expect(script).toContain("normalize_embeddings=True");
  });
});
