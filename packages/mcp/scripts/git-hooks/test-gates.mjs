import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const validatorPath = fileURLToPath(
  new URL("./reject-agent-attribution.mjs", import.meta.url),
);
const identityValidatorUrl = new URL(
  "./reject-agent-identity.mjs",
  import.meta.url,
);
const commitlintPath = fileURLToPath(
  import.meta.resolve("@commitlint/cli/cli.js"),
);
const fixtureDirectory = await mkdtemp(join(tmpdir(), "sumi-docs-git-hooks-"));

function runNode(script, args, input) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input,
    windowsHide: true,
  });
}

function assertExit(result, expected, scenario) {
  if (result.status === expected) {
    return;
  }

  const details = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  throw new Error(
    `${scenario}: expected exit ${expected}, received ${result.status}\n${details}`,
  );
}

try {
  const humanTrailer = join(fixtureDirectory, "human-trailer.txt");
  const agentTrailer = join(fixtureDirectory, "agent-trailer.txt");
  const agentSubject = join(fixtureDirectory, "agent-subject.txt");
  const approvedServiceTrailer = join(
    fixtureDirectory,
    "approved-service-trailer.txt",
  );

  await Promise.all([
    writeFile(
      humanTrailer,
      "fix(cli): preserve explicit paths\n\nCo-authored-by: Human Reviewer <human@example.com>\n",
      "utf8",
    ),
    writeFile(
      agentTrailer,
      "fix(cli): preserve explicit paths\n\nCo-authored-by: Codex <codex@example.com>\n",
      "utf8",
    ),
    writeFile(agentSubject, "docs: apply Claude review suggestions\n", "utf8"),
    writeFile(
      approvedServiceTrailer,
      "build(deps-dev): update Node types\n\nSigned-off-by: dependabot[bot] <support@github.com>\n",
      "utf8",
    ),
  ]);

  assertExit(
    runNode(
      commitlintPath,
      [],
      "feat(vfs): add deterministic search ranking\n",
    ),
    0,
    "valid Conventional Commit",
  );
  assertExit(
    runNode(commitlintPath, [], "not a conventional message\n"),
    1,
    "invalid Conventional Commit",
  );
  assertExit(runNode(validatorPath, [humanTrailer]), 0, "human attribution");
  assertExit(
    runNode(validatorPath, [agentTrailer]),
    1,
    "automated attribution",
  );
  assertExit(
    runNode(validatorPath, [agentSubject]),
    1,
    "automated tool name in subject",
  );
  assertExit(
    runNode(validatorPath, [approvedServiceTrailer]),
    0,
    "approved dependency service attribution",
  );
  assertExit(runNode(validatorPath, []), 2, "missing message path");

  const { containsAutomatedIdentity } = await import(identityValidatorUrl.href);
  if (containsAutomatedIdentity("Human Maintainer <human@example.com>")) {
    throw new Error("human Git identity was rejected");
  }
  if (!containsAutomatedIdentity("Codex <automation@example.com>")) {
    throw new Error("automated Git identity was accepted");
  }

  console.log("Git hook gate tests passed.");
} finally {
  await rm(fixtureDirectory, { recursive: true, force: true });
}
