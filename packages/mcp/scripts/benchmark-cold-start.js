import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import {
  createBlockedSchedule,
  createColdStartReport,
  digestSchedule,
  EXPECTED_TOOL_NAMES,
} from "./cold-start-policy.mjs";
import {
  HARD_KILL_AFTER_MS,
  MAX_STDERR_BYTES,
  MAX_STDOUT_BYTES,
  measureOnce,
  TIMEOUT_MS,
} from "./cold-start-measurement.mjs";
import { toPortableReportPath } from "./report-path.mjs";

const DEFAULT_PROBES = Object.freeze({
  raw: {
    executable: resolve("artifacts/bin/sumi-docs-benchmark-raw.exe"),
    source: resolve("scripts/benchmark-raw-responder.js"),
    seaConfig: resolve("scripts/benchmark-raw-sea-config.json"),
  },
  sdkEmpty: {
    executable: resolve("artifacts/bin/sumi-docs-benchmark-sdk-empty.exe"),
    source: resolve("scripts/benchmark-sdk-empty.js"),
    seaConfig: resolve("scripts/benchmark-sdk-empty-sea-config.json"),
  },
});
const options = minimist(process.argv.slice(2), {
  string: [
    "docs",
    "executable",
    "iterations",
    "output",
    "raw-executable",
    "sdk-executable",
    "seed",
  ],
  default: { docs: "examples/basic/docs", iterations: "100" },
});

let report;
try {
  report = await runBenchmark();
} catch (error) {
  report = createSetupFailureReport(error);
}
emitReport(report);
if (!report.policy.passed) process.exitCode = 1;

async function runBenchmark() {
  const docsRoot = resolve(options.docs);
  const iterations = Number(options.iterations);
  const seed = options.seed
    ? Number(options.seed)
    : randomBytes(4).readUInt32LE(0);
  validateOptions(iterations, seed);

  const customBaselines = Boolean(
    options["raw-executable"] || options["sdk-executable"],
  );
  if (
    options.executable &&
    (!options["raw-executable"] || !options["sdk-executable"])
  ) {
    buildDefaultProbeExecutables();
  }

  const subjects = resolveSubjects(options, docsRoot);
  validateSubjectPaths(subjects);
  const scheduleOrder = createBlockedSchedule(iterations, seed);
  const outcomes = { raw: [], sdkEmpty: [], product: [] };

  for (const [index, subjectName] of scheduleOrder.entries()) {
    outcomes[subjectName].push(await measureOnce(subjects[subjectName]));
    if ((index + 1) % 25 === 0 || index + 1 === scheduleOrder.length) {
      process.stderr.write(
        `cold-start benchmark progress: ${index + 1}/${scheduleOrder.length}\n`,
      );
    }
  }

  return createColdStartReport({
    generatedAt: new Date().toISOString(),
    environment: environmentEvidence(),
    method: {
      measurement: "process-spawn-to-first-tools-list-response",
      clock: "performance.now",
      requestProtocolVersion: "2026-07-28",
      initializeRequired: false,
      iterationsPerSubject: iterations,
      totalAttempts: scheduleOrder.length,
      timeoutMs: TIMEOUT_MS,
      initialTerminationSignal: "SIGTERM",
      platformTerminationSemantics:
        process.platform === "win32"
          ? "forceful-termination-with-bounded-retry"
          : "termination-request-then-forceful-kill",
      hardKillAfterMs: HARD_KILL_AFTER_MS,
      maxStdoutBytes: MAX_STDOUT_BYTES,
      maxStderrBytes: MAX_STDERR_BYTES,
      schedule: "seeded-randomized-subject-blocks",
      scheduleBlocks: iterations,
      scheduleOrder,
      scheduleSha256: digestSchedule(scheduleOrder),
      seed,
      execution: "sequential-one-child-at-a-time",
      probePreparation: options.executable
        ? "default-probes-built-before-measurement"
        : "source-entry-probes",
      customBaselines,
      evidenceIntent:
        iterations === 100 && options.executable && !customBaselines
          ? "release-candidate"
          : "ad-hoc",
      median: "average-of-two-middle-values",
      p95: "nearest-rank",
      p99: "nearest-rank-diagnostic-only",
      max: "diagnostic-only",
      docsRoot: toPortableReportPath(docsRoot),
    },
    subjectDefinitions: describeSubjects(subjects),
    outcomes,
    diagnosticReplacements: diagnosticReplacements(docsRoot, subjects),
  });
}

