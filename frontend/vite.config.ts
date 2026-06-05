/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite + Vitest configuration for the GC Chart Platform frontend.
// The `test` block configures the test runner used for fast-check
// property tests (see src/test/fast-check.setup.ts for the >= 100
// iteration global configuration).
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    // Proxy REST + WebSocket to the backend so the browser talks same-origin.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/fast-check.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
