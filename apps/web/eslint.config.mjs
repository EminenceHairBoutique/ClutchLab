import { FlatCompat } from "@eslint/eslintrc";

import base from "@clutchlab/config/eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...base,
];

export default config;
