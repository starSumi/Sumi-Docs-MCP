import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { validateToolsListResponse } from "./cold-start-policy.mjs";

export const TIMEOUT_MS = 5_000;
export const HARD_KILL_AFTER_MS = 2_000;
export const MAX_STDOUT_BYTES = 64 * 1024;
export const MAX_STDERR_BYTES = 64 * 1024;

export function measureOnce(
  subject,
  {
    timeoutMs = TIMEOUT_MS,
    hardKillAfterMs = HARD_KILL_AFTER_MS,
    maxStdoutBytes = MAX_STDOUT_BYTES,
    maxStderrBytes = MAX_STDERR_BYTES,
  } = {},
) {
  return new Promise((resolveMeasurement) => {
    const startedAt = performance.now();
    let child;
    try {
      child = spawn(subject.command, subject.args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolveMeasurement({ status: "error", message: diagnostic(error) });
      return;
    }

    let resolved = false;
    let stopping = false;
    let outcome;
    let stdout = "";
    let stderr = "";
    let stderrTruncated = false;
    let hardKillTimer;
    const responseTimer = setTimeout(() => {
      stop({
        status: "timeout",
        message: `No tools/list response within ${timeoutMs} ms.${stderrSuffix(stderr, stderrTruncated)}`,
      });
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      const appended = appendBounded(stderr, chunk, maxStderrBytes);
      stderr = appended.value;
      stderrTruncated ||= appended.exceeded;
    });
    child.stdout.on("data", (chunk) => {
      if (stopping) return;
      const appended = appendBounded(stdout, chunk, maxStdoutBytes);
      stdout = appended.value;

      while (stdout.includes("\n")) {
        const newlineIndex = stdout.indexOf("\n");
        const line = stdout.slice(0, newlineIndex).trim();
        stdout = stdout.slice(newlineIndex + 1);
        if (!line) continue;

        let message;
        try {
          message = JSON.parse(line);
        } catch {
          stop({
            status: "error",
            message: "Invalid JSON in the tools/list response.",
          });
          return;
        }
        const validation = validateToolsListResponse(message, {
          id: 1,
          expectedToolNames: subject.expectedToolNames,
        });
        if (!validation.ok) {
          stop({
            status: "error",
            message: `Invalid tools/list response: ${validation.message}${stderrSuffix(stderr, stderrTruncated)}`,
          });
          return;
        }
        stop({
          status: "ok",
          elapsedMs: performance.now() - startedAt,
        });
        return;
      }

      if (appended.exceeded) {
        stop({
          status: "error",
          message: `stdout exceeded ${maxStdoutBytes} bytes before a complete tools/list response.`,
        });
      }
    });
    child.once("error", (error) => {
      stop({ status: "error", message: diagnostic(error) });
    });
    child.once("close", (code) => {
      if (!stopping) {
        outcome = {
          status: "error",
          message: `Process exited with code ${code} before tools/list.${stderrSuffix(stderr, stderrTruncated)}`,
        };
      }
      finish();
    });
    child.stdin.on("error", (error) => {
      stop({ status: "error", message: diagnostic(error) });
    });

    child.stdin.write(`${JSON.stringify(toolsListRequest())}\n`);

    function stop(result) {
      if (stopping || resolved) return;
      stopping = true;
      outcome = result;
      clearTimeout(responseTimer);
      child.stdin.destroy();
      try {
        if (child.exitCode === null) child.kill("SIGTERM");
      } catch {
        // The hard-kill timer below still provides a bounded completion path.
      }
      hardKillTimer = setTimeout(() => {
        try {
          if (child.exitCode === null) child.kill("SIGKILL");
        } finally {
          finish();
        }
      }, hardKillAfterMs);
    }

    function finish() {
      if (resolved) return;
      resolved = true;
      clearTimeout(responseTimer);
      clearTimeout(hardKillTimer);
      resolveMeasurement(
        outcome ?? {
          status: "error",
          message: "Measurement ended without an outcome.",
        },
      );
    }
  });
}

function toolsListRequest() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {
          name: "cold-start-benchmark",
          version: "2.0.0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

function appendBounded(current, chunk, maximumBytes) {
  const currentBytes = Buffer.byteLength(current);
  const remainingBytes = Math.max(0, maximumBytes - currentBytes);
  const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  if (incoming.length <= remainingBytes) {
    return { value: current + incoming.toString("utf8"), exceeded: false };
  }
  return {
    value: current + incoming.subarray(0, remainingBytes).toString("utf8"),
    exceeded: true,
  };
}

function diagnostic(value) {
  return value instanceof Error ? value.message : String(value);
}

function stderrSuffix(stderr, truncated) {
  const value = stderr.trim();
  if (!value && !truncated) return "";
  return ` stderr: ${value}${truncated ? " [truncated]" : ""}`;
}