function validateOptions(iterations, seed) {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error("--iterations must be a positive integer.");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("--seed must be an unsigned 32-bit integer.");
  }
  if (options._.length > 0) {
    throw new Error(
      `Unexpected positional arguments: ${options._.join(" ")}. Pass pnpm script options without a standalone --.`,
    );
  }
}

function resolveSubjects(parsedOptions, docsRoot) {
  if (parsedOptions.executable) {
    return {
      raw: executableSubject(
        "raw",
        parsedOptions["raw-executable"] ?? DEFAULT_PROBES.raw.executable,
        [],
        !parsedOptions["raw-executable"],
      ),
      sdkEmpty: executableSubject(
        "sdkEmpty",
        parsedOptions["sdk-executable"] ?? DEFAULT_PROBES.sdkEmpty.executable,
        [],
        !parsedOptions["sdk-executable"],
      ),
      product: executableSubject(
        "product",
        parsedOptions.executable,
        ["serve", docsRoot],
        false,
      ),
    };
  }

  return {
    raw: parsedOptions["raw-executable"]
      ? executableSubject("raw", parsedOptions["raw-executable"], [], false)
      : nodeSubject("raw", DEFAULT_PROBES.raw.source, true),
    sdkEmpty: parsedOptions["sdk-executable"]
      ? executableSubject(
          "sdkEmpty",
          parsedOptions["sdk-executable"],
          [],
          false,
        )
      : nodeSubject("sdkEmpty", DEFAULT_PROBES.sdkEmpty.source, true),
    product: nodeSubject("product", resolve("dist/index.js"), false, [
      "serve",
      docsRoot,
    ]),
  };
}

function executableSubject(name, executable, args, isRepositoryDefaultProbe) {
  const command = resolve(executable);
  return {
    name,
    command,
    args,
    entryPath: undefined,
    executionKind:
      extname(command).toLowerCase() === ".exe" ? "sea" : "external-executable",
    expectedToolNames: EXPECTED_TOOL_NAMES[name],
    isRepositoryDefaultProbe,
  };
}

function nodeSubject(name, entryPath, isRepositoryDefaultProbe, args = []) {
  return {
    name,
    command: process.execPath,
    args: [entryPath, ...args],
    entryPath,
    executionKind: "node-source",
    expectedToolNames: EXPECTED_TOOL_NAMES[name],
    isRepositoryDefaultProbe,
  };
}

function describeSubjects(subjects) {
  const sdkPackage = readInstalledSdkPackage();
  return {
    raw: describeSubject(
      subjects.raw,
      "measurement-baseline-only",
      "Benchmark-only raw newline JSON responder with an explicit empty-tools contract; not an MCP or product implementation.",
      DEFAULT_PROBES.raw,
      undefined,
    ),
    sdkEmpty: describeSubject(
      subjects.sdkEmpty,
      subjects.sdkEmpty.isRepositoryDefaultProbe
        ? "official-sdk-empty-baseline"
        : "custom-sdk-baseline",
      subjects.sdkEmpty.isRepositoryDefaultProbe
        ? "Official public McpServer and serveStdio APIs with empty tools and the default validator configuration."
        : "Operator-supplied SDK comparison executable; not trusted as official release evidence.",
      DEFAULT_PROBES.sdkEmpty,
      sdkPackage,
    ),
    product: describeSubject(
      subjects.product,
      "product",
      "Sumi Docs MCP product entry serving the requested documentation root.",
    ),
  };
}

function describeSubject(subject, role, description, defaultProbe, sdkPackage) {
  const trustedBaseline =
    subject.isRepositoryDefaultProbe && subject.executionKind === "sea";
  return {
    role,
    description,
    executionKind: subject.executionKind,
    command: toPortableReportPath(subject.command),
    arguments: subject.args.map(portableArgument),
    executableSha256: sha256(subject.command),
    expectedToolNames: [...subject.expectedToolNames],
    ...(subject.name !== "product" && {
      isRepositoryDefaultBaseline: subject.isRepositoryDefaultProbe,
      isTrustedBaseline: trustedBaseline,
      usesOfficialSdkPublicApi:
        subject.name === "sdkEmpty" && subject.isRepositoryDefaultProbe,
    }),
    ...(subject.entryPath && {
      entry: toPortableReportPath(subject.entryPath),
      entrySha256: sha256(subject.entryPath),
    }),
    ...(subject.isRepositoryDefaultProbe && defaultProbe
      ? {
          source: toPortableReportPath(defaultProbe.source),
          sourceSha256: sha256(defaultProbe.source),
          seaConfig: toPortableReportPath(defaultProbe.seaConfig),
          seaConfigSha256: sha256(defaultProbe.seaConfig),
        }
      : {}),
    ...(subject.name === "sdkEmpty" && subject.isRepositoryDefaultProbe
      ? { sdkPackage }
      : {}),
  };
}

