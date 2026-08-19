import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import minimist from "minimist";
import { toPortableReportPath } from "./report-path.mjs";

const options = minimist(process.argv.slice(2), {
  string: ["docs", "executable", "iterations", "output"],
  default: { docs: "examples/basic/docs", iterations: "5" },
});
const docsRoot = resolve(options.docs);
const iterations = Number(options.iterations);
const benchmarkExecutable = options.executable;
const hardLimitMs = 100;
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "cold-start-benchmark",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};

if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error("--iterations must be a positive integer.");
}
if (options._.length > 0) {
  throw new Error(
    `Unexpected positional arguments: ${options._.join(" ")}. Pass pnpm script options without a standalone --.`,
  );
}

async function measureOnce() {
  return new Promise((resolveMeasurement, rejectMeasurement) => {
    const startedAt = performance.now();
    let responseMeasurement;
    let settled = false;
    const command = benchmarkExecutable
      ? resolve(benchmarkExecutable)
      : process.execPath;
    const args = benchmarkExecutable
      ? ["serve", docsRoot]
      : ["dist/index.js", "serve", docsRoot];
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stderr = [];
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      rejectMeasurement(
        new Error(
          `Timed out waiting for tools/list. stderr: ${stderr.join("")}`,
        ),
      );
    }, 5_000);
    child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectMeasurement(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!responseMeasurement) {
        rejectMeasurement(
          new Error(
            `Server exited with code ${code} before tools/list. stderr: ${stderr.join("")}`,
          ),
        );
        return;
      }
      resolveMeasurement(responseMeasurement);
    });

    const output = createInterface({ input: child.stdout });
    output.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.id === 1) {
        if (!Array.isArray(message.result?.tools)) {
          settled = true;
          clearTimeout(timeout);
          output.close();
          child.kill();
          rejectMeasurement(new Error(`tools/list failed: ${line}`));
          return;
        }
        const elapsedMs = performance.now() - startedAt;
        responseMeasurement = { elapsedMs, stderr: stderr.join("") };
        output.close();
        child.stdin.end();
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { _meta: meta },
      })}\n`,
    );
  });
}

const measurements = [];
for (let iteration = 0; iteration < iterations; iteration += 1) {
  measurements.push(await measureOnce());
}

const times = measurements.map((result) => result.elapsedMs);
const sortedTimes = [...times].sort((a, b) => a - b);
const executablePath = resolve(benchmarkExecutable ?? process.execPath);
const summary = {
  benchmarkRunnerRuntime: process.version,
  platform: process.platform,
  architecture: process.arch,
  executable: toPortableReportPath(executablePath),
  executableSha256: createHash("sha256")
    .update(readFileSync(executablePath))
    .digest("hex"),
  docsRoot: toPortableReportPath(docsRoot),
  diagnosticMessageCount: measurements.filter((result) => result.stderr.trim())
    .length,
  iterations,
  minMs: Number(Math.min(...times).toFixed(2)),
  medianMs: Number(sortedTimes[Math.floor(times.length / 2)].toFixed(2)),
  p95Ms: Number(
    sortedTimes[Math.ceil(sortedTimes.length * 0.95) - 1].toFixed(2),
  ),
  maxMs: Number(Math.max(...times).toFixed(2)),
  measurementsMs: times.map((time) => Number(time.toFixed(2))),
  hardLimitMs,
  passed: Math.max(...times) < hardLimitMs,
};

const serializedSummary = `${JSON.stringify(summary, null, 2)}\n`;
if (options.output) {
  const outputPath = resolve(options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializedSummary, {
    encoding: "utf8",
    mode: 0o600,
  });
}
process.stdout.write(serializedSummary);
if (!summary.passed) process.exitCode = 1;
