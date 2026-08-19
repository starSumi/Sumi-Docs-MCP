import type { ContentCatalog } from "./content-catalog.ts";
import { contentCatalog } from "./content-catalog.ts";
import { normalizeSiteBasePath, prefixSiteRoute } from "./site-config.ts";

type LocalizedText = Record<string, string>;

interface CatalogNavigationTarget {
  type: "document";
  documentId: string;
}

interface RouteNavigationTarget {
  type: "route";
  routes: Record<string, string>;
}

interface HeaderNavigationDefinition {
  id: string;
  labels: LocalizedText;
  target: CatalogNavigationTarget | RouteNavigationTarget;
  activeDocumentIds?: string[];
  activeRoutePrefixes?: Record<string, string[]>;
}

export interface ResolvedHeaderNavigationItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
}

export interface ResolvedHeaderNavigation {
  label: string;
  items: ResolvedHeaderNavigationItem[];
}

const navigationLabels: LocalizedText = {
  en: "Primary",
  "zh-CN": "主要导航",
};

const navigationDefinitions: HeaderNavigationDefinition[] = [
  {
    id: "get-started",
    labels: { en: "Get started", "zh-CN": "开始使用" },
    target: { type: "document", documentId: "getting-started" },
    activeDocumentIds: [
      "overview",
      "getting-started",
      "configuration",
      "troubleshooting",
    ],
  },
  {
    id: "mcp-tools",
    labels: { en: "MCP tools", "zh-CN": "MCP 工具" },
    target: { type: "document", documentId: "tool-reference" },
    activeDocumentIds: ["tool-reference", "agent-hosts", "remote-sources"],
  },
  {
    id: "api",
    labels: { en: "API", "zh-CN": "API" },
    target: {
      type: "route",
      routes: {
        en: "/reference/api/corpus-contract/readme/",
        "zh-CN": "/zh-cn/reference/api/corpus-contract/readme/",
      },
    },
    activeRoutePrefixes: {
      en: ["/reference/api/corpus-contract/"],
      "zh-CN": ["/zh-cn/reference/api/corpus-contract/"],
    },
  },
  {
    id: "security",
    labels: { en: "Security", "zh-CN": "安全" },
    target: { type: "document", documentId: "security" },
    activeDocumentIds: ["security"],
  },
  {
    id: "contribute",
    labels: { en: "Contribute", "zh-CN": "参与贡献" },
    target: { type: "document", documentId: "contributing" },
    activeDocumentIds: [
      "contributing",
      "skills-and-orchestration",
      "development",
      "releasing",
    ],
  },
];

function localeValue(values: LocalizedText, locale: string, label: string) {
  const value = values[locale];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is missing locale '${locale}'.`);
  }
  return value;
}

function routeForDocument(
  catalog: ContentCatalog,
  documentId: string,
  locale: string,
) {
  const document = catalog.documents.find(({ id }) => id === documentId);
  if (!document) {
    throw new Error(
      `Header navigation references unknown document '${documentId}'.`,
    );
  }
  const variant = document.variants.find((entry) => entry.locale === locale);
  if (!variant) {
    throw new Error(
      `Header navigation document '${documentId}' is missing locale '${locale}'.`,
    );
  }
  return variant.route;
}

function stripBasePath(pathname: string, basePath: string) {
  const normalizedBasePath = normalizeSiteBasePath(basePath);
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error("Header navigation pathname must be root-relative.");
  }
  if (normalizedBasePath === "/") return pathname;

  const baseWithoutTrailingSlash = normalizedBasePath.slice(0, -1);
  if (pathname === baseWithoutTrailingSlash) return "/";
  if (!pathname.startsWith(normalizedBasePath)) {
    throw new Error(
      "Header navigation pathname is outside the site base path.",
    );
  }
  return `/${pathname.slice(normalizedBasePath.length)}`;
}

function targetRoute(
  catalog: ContentCatalog,
  definition: HeaderNavigationDefinition,
  locale: string,
) {
  return definition.target.type === "document"
    ? routeForDocument(catalog, definition.target.documentId, locale)
    : localeValue(
        definition.target.routes,
        locale,
        `Header navigation target '${definition.id}'`,
      );
}

function activeRoutes(
  catalog: ContentCatalog,
  definition: HeaderNavigationDefinition,
  locale: string,
) {
  const documentRoutes = (definition.activeDocumentIds ?? []).map(
    (documentId) => routeForDocument(catalog, documentId, locale),
  );
  const routePrefixes = definition.activeRoutePrefixes
    ? (definition.activeRoutePrefixes[locale] ?? [])
    : [];
  return { documentRoutes, routePrefixes };
}

export function resolveHeaderNavigation(
  locale: string,
  basePath: string,
  pathname: string,
  catalog: ContentCatalog = contentCatalog,
): ResolvedHeaderNavigation {
  if (!catalog.locales.includes(locale)) {
    throw new Error(`Unsupported header navigation locale '${locale}'.`);
  }

  const logicalPathname = stripBasePath(pathname, basePath);
  return {
    label: localeValue(navigationLabels, locale, "Header navigation label"),
    items: navigationDefinitions.map((definition) => {
      const route = targetRoute(catalog, definition, locale);
      const { documentRoutes, routePrefixes } = activeRoutes(
        catalog,
        definition,
        locale,
      );
      return {
        id: definition.id,
        label: localeValue(
          definition.labels,
          locale,
          `Header navigation item '${definition.id}'`,
        ),
        href: prefixSiteRoute(route, basePath),
        active:
          documentRoutes.includes(logicalPathname) ||
          routePrefixes.some((prefix) => logicalPathname.startsWith(prefix)),
      };
    }),
  };
}
