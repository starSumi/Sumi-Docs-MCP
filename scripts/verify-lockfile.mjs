import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const APPROVED_REGISTRY = "https://registry.npmjs.org";
const STRONG_INTEGRITY = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;

function validateIntegrity(value, packageKey, errors) {
  if (typeof value !== "string" || !STRONG_INTEGRITY.test(value)) {
    errors.push(`${packageKey} is missing a SHA-512 integrity value.`);
  }
}

export function validateLockfile(lockfile) {
  const errors = [];
  let registryPackages = 0;

  if (
    typeof lockfile?.lockfileVersion !== "string" ||
    !/^9(?:\.|$)/u.test(lockfile.lockfileVersion)
  ) {
    errors.push("pnpm-lock.yaml must use lockfile version 9.");
  }
  if (!lockfile?.importers || typeof lockfile.importers !== "object") {
    errors.push("pnpm-lock.yaml is missing importers.");
  }
  if (!lockfile?.packages || typeof lockfile.packages !== "object") {
    return {
      errors: [...errors, "pnpm-lock.yaml is missing package snapshots."],
      registryPackages,
    };
  }

  for (const [packageKey, metadata] of Object.entries(lockfile.packages)) {
    if (!metadata || typeof metadata !== "object") {
      errors.push(`${packageKey} has invalid metadata.`);
      continue;
    }
    const resolution = metadata.resolution;
    if (!resolution || typeof resolution !== "object") {
      errors.push(`${packageKey} is missing a registry resolution.`);
      continue;
    }
    if (resolution.tarball !== undefined) {
      let tarball;
      try {
        tarball = new URL(resolution.tarball);
      } catch {
        errors.push(`${packageKey} has a non-URL tarball.`);
        continue;
      }
      if (
        tarball.origin !== APPROVED_REGISTRY ||
        tarball.protocol !== "https:" ||
        tarball.username ||
        tarball.password
      ) {
        errors.push(
          `${packageKey} does not resolve from ${APPROVED_REGISTRY}.`,
        );
      }
    }
    if (resolution.git || resolution.directory || resolution.path) {
      errors.push(`${packageKey} uses an external or local resolution.`);
    }
    validateIntegrity(resolution.integrity, packageKey, errors);
    registryPackages += 1;
  }

  return { errors, registryPackages };
}

function main() {
  const root = process.cwd();
  const lockfile = parseYaml(
    readFileSync(join(root, "pnpm-lock.yaml"), "utf8"),
  );
  const npmrc = readFileSync(join(root, ".npmrc"), "utf8");
  if (
    !npmrc
      .split(/\r?\n/u)
      .some((line) => line.trim() === `registry=${APPROVED_REGISTRY}/`)
  ) {
    throw new Error(`.npmrc must pin registry=${APPROVED_REGISTRY}/.`);
  }
  const { errors, registryPackages } = validateLockfile(lockfile);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  process.stdout.write(
    `Verified ${registryPackages} packages from ${APPROVED_REGISTRY}.\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
