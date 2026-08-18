import { isAbsolute, relative, resolve, sep } from "node:path";

const URL_WITH_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+)@/giu;
const FILE_URL = /\bfile:\/\/\/[^\s'"<>]+/giu;
const WINDOWS_PATH = /(?:[a-z]:[\\/]|\\\\)[^\s'"<>|]+/giu;
const POSIX_PATH = /(?<![:/\\\w])\/(?:[^\s/'"<>]+\/)*[^\s'"<>]*/gu;

export interface DiagnosticOptions {
  showPaths?: boolean;
  knownPaths?: readonly string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceKnownPaths(message: string, paths: readonly string[]): string {
  const variants = paths
    .flatMap((value) => [value, value.replace(/\\/g, "/")])
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length);

  return variants.reduce(
    (result, value) =>
      result.replace(new RegExp(escapeRegExp(value), "giu"), "<path>"),
    message,
  );
}

/** Return one bounded client-safe diagnostic line without stack or credentials. */
export function sanitizeDiagnostic(
  error: unknown,
  options: DiagnosticOptions = {},
): string {
  const raw = error instanceof Error ? error.message : String(error);
  let message = raw.split(/\r?\n/u, 1)[0]?.trim() || "Unknown error";
  message = message.replace(URL_WITH_CREDENTIALS, "$1<redacted>@");

  if (!options.showPaths) {
    message = replaceKnownPaths(message, options.knownPaths ?? []);
    message = message
      .replace(FILE_URL, "<path>")
      .replace(WINDOWS_PATH, "<path>")
      .replace(POSIX_PATH, "<path>");
  }

  return message.slice(0, 512);
}

/** Format a resolved local path for doctor output without exposing its host root. */
export function formatDoctorPath(
  value: string,
  projectRoot: string,
  externalLabel: "config" | "source",
  showPaths: boolean,
): string {
  const root = resolve(projectRoot);
  const candidate = resolve(value);
  if (showPaths) return candidate;

  const fromRoot = relative(root, candidate);
  const contained =
    fromRoot === "" ||
    (fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(fromRoot));
  if (!contained) return `<external-${externalLabel}>`;
  return fromRoot === "" ? "." : fromRoot.split(sep).join("/");
}
