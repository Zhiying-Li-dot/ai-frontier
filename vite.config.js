import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { radar: "index.html", workbench: "workbench.html" },
    },
  },
});
