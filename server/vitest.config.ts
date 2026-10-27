import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgres://test:test@localhost/test",
      JWT_SECRET: "test-secret-test-secret-test-secret-0123456789",
    },
  },
});
