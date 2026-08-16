import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import noRawHexColor from "./eslint-rules/no-raw-hex-color.mjs";

export default tseslint.config(
  {
    // `dist-pages` is the static publication's build output, produced by the
    // Playwright projects that exercise it. Build output is not source, and
    // linting a bundle only reports on the bundler.
    ignores: [
      "dist",
      "dist-pages",
      "coverage",
      "storybook-static",
      "playwright-report",
      "test-results",
      "node_modules",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // --- product guards, not style preferences ---------------------------
      // Raw HTML injection is how a source snapshot becomes an XSS vector.
      "react/no-danger": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "dangerouslySetInnerHTML yasak: kaynak metni ve API içeriği güvenilmez girdidir.",
        },
        {
          selector:
            "CallExpression[callee.object.name='localStorage'], CallExpression[callee.object.name='sessionStorage']",
          message:
            "Kimlik, oturum veya profil verisi tarayıcı deposunda tutulamaz. Görünüm tercihleri için zustand persist kullanın.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    // P1C token contract: a component never spells a colour, it reads one.
    // Scoped to `.tsx` only, per the contract - `.ts` files carry no markup
    // and are not where a hard-coded colour would render.
    files: ["**/*.tsx"],
    plugins: { local: { rules: { "no-raw-hex-color": noRawHexColor } } },
    rules: {
      "local/no-raw-hex-color": "error",
    },
  },
  {
    // Tests and mocks legitimately reach for globals and loose typing.
    files: ["**/*.{test,spec}.{ts,tsx}", "src/test/**", "src/mocks/**", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // The acceptance gate runner. Plain Node, no TypeScript program behind it:
    // it is the thing that *starts* the type checker, so it cannot be inside
    // the project the type checker builds.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    // Playwright's fixture API is `async ({ page }, use) => { await use(x) }`.
    // That `use` is not React's, and there is no React in this directory.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
);
