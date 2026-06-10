#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const bashCommand =
  "vtex content generate-schema -o ./cms/faststore/schema.json && vtex content upload-schema ./cms/faststore/schema.json";

/** @type {Array<{ test: (buffer: string) => boolean; write: string }>} */
const uploadPromptSteps = [
  {
    test: (buffer) => /store ID you want to associate/i.test(buffer),
    write: "faststore\n",
  },
  {
    test: (buffer) => /Schema version to publish/i.test(buffer),
    write: "\n",
  },
  {
    test: (buffer) =>
      /Are you sure you want to upload this schema to/i.test(buffer),
    write: "Yes\n",
  },
  {
    test: (buffer) =>
      /can be safely deleted since it was[\s\S]*Delete it\?/i.test(buffer),
    write: "No\n",
  },
];

function runCmsSchemaSync() {
  const child = spawn("bash", ["-lc", bashCommand], {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  let outputBuffer = "";
  let stepIndex = 0;

  const handleOutput = (chunk) => {
    const text = chunk.toString();
    outputBuffer += text;
    process.stdout.write(text);

    while (
      stepIndex < uploadPromptSteps.length &&
      uploadPromptSteps[stepIndex].test(outputBuffer)
    ) {
      child.stdin.write(uploadPromptSteps[stepIndex].write);
      stepIndex += 1;
    }
  };

  child.stdout.on("data", handleOutput);
  child.stderr.on("data", handleOutput);

  child.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });

  child.on("close", (code, signal) => {
    if (signal) {
      console.error(`cms schema sync terminated by signal: ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });
}

runCmsSchemaSync();
