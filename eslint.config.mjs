import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // API Elysia/Bun: paket terpisah dengan tsconfig sendiri — aturan
    // Next/React tidak berlaku di sana. Diperiksa dengan `tsc -p server`.
    "server/**",
  ]),
]);

export default eslintConfig;
