/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Vite + Vitest configuration for the GC Chart Platform frontend.
// The `test` block configures the test runner used for fast-check
// property tests (see src/test/fast-check.setup.ts for the >= 100
// iteration global configuration).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const backendHost = env.VITE_BACKEND_HOST ?? "127.0.0.1";
  const backendPort = env.VITE_BACKEND_PORT ?? "8000";
  const devPort = Number(env.VITE_DEV_PORT ?? "9999");
  const backendHttp = `http://${backendHost}:${backendPort}`;
  const backendWs = `ws://${backendHost}:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: devPort,
      strictPort: true,
      // Proxy REST + WebSocket to the backend so the browser talks same-origin.
      proxy: {
        "/api": {
          target: backendHttp,
          changeOrigin: true,
        },
        "/ws": {
          target: backendWs,
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
  };
});
