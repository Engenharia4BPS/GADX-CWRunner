import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "/cw/",
  resolve: {
    alias: {
      "@gadx/runner-core": fileURLToPath(new URL("../../packages/runner-core/src/index.ts", import.meta.url)),
    },
  },
});
