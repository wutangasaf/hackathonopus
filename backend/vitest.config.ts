import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
    testTimeout: 10_000,
    clearMocks: true,
  },
});
