/**
 * Benchmark-only raw responder for measuring process spawn, pipes, and one
 * newline-delimited JSON round trip. This is not an MCP implementation and
 * must never be used as the product server.
 */

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const newlineIndex = buffer.indexOf("\n");
  if (newlineIndex === -1) return;

  const line = buffer.slice(0, newlineIndex);
  process.stdin.pause();
  try {
    const request = JSON.parse(line);
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { tools: [] } })}\n`,
    );
  } catch {
    process.exitCode = 1;
  }
});