function validateSubjectPaths(subjects) {
  for (const subject of Object.values(subjects)) {
    if (
      !existsSync(subject.command) ||
      (subject.entryPath && !existsSync(subject.entryPath))
    ) {
      const missingPath = existsSync(subject.command)
        ? subject.entryPath
        : subject.command;
      throw new Error(
        `Missing ${subject.name} executable or entry: ${missingPath}`,
      );
    }
  }
}

function buildDefaultProbeExecutables() {
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/build-benchmark-probes.js")],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "inherit"],
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Failed to build benchmark probes (exit code ${result.status ?? "unknown"}).`,
    );
  }
}

function readInstalledSdkPackage() {
  const resolvedEntryPath = fileURLToPath(
    import.meta.resolve("@modelcontextprotocol/server"),
  );
  let current = dirname(resolvedEntryPath);
  while (true) {
    const manifestPath = join(current, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.name === "@modelcontextprotocol/server") {
        return {
          name: manifest.name,
          version: manifest.version,
          entrySha256: sha256(resolvedEntryPath),
        };
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("Unable to locate the installed MCP SDK package metadata.");
}

function createSetupFailureReport(error) {
  const customBaselines = Boolean(
    options["raw-executable"] || options["sdk-executable"],
  );
  return createColdStartReport({
    generatedAt: new Date().toISOString(),
    environment: environmentEvidence(),
    method: {
      measurement: "setup-failure-before-measurement",
      iterationsPerSubject: Number(options.iterations),
      totalAttempts: 0,
      timeoutMs: TIMEOUT_MS,
      hardKillAfterMs: HARD_KILL_AFTER_MS,
      maxStdoutBytes: MAX_STDOUT_BYTES,
      maxStderrBytes: MAX_STDERR_BYTES,
      schedule: "seeded-randomized-subject-blocks",
      scheduleOrder: [],
      scheduleSha256: digestSchedule([]),
      customBaselines,
      evidenceIntent: "ad-hoc",
      setupFailed: true,
    },
    subjectDefinitions: {
      raw: failureDefinition("measurement-baseline-only"),
      sdkEmpty: failureDefinition("sdk-baseline"),
      product: { role: "product", executionKind: "unavailable" },
    },
    outcomes: {
      raw: [{ status: "error", message: diagnostic(error) }],
      sdkEmpty: [],
      product: [],
    },
    diagnosticReplacements: [
      { value: process.cwd(), placeholder: "<benchmark-workspace>" },
    ],
  });
}

function failureDefinition(role) {
  return {
    role,
    executionKind: "unavailable",
    isRepositoryDefaultBaseline: false,
    isTrustedBaseline: false,
    usesOfficialSdkPublicApi: false,
  };
}

function emitReport(currentReport) {
  const serialized = `${JSON.stringify(currentReport, null, 2)}\n`;
  if (options.output) {
    const outputPath = resolve(options.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serialized, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
  process.stdout.write(serialized);
}

function environmentEvidence() {
  return {
    runtime: process.version,
    platform: process.platform,
    architecture: process.arch,
    osRelease: release(),
    cpuModel: cpus()[0]?.model ?? "unknown",
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    runnerExecutable: toPortableReportPath(process.execPath),
    runnerExecutableSha256: sha256(process.execPath),
  };
}

function diagnosticReplacements(docsRoot, subjects) {
  return [
    { value: docsRoot, placeholder: "<docs-root>" },
    { value: process.cwd(), placeholder: "<benchmark-workspace>" },
    ...Object.entries(subjects).flatMap(([name, subject]) => [
      { value: subject.command, placeholder: `<${name}-command>` },
      ...(subject.entryPath
        ? [{ value: subject.entryPath, placeholder: `<${name}-entry>` }]
        : []),
    ]),
  ];
}

function portableArgument(argument) {
  if (typeof argument !== "string") return argument;
  return argument.includes(":\\") || argument.includes(":/")
    ? toPortableReportPath(argument)
    : argument;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function diagnostic(value) {
  return value instanceof Error ? value.message : String(value);
}
