import { fileURLToPath } from "node:url";

export const workspaceRootUrl = new URL("../../../", import.meta.url);
export const contentRootUrl = new URL("docs/", workspaceRootUrl);
export const contentRoot = fileURLToPath(contentRootUrl);

export const contentPatterns = Object.freeze([
  "docs/**/[^_]*.{md,mdx}",
  "apps/web/src/content/docs/reference/api/corpus-contract/**/[^_]*.md",
]);

const CONTENT_PREFIXES = Object.freeze(["docs/", "apps/web/src/content/docs/"]);
const GENERATED_API_PREFIX =
  "apps/web/src/content/docs/reference/api/corpus-contract/";

export function generateContentId({
  entry,
  data,
}: {
  entry: string;
  data: Record<string, unknown>;
}): string {
  const configuredSlug =
    typeof data.slug === "string" && data.slug.length > 0
      ? data.slug
      : undefined;
  const prefix = CONTENT_PREFIXES.find((candidate) =>
    entry.startsWith(candidate),
  );
  if (!prefix) throw new Error(`Unsupported documentation source '${entry}'.`);
  const id =
    configuredSlug ??
    entry
      .slice(prefix.length)
      .replace(/\.(?:md|mdx)$/u, "")
      .replace(/\/index$/u, "");
  return entry.startsWith(GENERATED_API_PREFIX) ? id.toLowerCase() : id;
}
