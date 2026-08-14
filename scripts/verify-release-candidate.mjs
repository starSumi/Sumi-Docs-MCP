import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

function parseOptions(args) {
  const options = { dir: "artifacts/release" };
  const supported = new Set(["dir", "expected-commit", "expected-tag"]);

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || !supported.has(flag.slice(2)) || !value) {
      throw new Error(
        `Unsupported or incomplete option: ${flag ?? "<missing>"}`,
      );
    }
    options[flag.slice(2)] = value;
  }

  return options;
}

const options = parseOptions(process.argv.slice(2));

if (!options["expected-commit"] || !options["expected-tag"]) {
  throw new Error(
    "Usage: verify-release-candidate --expected-commit <sha> --expected-tag <vX.Y.Z> [--dir <path>]",
  );
}

const releaseDir = resolve(options.dir);
const manifest = JSON.parse(
  await readFile(resolve(releaseDir, "RELEASE-MANIFEST.json"), "utf8"),
);
const benchmark = JSON.parse(
  await readFile(resolve(releaseDir, "benchmark.json"), "utf8"),
);
const sbom = JSON.parse(
  await readFile(resolve(releaseDir, "sbom.cdx.json"), "utf8"),
);
const expectedCommit = options["expected-commit"].toLowerCase();
const expectedTag = options["expected-tag"];
const expectedVersion = expectedTag.startsWith("v") ? expectedTag.slice(1) : "";

if (!/^[0-9a-f]{40}$/.test(expectedCommit))
  throw new Error("Expected commit must be a full 40-character SHA.");
if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expectedTag))
  throw new Error("Expected tag is not a supported SemVer tag.");
if (manifest.commit !== expectedCommit)
  throw new Error(
    `Candidate commit ${manifest.commit} does not match ${expectedCommit}.`,
  );
if (manifest.version !== expectedVersion)
  throw new Error(
    `Candidate version ${manifest.version} does not match tag ${expectedTag}.`,
  );
if (manifest.codeSigning !== "unsigned")
  throw new Error("Candidate code-signing state is missing or unsupported.");
if (manifest.benchmark?.passed !== benchmark.passed)
  throw new Error("Manifest performance status does not match benchmark.json.");
if (benchmark.hardLimitMs !== manifest.benchmark?.hardLimitMs)
  throw new Error("Manifest performance limit does not match benchmark.json.");
if (sbom.bomFormat !== "CycloneDX" || !/^1\./.test(String(sbom.specVersion)))
  throw new Error("sbom.cdx.json is not a supported CycloneDX document.");

const checksumText = await readFile(resolve(releaseDir, "SHA256SUMS"), "ascii");
const entries = checksumText
  .trim()
  .split(/\r?\n/)
  .map((line) => {
    const match = /^([0-9a-f]{64})  ([^/\\]+)$/.exec(line);
    if (!match) throw new Error(`Malformed SHA256SUMS line: ${line}`);
    return { expectedHash: match[1], file: match[2] };
  });

if (new Set(entries.map((entry) => entry.file)).size !== entries.length) {
  throw new Error("SHA256SUMS contains a duplicate file entry.");
}

for (const { expectedHash, file } of entries) {
  const bytes = await readFile(resolve(releaseDir, file));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash)
    throw new Error(`Checksum mismatch for ${file}.`);
}

const releaseFiles = await readdir(releaseDir);
for (const required of [
  "RELEASE-MANIFEST.json",
  "SHA256SUMS",
  "benchmark.json",
  "sbom.cdx.json",
]) {
  if (!releaseFiles.includes(required))
    throw new Error(`Candidate is missing ${required}.`);
}
if (
  !releaseFiles.some((file) =>
    /^sumi-docs-mcp-v.+-windows-x64\.zip$/.test(basename(file)),
  )
) {
  throw new Error("Candidate is missing the Windows x64 archive.");
}
if (
  !releaseFiles.some((file) =>
    /^sumi-os-docs-mcp-.+\.tgz$/.test(basename(file)),
  )
) {
  throw new Error("Candidate is missing the npm package archive.");
}

const checksummedFiles = entries.map((entry) => entry.file).sort();
const expectedChecksummedFiles = releaseFiles
  .filter((file) => file !== "SHA256SUMS")
  .sort();
if (
  JSON.stringify(checksummedFiles) !== JSON.stringify(expectedChecksummedFiles)
) {
  throw new Error("SHA256SUMS must cover every candidate asset exactly once.");
}

console.log(
  `Release candidate verified for ${expectedTag} at ${expectedCommit}.`,
);
