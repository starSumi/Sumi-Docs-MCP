import type { StarlightPlugin } from "@astrojs/starlight/types";

const API_ROUTE_PATTERN =
  /^\/(?:zh-cn\/)?reference\/api\/corpus-contract(?:\/|$)/u;

function normalizeRoute(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const match = /^([^?#]*)(.*)$/u.exec(value);
  if (!match || !API_ROUTE_PATTERN.test(match[1])) return value;
  return `${match[1].toLowerCase()}${match[2]}`;
}

export function normalizeTypeDocSidebar(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeTypeDocSidebar);
  if (!value || typeof value !== "object") return value;

  const normalized: Record<string, unknown> = { ...value };
  if ("link" in normalized) normalized.link = normalizeRoute(normalized.link);
  if (
    normalized.autogenerate &&
    typeof normalized.autogenerate === "object" &&
    !Array.isArray(normalized.autogenerate)
  ) {
    const autogenerate = normalized.autogenerate as Record<string, unknown>;
    normalized.autogenerate = {
      ...autogenerate,
      directory: normalizeRoute(autogenerate.directory),
    };
  }
  if ("items" in normalized) {
    normalized.items = normalizeTypeDocSidebar(normalized.items);
  }
  return normalized;
}

export function canonicalTypeDocRoutes(): StarlightPlugin {
  return {
    name: "sumi-docs-canonical-typedoc-routes",
    hooks: {
      "config:setup"({ config, updateConfig }) {
        updateConfig({
          sidebar: normalizeTypeDocSidebar(
            config.sidebar,
          ) as typeof config.sidebar,
        });
      },
    },
  };
}
