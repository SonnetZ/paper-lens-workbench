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

  it("runs setup before local services when the environment is missing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "paper-lens-dev-local-"));
    const binDir = path.join(root, "bin");
    const scriptsDir = path.join(root, "scripts");
    const condaLog = path.join(root, "conda.log");
    const npmLog = path.join(root, "npm.log");
    const readyPath = path.join(root, "ready");
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.copyFileSync(path.join(appRoot, "scripts/dev-local.sh"), path.join(scriptsDir, "dev-local.sh"));
    fs.copyFileSync(path.join(appRoot, "scripts/setup-local.sh"), path.join(scriptsDir, "setup-local.sh"));
    fs.writeFileSync(path.join(root, "environment.local.yml"), "name: lit_reviewer\n");
    fs.writeFileSync(
      path.join(binDir, "conda"),
      [
        "#!/usr/bin/env bash",
        "printf '%s\\n' \"$*\" >> \"$CONDA_CALL_LOG\"",
        "if [[ \"$*\" == \"env create -f environment.local.yml\" ]]; then touch \"$CONDA_READY\"; exit 0; fi",
        "if [[ \"$*\" == run\\ -n\\ lit_reviewer\\ python* && ! -f \"$CONDA_READY\" ]]; then exit 1; fi",
        "exit 0"
      ].join("\n"),
      { mode: 0o755 }
    );
    fs.writeFileSync(
      path.join(binDir, "npm"),
      "#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" >> \"$NPM_CALL_LOG\"\n",
      { mode: 0o755 }
    );

    const result = spawnSync("bash", ["scripts/dev-local.sh", "cpu"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        CONDA_CALL_LOG: condaLog,
        CONDA_READY: readyPath,
        NPM_CALL_LOG: npmLog
      }
    });

    expect(result.status).toBe(0);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    expect(fs.readFileSync(condaLog, "utf8")).toContain("env create -f environment.local.yml");
    expect(fs.readFileSync(npmLog, "utf8")).toContain("run translate:opus");
    expect(fs.readFileSync(npmLog, "utf8")).toContain("run embed:bge-m3:cpu");
    expect(fs.readFileSync(npmLog, "utf8")).toContain("run dev -- -p 3000");
  });
});
