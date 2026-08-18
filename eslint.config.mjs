import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // Ported Unilever analytics uses loose analysis payloads; keep build green.
  {
    files: [
      "app/project/**/analytics/**/*.{ts,tsx}",
      "lib/analytics/**/*.{ts,tsx}",
      "lib/api/ResponseAPI.ts",
      "lib/api/StudyAPI.ts",
      "lib/api/AnalyticsAssistantAPI.ts",
      "lib/api/LoginApi.ts",
      "lib/canvas-export.ts",
      "lib/export/**/*.{ts,tsx}",
      "lib/hooks/useAnalyticsAssistant.ts",
      "lib/types/analyticsAssistant.ts",
      "lib/utils/analysisDashboard.ts",
      "lib/utils/analysisTransform.ts",
      "lib/utils/configuratorImageUrls.ts",
      "lib/utils/designConstraintsStorage.ts",
      "lib/utils/filterAnalysisMerge.ts",
      "lib/utils/imageCacheManager.ts",
      "lib/utils/personaBlueprints.ts",
      "components/analytics/**/*.{ts,tsx}",
      "components/shared/ProgressiveImage.tsx",
      "components/ui/ImageLightboxModal.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
