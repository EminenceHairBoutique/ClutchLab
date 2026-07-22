import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

import base from "@clutchlab/config/eslint";

// eslint-config-next 16 ships native flat configs (no FlatCompat/eslintrc bridge).
const config = [...coreWebVitals, ...nextTypescript, ...base];

export default config;
