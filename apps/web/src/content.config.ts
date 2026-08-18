import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";
import {
  contentPatterns,
  generateContentId,
  workspaceRootUrl,
} from "./content-root.ts";

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: workspaceRootUrl,
      pattern: [...contentPatterns],
      generateId: generateContentId,
    }),
    schema: docsSchema(),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
