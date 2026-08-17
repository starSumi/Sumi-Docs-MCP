const rawSiteUrl = process.env.SITE_URL?.trim();

if (!rawSiteUrl) {
  throw new Error("SITE_URL is required for a release build.");
}

let siteUrl;
try {
  siteUrl = new URL(rawSiteUrl);
} catch {
  throw new Error("SITE_URL must be an absolute URL.");
}

if (siteUrl.protocol !== "https:") {
  throw new Error("SITE_URL must use HTTPS.");
}
if (siteUrl.username || siteUrl.password) {
  throw new Error("SITE_URL must not contain credentials.");
}
if (siteUrl.search || siteUrl.hash) {
  throw new Error("SITE_URL must not contain a query string or fragment.");
}
if (siteUrl.pathname !== "/") {
  throw new Error(
    "SITE_URL must be an origin without a path; configure Astro base-path support before subpath deployment.",
  );
}

console.log(`Release site origin: ${siteUrl.origin}`);
