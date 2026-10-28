import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

import connectionBeforeSupabase from "./eslint-rules/connection-before-supabase.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Render code must wait for the request before creating the Supabase
    // server client. See eslint-rules/connection-before-supabase.mjs.
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    plugins: {
      budgetku: {
        rules: { "connection-before-supabase": connectionBeforeSupabase },
      },
    },
    rules: { "budgetku/connection-before-supabase": "error" },
  },
];

export default eslintConfig;
