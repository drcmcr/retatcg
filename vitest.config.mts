import { defineConfig } from "vitest/config";

// Pruebas de base de datos: usan un Postgres local (ver supabase/tests/README.md).
export default defineConfig({
  test: { include: ["supabase/tests/**/*.test.ts"], testTimeout: 30000, fileParallelism: false },
});
