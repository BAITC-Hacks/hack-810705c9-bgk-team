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
  ]),

  // Вендорный код shadcn/ui: штатные компоненты нарушают react-hooks/set-state-in-effect.
  {
    files: ["src/shared/components/ui/**/*.{ts,tsx}", "src/shared/hooks/use-mobile.ts"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Upstream AI Elements use patterns rejected by React Compiler diagnostics.
  // Keep these visible as warnings in vendor code; app code keeps strict defaults.
  {
    files: ["src/shared/components/ai-elements/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
