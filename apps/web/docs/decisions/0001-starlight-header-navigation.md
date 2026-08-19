# ADR-0001: Add primary navigation through the SiteTitle component boundary

- Status: Accepted
- Date: 2026-08-19
- Owners: Sumi Docs Web maintainers

## Context

The documentation site has three navigation planes with different ownership:

- the header provides a small set of cross-section entry points;
- the left sidebar exposes the complete reviewed content hierarchy;
- the right table of contents exposes headings within the current page.

Starlight 0.41.7 provides the brand, search, social link, theme selector, and
language selector in its default header. It does not provide a first-class
configuration array for arbitrary primary header links. Starlight does provide
supported component overrides, including `SiteTitle` and the complete `Header`.

The site needs stable bilingual links to getting started, MCP tools, the API
reference, security policy, and contribution guidance without creating a second
documentation catalog or coupling the site to an unrelated UI plugin.

## Decision

Override only Starlight's `SiteTitle` component. The proxy renders the upstream
default `SiteTitle` unchanged and appends the Sumi Docs primary navigation
component. Leave the rest of the upstream `Header` implementation under
Starlight ownership.

Define header items in a typed local module. Resolve documentation targets by
stable IDs from `src/content-catalog.ts`; prefix every route with the configured
site base; localize labels; and derive active state from the logical route. The
TypeDoc API entry remains an explicit route because generated API pages are not
part of the reviewed human-and-MCP content catalog.

Show the primary links only when the desktop header has sufficient width. On
smaller viewports, the complete sidebar remains the navigation source instead
of duplicating links into a constrained header.

## Alternatives

### Install a navigation or UI-tweaks plugin

Rejected. The requirement is one bounded navigation surface and can be
implemented through Starlight's supported override contract. A third-party
plugin would add production dependency, CSS, release, and compatibility
ownership without eliminating the local route model or its tests.

### Override the complete Header component

Rejected. Reimplementing the full header would take ownership of search,
language selection, theme behavior, social links, accessibility, and future
Starlight changes. That is a larger and more fragile compatibility surface than
the requirement needs.

### Put all pages in the header

Rejected. Header navigation is for a few cross-section anchors. The catalog
sidebar remains the complete, deterministic information architecture and the
page table of contents remains heading-derived.

## Consequences

The local `SiteTitle` proxy is an intentional compatibility boundary. A
Starlight upgrade must verify that the default component import and header
layout contract still hold. Header document links fail tests when their stable
catalog IDs or localized variants disappear. Explicit generated API routes must
be updated with any TypeDoc route migration.

The decision does not change manifest v1 or v2, MCP tool results, content
identity, or sidebar ordering.

## Validation and rollback

Unit tests cover locale labels, catalog ID resolution, site-base prefixing,
active routes, unsupported locales, and paths outside the deployment base. Web
validation must also run Astro checks, a production build, exact route checks,
and desktop and mobile visual inspection.

To roll back, remove the `SiteTitle` component mapping and the three local
header-navigation files. Starlight then resumes rendering its untouched default
header; the sidebar, table of contents, and published MCP projection are
unaffected.
