import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "artifacts", "compliance");
const seaMetafilePath = join(
  projectRoot,
  "packages",
  "mcp",
  ".sea",
  "esbuild-metafile.json",
);
const browserManifestPath = join(
  projectRoot,
  "apps",
  "web",
  "dist",
  "_compliance",
  "browser-components.json",
);
const packageManagerCli = process.env.npm_execpath;

const pagefindLicenseText = `Copyright 2022 Pagefind

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

const reviewedLicenseOverrides = new Map(
  ["pagefind@1.5.2", "@pagefind/default-ui@1.5.2"].map((identity) => [
    identity,
    {
      license: "MIT",
      source: "https://github.com/Pagefind/pagefind/blob/v1.5.2/LICENSE",
      sha256:
        "4736929bfded122bd969f0621a0d917484b126d981270d68a63ed42cb55503d5",
      text: pagefindLicenseText,
    },
  ]),
);

const standardLicenseTexts = {
  MIT: `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  ISC: `ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`,
};

if (!packageManagerCli || !existsSync(packageManagerCli)) {
  throw new Error("Run this command through the pinned pnpm package script.");
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function loadLicenseInventory(packageName) {
  const result = spawnSync(
    process.execPath,
    [
      packageManagerCli,
      "--filter",
      packageName,
      "licenses",
      "list",
      "--prod",
      "--json",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || `Unable to inventory ${packageName} licenses.`,
    );
  }

  const components = new Map();
  for (const [license, entries] of Object.entries(JSON.parse(result.stdout))) {
    for (const entry of entries) {
      if (entry.versions.length !== entry.paths.length) {
        throw new Error(`License inventory path mismatch for ${entry.name}.`);
      }
      entry.versions.forEach((version, index) => {
        const identity = `${entry.name}@${version}`;
        const component = {
          identity,
          name: entry.name,
          version,
          license,
          author: entry.author ?? null,
          homepage: entry.homepage ?? null,
          path: entry.paths[index],
        };
        const previous = components.get(identity);
        if (previous && previous.license !== component.license) {
          throw new Error(`Conflicting license metadata for ${identity}.`);
        }
        components.set(identity, previous ?? component);
      });
    }
  }
  if (components.size === 0) {
    throw new Error(
      `Production dependency inventory is empty for ${packageName}.`,
    );
  }
  return components;
}

function packageIdentityForInput(input) {
  let cursor = dirname(resolve(projectRoot, "packages", "mcp", input));
  for (;;) {
    try {
      const manifest = readManifest(join(cursor, "package.json"));
      if (manifest.name && manifest.version) {
        return {
          identity: `${manifest.name}@${manifest.version}`,
          manifest,
          path: cursor,
        };
      }
    } catch {
      // Continue to the enclosing package boundary.
    }
    const parent = dirname(cursor);
    if (parent === cursor) return undefined;
    cursor = parent;
  }
}

function loadMcpArtifact(inventory) {
  const manifestPath = join(projectRoot, "packages", "mcp", "package.json");
  const manifest = readManifest(manifestPath);
  const rootIdentity = `${manifest.name}@${manifest.version}`;
  const seaMetafile = readManifest(seaMetafilePath);
  const components = new Set();
  const firstParty = new Map();

  for (const input of Object.keys(seaMetafile.inputs ?? {})) {
    const packageEntry = packageIdentityForInput(input);
    if (!packageEntry || packageEntry.identity === rootIdentity) continue;
    if (input.replaceAll("\\", "/").includes("/node_modules/")) {
      if (!inventory.has(packageEntry.identity)) {
        throw new Error(
          `SEA dependency is absent from the MCP production inventory: ${packageEntry.identity}`,
        );
      }
      components.add(packageEntry.identity);
    } else if (packageEntry.manifest.name.startsWith("@sumi-os/")) {
      firstParty.set(packageEntry.identity, packageEntry);
    } else {
      throw new Error(`Unexpected non-workspace SEA input: ${input}`);
    }
  }
  if (components.size === 0) throw new Error("The SEA component set is empty.");

  return {
    key: "mcp",
    artifactRole: "embedded-sea-input",
    manifest,
    manifestPath,
    rootIdentity,
    components,
    firstParty,
    includeNode: true,
  };
}

function singleIdentityForName(inventory, name) {
  const matches = [...inventory.values()].filter(
    (component) => component.name === name,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${name} production component, found ${matches.length}.`,
    );
  }
  return matches[0].identity;
}

function loadWebArtifact(inventory) {
  const manifestPath = join(projectRoot, "apps", "web", "package.json");
  const manifest = readManifest(manifestPath);
  const emitted = readManifest(browserManifestPath);
  if (
    emitted.version !== 1 ||
    emitted.basis !== "vite-client-chunk-modules" ||
    !Array.isArray(emitted.components) ||
    emitted.components.length === 0 ||
    new Set(emitted.components).size !== emitted.components.length ||
    JSON.stringify(emitted.components) !==
      JSON.stringify(
        [...emitted.components].sort((left, right) =>
          left.localeCompare(right),
        ),
      )
  ) {
    throw new Error("The Web browser component manifest is invalid.");
  }

  const components = new Set(emitted.components);
  const pagefindOutputs = [
    ["pagefind", "pagefind.js"],
    ["@pagefind/default-ui", "pagefind-ui.js"],
  ];
  for (const [name, output] of pagefindOutputs) {
    if (
      !existsSync(join(projectRoot, "apps", "web", "dist", "pagefind", output))
    ) {
      throw new Error(`Expected Pagefind output is missing: ${output}`);
    }
    components.add(singleIdentityForName(inventory, name));
  }
  for (const identity of components) {
    if (!inventory.has(identity)) {
      throw new Error(
        `Browser component is absent from the Web production inventory: ${identity}`,
      );
    }
  }

  return {
    key: "web",
    artifactRole: "emitted-browser-component",
    manifest,
    manifestPath,
    rootIdentity: `${manifest.name}@${manifest.version}`,
    components,
    firstParty: new Map(),
    includeNode: false,
  };
}

const licenseFilePattern = /^(?:licen[cs]e|copying|notice)(?:[._-]|$)/iu;
const noticeSourcePattern =
  /^(?:readme(?:[._-]|$)|.*\.(?:[cm]?[jt]s|md|txt))$/iu;

function packageAttribution(component) {
  const copyrightLines = new Set();
  for (const file of readdirSync(component.path)
    .filter((name) => noticeSourcePattern.test(name))
    .sort((left, right) => left.localeCompare(right))) {
    const path = join(component.path, file);
    const stats = statSync(path);
    if (!stats.isFile() || stats.size > 1024 * 1024) continue;
    const content = readFileSync(path, "utf8");
    for (const match of content.matchAll(/^.*copyright.*$/gimu)) {
      const line = match[0]
        .replace(/^\s*(?:\/\/|\/\*+|\*|#)\s*/u, "")
        .replace(/\s*\*\/\s*$/u, "")
        .trim();
      if (line.length > 0 && line.length <= 300) copyrightLines.add(line);
    }
  }
  return [...copyrightLines].sort((left, right) => left.localeCompare(right));
}

function noticeSection(component, artifactRole) {
  const files = readdirSync(component.path)
    .filter((name) => licenseFilePattern.test(name))
    .filter((name) => statSync(join(component.path, name)).isFile())
    .sort((left, right) => left.localeCompare(right));
  const lines = [
    component.identity,
    `Declared license: ${component.license}`,
    `Artifact role: ${artifactRole}`,
  ];
  if (component.homepage) lines.push(`Homepage: ${component.homepage}`);

  if (files.length > 0) {
    for (const file of files) {
      lines.push(
        "",
        `----- ${file} -----`,
        readFileSync(join(component.path, file), "utf8").trim(),
      );
    }
    return lines.join("\n");
  }

  const override = reviewedLicenseOverrides.get(component.identity);
  if (override) {
    if (
      override.license !== component.license ||
      sha256(override.text) !== override.sha256
    ) {
      throw new Error(
        `Reviewed license override drifted for ${component.identity}.`,
      );
    }
    lines.push(
      `Reviewed license source: ${override.source}`,
      `Reviewed license SHA-256: ${override.sha256}`,
      "",
      override.text.trim(),
    );
    return lines.join("\n");
  }

  const standardText = standardLicenseTexts[component.license];
  const attribution = packageAttribution(component);
  if (!standardText || attribution.length === 0) {
    throw new Error(
      `No complete reviewed license notice is available for ${component.identity} (${component.license}).`,
    );
  }
  if (component.author) lines.push(`Package author: ${component.author}`);
  lines.push(...attribution, "", standardText);
  return lines.join("\n");
}

function npmPurl(name, version) {
  if (name.startsWith("@")) {
    const [scope, packageName] = name.split("/");
    return `pkg:npm/${encodeURIComponent(scope)}/${packageName}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

function dependencyIdentity(componentPath, dependencyName) {
  for (const dependencyRoot of [
    join(componentPath, "node_modules"),
    dirname(componentPath),
  ]) {
    try {
      const manifest = readManifest(
        join(dependencyRoot, ...dependencyName.split("/"), "package.json"),
      );
      return `${manifest.name}@${manifest.version}`;
    } catch {
      // Try the next package-manager layout.
    }
  }
  return undefined;
}

function dependencyRefs(manifest, componentPath, included) {
  const names = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  return [...names]
    .map((name) => dependencyIdentity(componentPath, name))
    .filter((identity) => identity && included.has(identity))
    .sort((left, right) => left.localeCompare(right));
}

function createSbom(artifact, selectedComponents) {
  const firstPartyComponents = [...artifact.firstParty.values()].sort(
    (left, right) => left.identity.localeCompare(right.identity),
  );
  const included = new Set([
    ...selectedComponents.map((component) => component.identity),
    ...firstPartyComponents.map((component) => component.identity),
  ]);
  const components = [
    ...firstPartyComponents.map((component) => ({
      type: "library",
      name: component.manifest.name,
      version: component.manifest.version,
      "bom-ref": component.identity,
      purl: npmPurl(component.manifest.name, component.manifest.version),
      licenses: [{ license: { name: component.manifest.license } }],
      properties: [
        { name: "io.sumi.docs/artifact-role", value: artifact.artifactRole },
        { name: "io.sumi.docs/ownership", value: "first-party" },
      ],
    })),
    ...selectedComponents.map((component) => ({
      type: "library",
      name: component.name,
      version: component.version,
      "bom-ref": component.identity,
      purl: npmPurl(component.name, component.version),
      licenses: [{ license: { name: component.license } }],
      ...(component.homepage
        ? { externalReferences: [{ type: "website", url: component.homepage }] }
        : {}),
      properties: [
        { name: "io.sumi.docs/artifact-role", value: artifact.artifactRole },
      ],
    })),
  ];
  const dependencies = [
    {
      ref: artifact.rootIdentity,
      dependsOn: dependencyRefs(
        artifact.manifest,
        dirname(artifact.manifestPath),
        included,
      ),
    },
    ...firstPartyComponents.map((component) => ({
      ref: component.identity,
      dependsOn: dependencyRefs(component.manifest, component.path, included),
    })),
    ...selectedComponents.map((component) => ({
      ref: component.identity,
      dependsOn: dependencyRefs(
        readManifest(join(component.path, "package.json")),
        component.path,
        included,
      ),
    })),
  ];

  if (artifact.includeNode) {
    const nodeRef = `runtime:node@${process.versions.node}`;
    components.unshift({
      type: "framework",
      name: "Node.js",
      version: process.versions.node,
      "bom-ref": nodeRef,
      purl: `pkg:generic/nodejs@${process.versions.node}`,
      hashes: [
        {
          alg: "SHA-256",
          content: sha256(readFileSync(process.execPath)),
        },
      ],
      licenses: [
        {
          license: { name: "Node.js runtime license (see NODEJS_LICENSE.txt)" },
        },
      ],
      externalReferences: [{ type: "website", url: "https://nodejs.org/" }],
      properties: [
        { name: "io.sumi.docs/embedded-sea-runtime", value: "true" },
      ],
    });
    dependencies[0].dependsOn = [...dependencies[0].dependsOn, nodeRef].sort(
      (left, right) => left.localeCompare(right),
    );
    dependencies.push({ ref: nodeRef, dependsOn: [] });
  }

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: artifact.manifest.name,
        version: artifact.manifest.version,
        "bom-ref": artifact.rootIdentity,
      },
      properties: [
        {
          name: "io.sumi.docs/inventory-basis",
          value:
            artifact.key === "mcp"
              ? "esbuild-sea-metafile"
              : "vite-client-chunks-and-pagefind-output",
        },
      ],
      tools: {
        components: [
          {
            type: "application",
            name: "sumi-docs-compliance-builder",
            version: "1",
          },
        ],
      },
    },
    components,
    dependencies,
  };
}

