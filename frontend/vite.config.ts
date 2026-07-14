import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Packaged Electron loads dist/index.html via file://, where absolute
  // asset paths ("/assets/...") resolve to the filesystem root and produce a
  // blank window. Relative paths fix it — this is the single most common
  // Electron+Vite integration bug, so it's called out here rather than left
  // as an unexplained flag.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
