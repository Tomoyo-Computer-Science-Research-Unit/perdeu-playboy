// ESLint flat config (ESLint 9). eslint-config-next 15 ainda publica configs no formato antigo;
// o FlatCompat os traduz. Os snapshots gerados e a saída do build não são lintados.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "public/data/**",
      "data/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
];

export default config;
