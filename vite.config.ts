import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/ChartGPU/" : "/",
  server: {
    port: 5173,
    host: "localhost",
    open: false,
  },
  publicDir: false,
  resolve: {
    alias: {},
  },
});
