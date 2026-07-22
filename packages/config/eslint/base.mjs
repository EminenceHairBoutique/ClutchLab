import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config. Enforces the repo conventions from CLAUDE.md:
 * no `any`, no non-null assertions, no swallowed unused errors.
 */
export default tseslint.config(
  { ignores: ["node_modules/", "dist/", ".next/", ".turbo/", "coverage/", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["**/*.mjs", "**/*.cjs", "**/scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
);
