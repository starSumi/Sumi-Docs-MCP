import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  InMemoryTransport,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { DocsMcpServer, SERVER_INSTRUCTIONS } from "../../src/mcp/server.js";
import { DocsVault } from "../../src/vfs/DocsVault.js";
import { VERSION } from "../../src/version.js";

async function createFixture(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "guide.md"),
    "# Guide\n\nInstall the server safely.",
  );
  await writeFile(
    join(root, "intro.md"),
    "# Introduction\n\nA stateless documentation service.",
  );
}

function waitForMessage(
  transport: InMemoryTransport,
  id: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for response ${id}`)),
      1_000,
    );
    transport.onmessage = (message) => {
      if (
        message &&
        typeof message === "object" &&
        "id" in message &&
        message.id === id
      ) {
        clearTimeout(timer);
        resolve(message as Record<string, unknown>);
      }
    };
  });
}

async function sendAndWait(
  transport: InMemoryTransport,
  id: number,
  message: Parameters<InMemoryTransport["send"]>[0],
): Promise<Record<string, unknown>> {
  const response = waitForMessage(transport, id);
  await transport.send(message);
  return response;
}

async function connectPair(server: DocsMcpServer): Promise<{
  clientTransport: InMemoryTransport;
  close: () => Promise<void>;
}> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await clientTransport.start();
  return {
    clientTransport,
    close: async () => {
      await server.close();
      await clientTransport.close();
    },
  };
}

test("MCP tools list, search, and fetch round-trip over JSON-RPC", async () => {
  const root = await mkdtemp(join(tmpdir(), "sumi-mcp-"));
  try {
    await createFixture(root);
    const vault = new DocsVault();
    await vault.loadFromDirectory(root);
    const server = new DocsMcpServer(vault, {
      baseUrl: "https://docs.example.com/product",
    });
    const { clientTransport, close } = await connectPair(server);

    const initialized = await sendAndWait(clientTransport, 1, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "integration-test", version: "1.0.0" },
      },
    });
    assert.equal(
      (initialized.result as Record<string, unknown>).serverInfo instanceof
        Object,
      true,
    );
    assert.equal(
      (initialized.result as Record<string, unknown>).instructions,
      SERVER_INSTRUCTIONS,
    );
    assert.ok(SERVER_INSTRUCTIONS.length <= 512);
    assert.match(SERVER_INSTRUCTIONS, /before scanning documentation files/);
    assert.match(SERVER_INSTRUCTIONS, /Source and tests remain authoritative/);
    assert.match(SERVER_INSTRUCTIONS, /host permission control/);
    assert.match(SERVER_INSTRUCTIONS, /client checkpoint persistence/);
    await clientTransport.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });

    const listed = await sendAndWait(clientTransport, 2, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const tools = (
      (listed.result as Record<string, unknown>).tools as Array<
        Record<string, unknown>
      >
    ).map((tool) => tool.name);
    assert.deepEqual(
      new Set(tools),
      new Set(["fetch_doc", "get_openapi_spec", "list_docs", "search_docs"]),
    );

    const searched = await sendAndWait(clientTransport, 3, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "search_docs", arguments: { query: "install" } },
    });
    const searchText =
      (
        (searched.result as Record<string, unknown>).content as Array<{
          text: string;
        }>
      )[0]?.text ?? "";
    assert.match(searchText, /guide\.md/);
    assert.equal(
      (JSON.parse(searchText) as Array<{ url: string }>)[0]?.url,
      "https://docs.example.com/product/guide/",
    );
    assert.equal(
      typeof (searched.result as Record<string, unknown>)._meta,
      "object",
    );

    const fetched = await sendAndWait(clientTransport, 11, {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "fetch_doc", arguments: { path: "guide.md" } },
    });
    const fetchText =
      (
        (fetched.result as Record<string, unknown>).content as Array<{
          text: string;
        }>
      )[0]?.text ?? "";
    assert.equal(
      (JSON.parse(fetchText) as { url: string }).url,
      "https://docs.example.com/product/guide/",
    );

    const documents = await sendAndWait(clientTransport, 12, {
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: { name: "list_docs", arguments: {} },
    });
    const listText =
      (
        (documents.result as Record<string, unknown>).content as Array<{
          text: string;
        }>
      )[0]?.text ?? "";
    assert.deepEqual(
      (JSON.parse(listText) as Array<{ path: string; url: string }>).map(
        ({ path, url }) => ({ path, url }),
      ),
      [
        {
          path: "guide.md",
          url: "https://docs.example.com/product/guide/",
        },
        {
          path: "intro.md",
          url: "https://docs.example.com/product/intro/",
        },
      ],
    );

    const missing = await sendAndWait(clientTransport, 4, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "fetch_doc", arguments: { path: "missing.md" } },
    });
    const missingResult = missing.result as Record<string, unknown>;
    assert.equal(missingResult.isError, true);
    assert.equal(
      (missingResult._meta as Record<string, unknown>).errorCode,
      "PATH_NOT_FOUND",
    );

    await close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("MCP schema rejects invalid tool arguments before handler execution", async () => {
  let providerCalls = 0;
  const server = new DocsMcpServer(async () => {
    providerCalls += 1;
    return new DocsVault();
  });
  const { clientTransport, close } = await connectPair(server);
  try {
    await sendAndWait(clientTransport, 5, {
      jsonrpc: "2.0",
      id: 5,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "integration-test", version: "1.0.0" },
      },
    });
    await clientTransport.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    const cases = [
      { name: "list_docs", arguments: { extra: true } },
      { name: "search_docs", arguments: { query: "" } },
      { name: "fetch_doc", arguments: { path: "../secret.md" } },
      { name: "get_openapi_spec", arguments: { endpoint: "health" } },
      { name: "unknown_tool", arguments: {} },
    ];
    for (const [index, params] of cases.entries()) {
      const invalid = await sendAndWait(clientTransport, 6 + index, {
        jsonrpc: "2.0",
        id: 6 + index,
        method: "tools/call",
        params,
      });
      const result = invalid.result as Record<string, unknown>;
      assert.equal(result.isError, true);
      assert.deepEqual(result.content, [
        { type: "text", text: "Invalid tool request." },
      ]);
      const resultMeta = result._meta as Record<string, unknown>;
      assert.equal(resultMeta.errorCode, "INVALID_INPUT");
      assert.equal(resultMeta.protocolVersion, "2026-07-28");
      assert.deepEqual(resultMeta.capabilities, ["tools"]);
      assert.equal(
        new Date(resultMeta.timestamp as string).toISOString(),
        resultMeta.timestamp,
      );
      assert.doesNotMatch(JSON.stringify(result), /zod|query|secret|health/i);
    }
    assert.equal(providerCalls, 0);
  } finally {
    await close();
  }
});

test("document results omit URLs when no base URL is configured", async () => {
  const root = await mkdtemp(join(tmpdir(), "sumi-mcp-"));
  try {
    await createFixture(root);
    const vault = new DocsVault();
    await vault.loadFromDirectory(root);
    const server = new DocsMcpServer(vault);
    const { clientTransport, close } = await connectPair(server);
    try {
      await sendAndWait(clientTransport, 13, {
        jsonrpc: "2.0",
        id: 13,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "integration-test", version: "1.0.0" },
        },
      });
      await clientTransport.send({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      });
      const documents = await sendAndWait(clientTransport, 14, {
        jsonrpc: "2.0",
        id: 14,
        method: "tools/call",
        params: { name: "list_docs", arguments: {} },
      });
      const listText =
        (
          (documents.result as Record<string, unknown>).content as Array<{
            text: string;
          }>
        )[0]?.text ?? "";
      assert.equal(
        "url" in (JSON.parse(listText) as Array<Record<string, unknown>>)[0]!,
        false,
      );
    } finally {
      await close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stdio entry normalizes a 2026 first-request validation error without initialize", async () => {
  const vault = new DocsVault();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const handle = serveStdio(() => new DocsMcpServer(vault).server, {
    legacy: "reject",
    transport: serverTransport,
  });
  const requestMeta = {
    [PROTOCOL_VERSION_META_KEY]: "2026-07-28",
    [CLIENT_INFO_META_KEY]: { name: "integration-test", version: "1.0.0" },
    [CLIENT_CAPABILITIES_META_KEY]: {},
  };

  try {
    await clientTransport.start();
    const invalid = await sendAndWait(clientTransport, 7, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "search_docs",
        arguments: { query: "" },
        _meta: requestMeta,
      },
    });
    const invalidResult = invalid.result as Record<string, unknown>;
    assert.equal(invalidResult.isError, true);
    assert.equal(
      (invalidResult._meta as Record<string, unknown>).errorCode,
      "INVALID_INPUT",
    );

    const listed = await sendAndWait(clientTransport, 8, {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/list",
      params: { _meta: requestMeta },
    });
    const result = listed.result as Record<string, unknown>;
    assert.equal(Array.isArray(result.tools), true);
    assert.equal(typeof result._meta, "object");
    assert.equal(
      (
        (result._meta as Record<string, unknown>)[
          "io.modelcontextprotocol/serverInfo"
        ] as Record<string, unknown>
      ).version,
      VERSION,
    );

    const discovered = await sendAndWait(clientTransport, 15, {
      jsonrpc: "2.0",
      id: 15,
      method: "server/discover",
      params: { _meta: requestMeta },
    });
    assert.deepEqual(
      (discovered.result as Record<string, unknown>).supportedVersions,
      ["2026-07-28"],
    );
  } finally {
    await handle.close();
    await clientTransport.close();
  }
});

test("tools/list does not wait for the documentation vault to finish loading", async () => {
  let resolveVault!: (vault: DocsVault) => void;
  const vaultReady = new Promise<DocsVault>((resolve) => {
    resolveVault = resolve;
  });
  let providerCalls = 0;
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const handle = serveStdio(
    () =>
      new DocsMcpServer(() => {
        providerCalls += 1;
        return vaultReady;
      }).server,
    {
      legacy: "reject",
      transport: serverTransport,
    },
  );
  const requestMeta = {
    [PROTOCOL_VERSION_META_KEY]: "2026-07-28",
    [CLIENT_INFO_META_KEY]: { name: "integration-test", version: "1.0.0" },
    [CLIENT_CAPABILITIES_META_KEY]: {},
  };

  try {
    await clientTransport.start();
    const listed = await sendAndWait(clientTransport, 9, {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/list",
      params: { _meta: requestMeta },
    });
    assert.equal(
      Array.isArray((listed.result as Record<string, unknown>).tools),
      true,
    );
    assert.equal(providerCalls, 0);

    resolveVault(new DocsVault());
    const called = await sendAndWait(clientTransport, 10, {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "list_docs", arguments: {}, _meta: requestMeta },
    });
    assert.notEqual((called.result as Record<string, unknown>).isError, true);
    assert.equal(providerCalls, 1);
  } finally {
    await handle.close();
    await clientTransport.close();
  }
});
