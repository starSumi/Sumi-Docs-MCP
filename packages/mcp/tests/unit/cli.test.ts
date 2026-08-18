import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCliOptions, parseDoctorOptions } from "../../src/cli.js";

test("parseCliOptions accepts the documented stdio command", () => {
  assert.deepEqual(
    parseCliOptions([
      "serve",
      "examples/basic/docs",
      "--openapi",
      "examples/basic/openapi.json",
      "--base-url",
      "https://docs.example.com/product",
      "--transport",
      "stdio",
      "--verbose",
    ]),
    {
      docsSource: "examples/basic/docs",
      openApiPath: "examples/basic/openapi.json",
      baseUrl: "https://docs.example.com/product/",
      transport: "stdio",
      verbose: true,
    },
  );
});

test("parseCliOptions accepts a remote documentation manifest", () => {
  assert.deepEqual(
    parseCliOptions([
      "serve",
      "https://raw.example.com/docs/sumi-docs-manifest.json",
    ]),
    {
      docsSource: "https://raw.example.com/docs/sumi-docs-manifest.json",
      openApiPath: undefined,
      baseUrl: undefined,
      transport: "stdio",
      verbose: false,
    },
  );
});

test("parseCliOptions accepts discovery and explicit config", () => {
  assert.deepEqual(parseCliOptions(["serve"]), {
    docsSource: undefined,
    openApiPath: undefined,
    baseUrl: undefined,
    transport: "stdio",
    verbose: false,
  });
  assert.deepEqual(
    parseCliOptions(["serve", "--config", "config/sumi-docs.json"]),
    {
      docsSource: undefined,
      openApiPath: undefined,
      baseUrl: undefined,
      configPath: "config/sumi-docs.json",
      transport: "stdio",
      verbose: false,
    },
  );
});

test("parseDoctorOptions accepts the JSON diagnostic mode", () => {
  assert.deepEqual(parseDoctorOptions(["doctor", "--json"]), {
    options: {
      docsSource: undefined,
      openApiPath: undefined,
      baseUrl: undefined,
      transport: "stdio",
      verbose: false,
    },
    json: true,
    showPaths: false,
  });
});

test("parseDoctorOptions supports explicit path disclosure only for doctor", () => {
  assert.deepEqual(parseDoctorOptions(["doctor", "--show-paths"]), {
    options: {
      docsSource: undefined,
      openApiPath: undefined,
      baseUrl: undefined,
      transport: "stdio",
      verbose: false,
    },
    json: false,
    showPaths: true,
  });
  assert.throws(
    () => parseCliOptions(["serve", "--show-paths"]),
    /only by the doctor command/i,
  );
  assert.throws(
    () => parseDoctorOptions(["doctor", "--show-paths=true"]),
    /does not accept a value/i,
  );
});

test("config path requires a value", () => {
  assert.throws(
    () => parseCliOptions(["serve", "--config"]),
    /--config requires/i,
  );
});

test("parseCliOptions rejects missing commands and unsupported transports", () => {
  assert.throws(() => parseCliOptions(["--transport", "stdio"]), /Usage:/);
  assert.throws(
    () =>
      parseCliOptions(["serve", "examples/basic/docs", "--transport", "http"]),
    /only stdio/,
  );
});

test("parseCliOptions rejects unsafe or ambiguous base URLs", () => {
  for (const baseUrl of [
    "file:///C:/docs",
    "https://user:secret@docs.example.com",
    "https://docs.example.com?version=latest",
    "https://docs.example.com#start",
    "not-a-url",
  ]) {
    assert.throws(
      () =>
        parseCliOptions([
          "serve",
          "examples/basic/docs",
          "--base-url",
          baseUrl,
        ]),
      /base URL/i,
    );
  }
});

test("parseCliOptions rejects unsafe remote documentation URLs eagerly", () => {
  for (const docsSource of [
    "http://docs.example.com/product/",
    "https://user:secret@docs.example.com/product/",
    "https://docs.example.com/product/?revision=latest",
    "https://docs.example.com/product/#start",
  ]) {
    assert.throws(
      () => parseCliOptions(["serve", docsSource]),
      /remote documentation/i,
    );
  }

  assert.throws(
    () =>
      parseCliOptions([
        "serve",
        "https://docs.example.com/product/",
        "--openapi",
        "openapi.json",
      ]),
    /local-only/i,
  );
});
