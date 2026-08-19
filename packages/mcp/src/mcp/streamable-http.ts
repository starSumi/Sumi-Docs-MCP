import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createMcpHandler,
  PROTOCOL_VERSION_META_KEY,
  type McpServer,
} from "@modelcontextprotocol/server";
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { sanitizeDiagnostic } from "../utils/diagnostics.js";
import { VERSION } from "../version.js";
import { PROTOCOL_VERSION } from "./server.js";

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
export const HEALTH_PATH = "/healthz";
export const READINESS_PATH = "/readyz";

export interface StreamableHttpReadiness {
  documentCount: number;
  corpusRevision?: string;
}

export interface StreamableHttpServerOptions {
  host: string;
  port: number;
  path: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  maxBodyBytes?: number;
  buildRevision?: string;
  readiness?: StreamableHttpReadiness;
}

export interface StreamableHttpServerHandle {
  url: string;
  close(): Promise<void>;
}

type ParsedBody =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; message: string };

function writeJsonError(
  response: import("node:http").ServerResponse,
  status: number,
  message: string,
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    connection: "close",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify({ error: message }));
}

function writeJsonRpcError(
  response: import("node:http").ServerResponse,
  status: number,
  id: string | number | null,
  code: number,
  message: string,
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    connection: "close",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
  );
}

function writeJson(
  response: import("node:http").ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function readJsonBody(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<ParsedBody> {
  const declaredLength = request.headers["content-length"];
  if (
    typeof declaredLength === "string" &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBodyBytes
  ) {
    request.resume();
    return { ok: false, status: 413, message: "Request body is too large." };
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  let oversized = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxBodyBytes) {
      oversized = true;
      continue;
    }
    chunks.push(buffer);
  }
  if (oversized) {
    return { ok: false, status: 413, message: "Request body is too large." };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    };
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Request body must be valid JSON.",
    };
  }
}

function requestId(value: unknown): string | number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function requestProtocolVersion(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const params = (value as { params?: unknown }).params;
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    return undefined;
  }
  const meta = (params as { _meta?: unknown })._meta;
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  return (meta as Record<string, unknown>)[PROTOCOL_VERSION_META_KEY];
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

/** Serve the stateless 2026 MCP surface over a bounded Node.js HTTP endpoint. */
export async function serveStreamableHttp(
  factory: () => McpServer,
  options: StreamableHttpServerOptions,
): Promise<StreamableHttpServerHandle> {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error("maxBodyBytes must be a positive integer.");
  }

  const handler = createMcpHandler(factory, {
    legacy: "reject",
    responseMode: "auto",
    onerror: (error) =>
      console.error(
        `Streamable HTTP protocol error: ${sanitizeDiagnostic(error)}`,
      ),
  });
  const nodeHandler = toNodeHandler(handler, {
    onerror: (error) =>
      console.error(
        `Streamable HTTP adapter error: ${sanitizeDiagnostic(error)}`,
      ),
  });
  const validateHost =
    options.allowedHosts.length > 0
      ? hostHeaderValidation(options.allowedHosts)
      : localhostHostValidation();
  const validateOrigin =
    options.allowedOrigins.length > 0
      ? originValidation(options.allowedOrigins)
      : localhostOriginValidation();

  const server = createServer((request, response) => {
    response.setHeader("x-content-type-options", "nosniff");
    void (async () => {
      if (
        !validateHost(request, response) ||
        !validateOrigin(request, response)
      ) {
        return;
      }
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      if (
        (requestUrl.pathname === HEALTH_PATH ||
          requestUrl.pathname === READINESS_PATH) &&
        requestUrl.search.length === 0
      ) {
        if (request.method !== "GET") {
          writeJsonError(response, 405, "Method not allowed.");
          return;
        }
        const identity = {
          service: "sumi-docs-mcp",
          version: VERSION,
          protocolVersion: PROTOCOL_VERSION,
          transport: "streamable-http",
          buildRevision: options.buildRevision ?? null,
        } as const;
        if (requestUrl.pathname === HEALTH_PATH) {
          writeJson(response, 200, { status: "ok", ...identity });
          return;
        }
        if (!options.readiness) {
          writeJson(response, 503, {
            status: "unavailable",
            service: "sumi-docs-mcp",
          });
          return;
        }
        writeJson(response, 200, {
          status: "ready",
          ...identity,
          corpus: {
            documentCount: options.readiness.documentCount,
            revision: options.readiness.corpusRevision ?? null,
          },
        });
        return;
      }
      if (
        requestUrl.pathname !== options.path ||
        requestUrl.search.length > 0
      ) {
        writeJsonError(response, 404, "Not found.");
        return;
      }
      if (request.method === "POST") {
        const body = await readJsonBody(request, maxBodyBytes);
        if (!body.ok) {
          if (body.status === 400) {
            writeJsonRpcError(response, 400, null, -32700, "Parse error.");
          } else {
            writeJsonError(response, body.status, body.message);
          }
          return;
        }
        const protocolVersion = request.headers["mcp-protocol-version"];
        if (
          typeof protocolVersion !== "string" ||
          requestProtocolVersion(body.value) !== protocolVersion
        ) {
          writeJsonRpcError(
            response,
            400,
            requestId(body.value),
            -32020,
            "Required MCP request metadata is missing or mismatched.",
          );
          return;
        }
        await nodeHandler(request, response, body.value);
        return;
      }
      await nodeHandler(request, response);
    })().catch((error) => {
      console.error(
        `Streamable HTTP request failed: ${sanitizeDiagnostic(error)}`,
      );
      if (!response.headersSent)
        writeJsonError(response, 500, "Internal server error.");
      else response.end();
    });
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port, options.host);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    await handler.close();
    await closeServer(server);
    throw new Error("HTTP server did not bind to a TCP address.");
  }
  const tcpAddress: AddressInfo = address;
  const urlHost = options.host.includes(":")
    ? `[${options.host.replace(/^\[|\]$/g, "")}]`
    : options.host;
  let closed = false;
  return {
    url: `http://${urlHost}:${tcpAddress.port}${options.path}`,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await Promise.all([handler.close(), closeServer(server)]);
    },
  };
}
