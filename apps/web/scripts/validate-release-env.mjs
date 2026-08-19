import { resolveSiteDeployment } from "../src/site-config.ts";

const rawSiteUrl = process.env.SITE_URL?.trim();
if (!rawSiteUrl) {
  throw new Error("SITE_URL is required for a release build.");
}

const deployment = resolveSiteDeployment(rawSiteUrl, process.env.BASE_PATH);
console.log(`Release site URL: ${deployment.publicBaseUrl}`);
