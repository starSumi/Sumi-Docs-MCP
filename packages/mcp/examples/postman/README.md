# Postman protocol probes

Import `sumi-docs-mcp.postman_collection.json` into Postman and run it against
an already running Streamable HTTP server. The collection defaults to
`http://127.0.0.1:3000` and exercises liveness, readiness, protocol discovery,
tool discovery, and the three documentation read operations.

The collection is a manual protocol probe, not an MCP client configuration. It
does not contain credentials, session identifiers, or a private corpus address.
Set `expected_build_revision` only when the deployment publishes a full Git SHA
or `sha256:` revision.
