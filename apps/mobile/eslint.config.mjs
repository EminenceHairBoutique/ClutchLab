import base from "@clutchlab/config/eslint";

export default [
  ...base,
  { ignores: ["dist/**", ".expo/**"] },
  {
    // Expo tooling entry points are CommonJS by convention.
    files: ["babel.config.js", "metro.config.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
