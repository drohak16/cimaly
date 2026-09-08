// Cimaly recovery build for Cloudflare Workers.
// Keep this isolated on the workers-recovery branch while Pages remains untouched.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    prerender: {
      enabled: false,
    },
  },
  nitro: {
    preset: "cloudflare-module",
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
    cloudflare: {
      nodeCompat: true,
      deployConfig: true,
    },
  },
});
