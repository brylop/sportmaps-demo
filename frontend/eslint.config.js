import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Tokens de tamaño (docs/design-tokens.md): avisa — NO falla el CI — cuando
// un className trae un ancho/alto/espacio en píxeles fijos (w-[300px],
// max-h-[85vh] no entra: solo px). La deuda existente sale como warning; lo
// nuevo debería usar un token (max-w-page, h-touch, pb-nav-safe, …).
const PX_ARBITRARIO = String.raw`/\b(?:min-|max-)?(?:w|h|size|top|left|right|bottom|inset|gap(?:-[xy])?|p[xytrbl]?|m[xytrbl]?)-\[\d+px\]/`;
const MSG_PX = "Usa un token de tamaño (docs/design-tokens.md) en vez de píxeles fijos";

export default tseslint.config(
  { ignores: ["dist", "android", "src/integrations/supabase/types.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-syntax": [
        "warn",
        { selector: `Literal[value=${PX_ARBITRARIO}]`, message: MSG_PX },
        { selector: `TemplateElement[value.raw=${PX_ARBITRARIO}]`, message: MSG_PX },
      ],
    },
  },
);
