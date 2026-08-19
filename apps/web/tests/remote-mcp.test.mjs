import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  MAX_READINESS_BYTES,
  verifyRemoteMcpReadiness,
} from "../scripts/verify-remote-mcp.mjs";
import { serializeRemoteServerMetadata } from "../integrations/sumi-docs-publisher.mjs";

const revision = `sha256:${"a".repeat(64)}`;
const buildRevision = "0123456789abcdef0123456789abcdef01234567";
const remoteMcp = {
  url: "https://mcp.example.com/mcp",
  readinessUrl: "https://status.example.com/readyz",
  version: "0.1.0",
};

async function fixture() {
  const outputRoot = await mkdtemp(join(tmpdir(), "sumi-docs-remote-mcp-"));
  await mkdir(resolve(outputRoot, "_mcp", "v2"), { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outputRoot, "_mcp", "v2", "current.json"),
      `${JSON.stringify({
        version: 2,
        revision,
        manifest: `snapshots/${"a".repeat(64)}/manifest.json`,
        bytes: 1,
        sha256: "b".repeat(64),
      })}\n`,
    ),
    writeFile(
      resolve(outputRoot, "_mcp", "server.json"),
      serializeRemoteServerMetadata(remoteMcp),
    ),
  ]);
  return outputRoot;
}

test("an unconfigured release skips the probe and requires absent discovery metadata", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "sumi-docs-no-remote-mcp-"));
  try {
    assert.deepEqual(
      await verifyRemoteMcpReadiness({
        outputRoot,
        remoteMcp: undefined,
        fetchImpl: async () => {
          throw new Error("fetch must not be called");
        },
      }),
      { skipped: true },
    );
    await mkdir(resolve(outputRoot, "_mcp"), { recursive: true });
    await writeFile(resolve(outputRoot, "_mcp", "server.json"), "{}\n");
    await assert.rejects(
      verifyRemoteMcpReadiness({ outputRoot, remoteMcp: undefined }),
      /without endpoint configuration/u,
    );
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

function ready(overrides = {}) {
  return {
    status: "ready",
    service: "sumi-docs-mcp",
    version: "0.1.0",
    protocolVersion: "2026-07-28",
    transport: "streamable-http",
    buildRevision,
    corpus: { documentCount: 38, revision },
    ...overrides,
  };
}

test("remote readiness is bound to the built corpus and optional build SHA", async () => {
  const outputRoot = await fixture();
  try {
    const calls = [];
    const result = await verifyRemoteMcpReadiness({
      outputRoot,
      remoteMcp,
      expectedBuildRevision: buildRevision.toUpperCase(),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(ready()), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    assert.deepEqual(result, {
      skipped: false,
      revision,
      buildRevision,
    });
    assert.equal(calls[0].url, remoteMcp.readinessUrl);
    assert.equal(calls[0].options.headers.accept, "application/json");
    assert.ok(calls[0].options.signal instanceof AbortSignal);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

for (const [name, response, expected] of [
  ["service", ready({ service: "other" }), /service identity/u],
  ["version", ready({ version: "0.2.0" }), /version/u],
  ["protocol", ready({ protocolVersion: "2025-11-25" }), /protocol/u],
  [
    "corpus revision",
    ready({
      corpus: { documentCount: 38, revision: `sha256:${"c".repeat(64)}` },
    }),
    /corpus revision/u,
  ],
  [
    "build revision",
    ready({ buildRevision: "f".repeat(40) }),
    /build revision/u,
  ],
  ["build revision type", ready({ buildRevision: 7 }), /build revision/u],
]) {
  test(`rejects a mismatched ${name}`, async () => {
    const outputRoot = await fixture();
    try {
      await assert.rejects(
        verifyRemoteMcpReadiness({
          outputRoot,
          remoteMcp,
          expectedBuildRevision: buildRevision,
          fetchImpl: async () => new Response(JSON.stringify(response)),
        }),
        expected,
      );
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });
}

test("readiness responses are bounded and upstream errors are redacted", async () => {
  const outputRoot = await fixture();
  try {
    await assert.rejects(
      verifyRemoteMcpReadiness({
        outputRoot,
        remoteMcp,
        fetchImpl: async () =>
          new Response("x".repeat(MAX_READINESS_BYTES + 1)),
      }),
      /size limit/u,
    );
    await assert.rejects(
      verifyRemoteMcpReadiness({
        outputRoot,
        remoteMcp,
        fetchImpl: async () => {
          throw new Error("upstream token=super-secret");
        },
      }),
      (error) => {
        assert.match(error.message, /request failed/u);
        assert.doesNotMatch(error.message, /super-secret/u);
        return true;
      },
    );
    await assert.rejects(
      verifyRemoteMcpReadiness({
        outputRoot,
        remoteMcp,
        fetchImpl: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("stream token=super-secret"));
              },
            }),
          ),
      }),
      (error) => {
        assert.match(error.message, /could not be read/u);
        assert.doesNotMatch(error.message, /super-secret/u);
        return true;
      },
    );
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
