import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    css: false,
    testTimeout: 10_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
