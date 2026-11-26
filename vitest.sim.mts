import { defineConfig } from "vitest/config";

// Simulación completa de un torneo (no corre con test:db). Uso: SIM_LOG=archivo.json npx vitest run --config vitest.sim.mts
export default defineConfig({ test: { include: ["supabase/tests/**/*.sim.ts"], testTimeout: 300000 } });
