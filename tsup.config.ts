import { defineConfig } from "tsup";

export default defineConfig([
  // Stdio entry point (Node.js CLI)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
