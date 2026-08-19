import { createHash } from "node:crypto";

export const SUBJECT_NAMES = Object.freeze(["raw", "sdkEmpty", "product"]);
export const EXPECTED_TOOL_NAMES = Object.freeze({
  raw: Object.freeze([]),
  sdkEmpty: Object.freeze([]),
  product: Object.freeze([
    "list_docs",
    "search_docs",
    "fetch_doc",
    "get_openapi_spec",
  ]),
});

export const COLD_START_POLICY = Object.freeze({
  errors: 0,
  timeouts: 0,
  productMedianMs: 200,
  productP95Ms: 350,
  medianDeltaMs: 35,
  medianRatio: 1.3,
  p95DeltaMs: 75,
});

export function summarizeMeasurements(outcomes) {
  const measurementsMs = outcomes
    .filter(
      (outcome) =>
        outcome.status === "ok" &&
        Number.isFinite(outcome.elapsedMs) &&
        outcome.elapsedMs >= 0,
    )
    .map((outcome) => outcome.elapsedMs)
    .sort((left, right) => left - right);
  const errors = outcomes.filter((outcome) => outcome.status === "error");
  const timeouts = outcomes.filter((outcome) => outcome.status === "timeout");
  const unknown = outcomes.filter(
    (outcome) =>
      !["error", "timeout"].includes(outcome.status) &&
      !(
        outcome.status === "ok" &&
        Number.isFinite(outcome.elapsedMs) &&
        outcome.elapsedMs >= 0
      ),
  );

  return {
    attempted: outcomes.length,
    samples: measurementsMs.length,
    medianMs: median(measurementsMs),
    p95Ms: nearestRank(measurementsMs, 0.95),
    p99Ms: nearestRank(measurementsMs, 0.99),
    maxMs:
      measurementsMs.length === 0
        ? null
        : round(measurementsMs[measurementsMs.length - 1]),
    errors: errors.length,
    timeouts: timeouts.length,
    unknownStatuses: unknown.length,
    measurementsMs: measurementsMs.map((measurement) => round(measurement)),
    errorDetails: errors.map(outcomeMessage).slice(0, 10),
    timeoutDetails: timeouts.map(outcomeMessage).slice(0, 10),
    unknownStatusDetails: unknown
      .map((outcome) => `Unknown outcome status: ${String(outcome.status)}`)
      .slice(0, 10),
  };
}

