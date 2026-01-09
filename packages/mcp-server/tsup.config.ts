import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  external: [
    "node:*",
    "@modelcontextprotocol/sdk",
    "@modelcontextprotocol/sdk/*",
    "zod",
    "superjson",
  ],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