function writeArtifactCompliance(artifact, inventory) {
  const selectedComponents = [...artifact.components].map((identity) =>
    inventory.get(identity),
  );
  if (selectedComponents.some((component) => !component)) {
    throw new Error(`${artifact.key} contains an unresolved component.`);
  }
  selectedComponents.sort((left, right) =>
    left.identity.localeCompare(right.identity),
  );
  const notices = [
    "THIRD-PARTY SOFTWARE NOTICES",
    "",
    `Artifact: ${artifact.rootIdentity}`,
    "This inventory is generated from the pinned artifact component graph.",
    "Upstream license terms remain controlling.",
    "",
    ...selectedComponents.flatMap((component) => [
      noticeSection(component, artifact.artifactRole),
      "",
      "=".repeat(80),
      "",
    ]),
  ].join("\n");
  const target = join(outputRoot, artifact.key);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "THIRD_PARTY_NOTICES.txt"), notices, "utf8");
  writeFileSync(
    join(target, "bom.cdx.json"),
    `${JSON.stringify(createSbom(artifact, selectedComponents), null, 2)}\n`,
    "utf8",
  );
  if (artifact.includeNode) {
    const nodeLicense = join(dirname(process.execPath), "LICENSE");
    readFileSync(nodeLicense);
    copyFileSync(nodeLicense, join(target, "NODEJS_LICENSE.txt"));
  }
  process.stdout.write(
    `Generated ${artifact.key} compliance artifacts for ${selectedComponents.length} third-party component(s).\n`,
  );
}

rmSync(outputRoot, { recursive: true, force: true });
const mcpInventory = loadLicenseInventory("@sumi-os/docs-mcp");
const webInventory = loadLicenseInventory("@sumi-os/docs-web");
writeArtifactCompliance(loadMcpArtifact(mcpInventory), mcpInventory);
writeArtifactCompliance(loadWebArtifact(webInventory), webInventory);
