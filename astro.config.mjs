import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sumiDocsPublisher from "./integrations/sumi-docs-publisher.mjs";

const site = process.env.SITE_URL || "http://127.0.0.1:4321";

export default defineConfig({
  site,
  integrations: [
    starlight({
      title: "Sumi Docs",
      description:
        "Human and machine-readable documentation from one reviewed source.",
      logo: {
        src: "./src/assets/sumi-docs-mark.png",
        alt: "Sumi Docs",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Overview", link: "/" },
            { label: "Getting started", link: "/getting-started/" },
            { label: "Configuration", link: "/configuration/" },
          ],
        },
        {
          label: "Operate",
          items: [
            { label: "Remote sources", link: "/remote-sources/" },
            { label: "Architecture", link: "/architecture/" },
          ],
        },
      ],
    }),
    sumiDocsPublisher({
      documents: [
        { source: "getting-started.md", page: "/getting-started/" },
        { source: "configuration.md", page: "/configuration/" },
        { source: "remote-sources.md", page: "/remote-sources/" },
        { source: "architecture.md", page: "/architecture/" },
      ],
      openapi: "openapi.json",
    }),
  ],
});
