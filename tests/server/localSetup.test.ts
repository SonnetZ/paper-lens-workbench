import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const appRoot = process.cwd();

describe("local environment setup", () => {
  it.each([
    { exists: false, expected: "env create -f environment.local.yml" },
    { exists: true, expected: "env update -n lit_reviewer -f environment.local.yml" }
  ])("uses conda to create or update the local environment", ({ exists, expected }) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "paper-lens-setup-"));
    const condaPath = path.join(root, "conda");
    const logPath = path.join(root, "conda.log");
    fs.writeFileSync(
      condaPath,
      [
        "#!/usr/bin/env bash",
        "printf '%s\\n' \"$*\" >> \"$CONDA_CALL_LOG\"",
        "if [[ \"$*\" == \"run -n lit_reviewer python --version\" && \"$CONDA_ENV_EXISTS\" != \"1\" ]]; then exit 1; fi",
        "exit 0"
      ].join("\n"),
      { mode: 0o755 }
    );

    const result = spawnSync("bash", ["scripts/setup-local.sh"], {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        CONDA_CALL_LOG: logPath,
        CONDA_ENV_EXISTS: exists ? "1" : "0"
      }
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(logPath, "utf8")).toContain(expected);
    expect(fs.readFileSync(logPath, "utf8")).toContain(
      "run -n lit_reviewer python -c import requests, sacremoses, sentence_transformers, sentencepiece, torch, transformers"
    );
  });
});