export function sanitizeBenchmarkDiagnostic(value, replacements = []) {
  let sanitized = String(value);
  const orderedReplacements = [...replacements]
    .filter(
      (replacement) =>
        typeof replacement.value === "string" && replacement.value.length > 0,
    )
    .sort((left, right) => right.value.length - left.value.length);

  for (const { value: sensitiveValue, placeholder } of orderedReplacements) {
    const variants = new Set([
      sensitiveValue,
      sensitiveValue.replaceAll("\\", "/"),
      sensitiveValue.replaceAll("/", "\\"),
    ]);
    for (const variant of variants) {
      sanitized = sanitized.replace(
        new RegExp(escapeRegExp(variant), "giu"),
        placeholder,
      );
    }
  }

  const preservedUrls = [];
  sanitized = sanitized.replace(
    /[a-z][a-z\d+.-]*:\/\/[^\s<>"']+/giu,
    (candidate) => {
      try {
        const url = new URL(candidate);
        if (url.username || url.password || hasSensitiveQuery(url)) {
          return "<credential-url>";
        }
      } catch {
        return candidate;
      }
      const placeholder = `<preserved-url-${preservedUrls.length}>`;
      preservedUrls.push([placeholder, candidate]);
      return placeholder;
    },
  );

  sanitized = sanitized
    .replace(
      /\b(?:proxy-)?authorization\s*:\s*(?:(?:basic|bearer|digest|token)\s+)?[^\s,;]+/giu,
      "<credential>",
    )
    .replace(
      /\b(?:token|secret|password|passwd|credential|signature|api[_-]?key|access[_-]?(?:key|token)|session[_-]?(?:key|token)|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      "<credential>",
    );

  sanitized = sanitized
    .replace(/\\\\[^\\\s]+\\[^\\\s]+(?:\\[^\\\s]+)*/gu, "<absolute-path>")
    .replace(/\b[A-Za-z]:[\\/][^\s<>"'|]*/gu, "<absolute-path>")
    .replace(/(?<![:\w/])\/(?:[^/\s<>"']+\/)*[^/\s<>"']+/gu, "<absolute-path>");

  for (const [placeholder, url] of preservedUrls) {
    sanitized = sanitized.replaceAll(placeholder, url);
  }

  return sanitized
    .split(/\r?\n/u)
    .filter((line) => !/^\s*(?:at\b|Caused by:?\s*$)/u.test(line))
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replaceAll(/\s+/gu, " ")
    .slice(0, 500);
}

export function validateToolsListResponse(message, { id, expectedToolNames }) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return invalid("Response must be a JSON object.");
  }
  if (message.jsonrpc !== "2.0") {
    return invalid("Response jsonrpc must equal 2.0.");
  }
  if (message.id !== id) {
    return invalid("Response id does not match the request id.");
  }
  if (Object.hasOwn(message, "error")) {
    return invalid("Response must not contain an error member.");
  }
  if (
    !message.result ||
    typeof message.result !== "object" ||
    Array.isArray(message.result) ||
    !Array.isArray(message.result.tools)
  ) {
    return invalid("Response result.tools must be an array.");
  }

  const names = [];
  for (const tool of message.result.tools) {
    if (
      !tool ||
      typeof tool !== "object" ||
      Array.isArray(tool) ||
      typeof tool.name !== "string" ||
      tool.name.length === 0
    ) {
      return invalid("Every listed tool must have a non-empty string name.");
    }
    names.push(tool.name);
  }

  const actual = [...names].sort();
  const expected = [...expectedToolNames].sort();
  if (
    actual.length !== expected.length ||
    actual.some((name, index) => name !== expected[index])
  ) {
    return invalid(
      `Expected tools [${expected.join(", ")}], received [${actual.join(", ")}].`,
    );
  }
  return { ok: true };
}

export function createBlockedSchedule(blocks, initialSeed) {
  if (!Number.isInteger(blocks) || blocks < 1) {
    throw new Error("Schedule blocks must be a positive integer.");
  }
  const random = mulberry32(initialSeed);
  return Array.from({ length: blocks }, () =>
    shuffle(SUBJECT_NAMES, random),
  ).flat();
}

export function digestSchedule(schedule) {
  return createHash("sha256").update(JSON.stringify(schedule)).digest("hex");
}

export function evaluateColdStartPolicy(subjects) {
  const comparison = {
    medianDeltaMs: difference(
      subjects.product.medianMs,
      subjects.sdkEmpty.medianMs,
    ),
    medianRatio: ratio(subjects.product.medianMs, subjects.sdkEmpty.medianMs),
    p95DeltaMs: difference(subjects.product.p95Ms, subjects.sdkEmpty.p95Ms),
  };
  const allSubjects = Object.values(subjects);
  const checks = {
    errorsZero:
      allSubjects.reduce((sum, subject) => sum + subject.errors, 0) ===
      COLD_START_POLICY.errors,
    timeoutsZero:
      allSubjects.reduce((sum, subject) => sum + subject.timeouts, 0) ===
      COLD_START_POLICY.timeouts,
    productMedian:
      subjects.product.medianMs !== null &&
      subjects.product.medianMs <= COLD_START_POLICY.productMedianMs,
    productP95:
      subjects.product.p95Ms !== null &&
      subjects.product.p95Ms <= COLD_START_POLICY.productP95Ms,
    medianDelta:
      comparison.medianDeltaMs !== null &&
      comparison.medianDeltaMs <= COLD_START_POLICY.medianDeltaMs,
    medianRatio:
      comparison.medianRatio !== null &&
      comparison.medianRatio <= COLD_START_POLICY.medianRatio,
    p95Delta:
      comparison.p95DeltaMs !== null &&
      comparison.p95DeltaMs <= COLD_START_POLICY.p95DeltaMs,
  };

  return {
    thresholds: COLD_START_POLICY,
    comparison,
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

export function evaluateReleaseEligibility({
  environment,
  method,
  subjectDefinitions,
  summaries,
}) {
  const allSummaries = SUBJECT_NAMES.map((name) => summaries[name]);
  const scheduleOrder = method.scheduleOrder;
  const checks = {
    exactSubjectAttempts: allSummaries.every(
      (summary) => summary.attempted === 100,
    ),
    exactSubjectSamples: allSummaries.every(
      (summary) => summary.samples === 100,
    ),
    totalAttempts:
      method.totalAttempts === 300 &&
      allSummaries.reduce((sum, summary) => sum + summary.attempted, 0) === 300,
    knownOutcomeStatuses: allSummaries.every(
      (summary) => summary.unknownStatuses === 0,
    ),
    windowsX64:
      environment.platform === "win32" && environment.architecture === "x64",
    minimumNodeRuntime: isMinimumNodeRuntime(environment.runtime),
    productSea: subjectDefinitions.product.executionKind === "sea",
    repositoryDefaultBaselines:
      subjectDefinitions.raw.isRepositoryDefaultBaseline === true &&
      subjectDefinitions.raw.isTrustedBaseline === true &&
      subjectDefinitions.raw.executionKind === "sea" &&
      subjectDefinitions.sdkEmpty.isRepositoryDefaultBaseline === true &&
      subjectDefinitions.sdkEmpty.isTrustedBaseline === true &&
      subjectDefinitions.sdkEmpty.executionKind === "sea" &&
      subjectDefinitions.sdkEmpty.usesOfficialSdkPublicApi === true,
    noCustomBaselines: method.customBaselines === false,
    sdkAndProbeProvenance:
      subjectDefinitions.sdkEmpty.sdkPackage?.name ===
        "@modelcontextprotocol/server" &&
      /^\d+\.\d+\.\d+(?:-[\dA-Za-z.-]+)?(?:\+[\dA-Za-z.-]+)?$/u.test(
        subjectDefinitions.sdkEmpty.sdkPackage?.version ?? "",
      ) &&
      /^[a-f\d]{64}$/u.test(
        subjectDefinitions.sdkEmpty.sdkPackage?.entrySha256 ?? "",
      ) &&
      /^[a-f\d]{64}$/u.test(subjectDefinitions.raw.sourceSha256 ?? "") &&
      /^[a-f\d]{64}$/u.test(subjectDefinitions.raw.seaConfigSha256 ?? "") &&
      /^[a-f\d]{64}$/u.test(subjectDefinitions.sdkEmpty.sourceSha256 ?? "") &&
      /^[a-f\d]{64}$/u.test(subjectDefinitions.sdkEmpty.seaConfigSha256 ?? ""),
    releaseIterationCount: method.iterationsPerSubject === 100,
    scheduleEvidence:
      method.schedule === "seeded-randomized-subject-blocks" &&
      Array.isArray(scheduleOrder) &&
      scheduleOrder.length === 300 &&
      digestSchedule(scheduleOrder) === method.scheduleSha256 &&
      hasValidSubjectBlocks(scheduleOrder),
  };
  const eligible = Object.values(checks).every(Boolean);
  return {
    classification: eligible ? "release-eligible" : "ad-hoc-ineligible",
    eligible,
    checks,
    failedChecks: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
  };
}

export function createColdStartReport({
  generatedAt,
  environment,
  method,
  subjectDefinitions,
  outcomes,
  diagnosticReplacements = [],
}) {
  const sanitizedOutcomes = Object.fromEntries(
    Object.entries(outcomes).map(([name, subjectOutcomes]) => [
      name,
      subjectOutcomes.map((outcome) =>
        typeof outcome.message === "string"
          ? {
              ...outcome,
              message: sanitizeBenchmarkDiagnostic(
                outcome.message,
                diagnosticReplacements,
              ),
            }
          : outcome,
      ),
    ]),
  );
  const summaries = {
    raw: summarizeMeasurements(sanitizedOutcomes.raw),
    sdkEmpty: summarizeMeasurements(sanitizedOutcomes.sdkEmpty),
    product: summarizeMeasurements(sanitizedOutcomes.product),
  };
  const performancePolicy = evaluateColdStartPolicy(summaries);
  const releaseEligibility = evaluateReleaseEligibility({
    environment,
    method,
    subjectDefinitions,
    summaries,
  });
  const subjects = {
    raw: {
      ...subjectDefinitions.raw,
      isProductProtocolImplementation: false,
      usesOfficialSdkPublicApi:
        subjectDefinitions.raw.usesOfficialSdkPublicApi === true,
      ...summaries.raw,
    },
    sdkEmpty: {
      ...subjectDefinitions.sdkEmpty,
      isProductProtocolImplementation: false,
      usesOfficialSdkPublicApi:
        subjectDefinitions.sdkEmpty.usesOfficialSdkPublicApi === true,
      ...summaries.sdkEmpty,
    },
    product: {
      ...subjectDefinitions.product,
      isProductProtocolImplementation: true,
      ...summaries.product,
    },
  };

  return {
    schemaVersion: 2,
    generatedAt,
    environment,
    method,
    subjects,
    productVsSdk: performancePolicy.comparison,
    performancePolicy,
    releaseEligibility,
    policy: {
      passed: performancePolicy.passed && releaseEligibility.eligible,
      performancePassed: performancePolicy.passed,
      releaseEligible: releaseEligibility.eligible,
      thresholds: performancePolicy.thresholds,
      comparison: performancePolicy.comparison,
      checks: {
        ...performancePolicy.checks,
        releaseEligibility: releaseEligibility.eligible,
      },
    },
  };
}

function hasValidSubjectBlocks(schedule) {
  for (let index = 0; index < schedule.length; index += SUBJECT_NAMES.length) {
    const block = schedule.slice(index, index + SUBJECT_NAMES.length).sort();
    if (block.join("\0") !== [...SUBJECT_NAMES].sort().join("\0")) return false;
  }
  return true;
}

function isMinimumNodeRuntime(runtime) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(String(runtime));
  if (!match) return false;
  const version = match.slice(1).map(Number);
  const minimum = [25, 5, 0];
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] > minimum[index]) return true;
    if (version[index] < minimum[index]) return false;
  }
  return true;
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function mulberry32(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return round(values[middle]);
  return round((values[middle - 1] + values[middle]) / 2);
}

function nearestRank(values, percentile) {
  if (values.length === 0) return null;
  const index = Math.max(0, Math.ceil(values.length * percentile) - 1);
  return round(values[index]);
}

function difference(left, right) {
  if (left === null || right === null) return null;
  return round(left - right);
}

function ratio(numerator, denominator) {
  if (numerator === null || denominator === null || denominator <= 0)
    return null;
  return round(numerator / denominator, 4);
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function hasSensitiveQuery(url) {
  return [...url.searchParams.keys()].some((name) => {
    const normalized = name.toLowerCase().replaceAll(/[^a-z\d]/gu, "");
    return (
      /(?:token|secret|password|passwd|credential|signature|apikey|accesskey|authorization|authcode|sessionkey|privatekey)$/u.test(
        normalized,
      ) || ["auth", "code", "key", "sas", "sig"].includes(normalized)
    );
  });
}

function invalid(message) {
  return { ok: false, message };
}

function outcomeMessage(outcome) {
  return typeof outcome.message === "string"
    ? outcome.message
    : "No diagnostic.";
}
