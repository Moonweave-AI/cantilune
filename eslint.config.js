import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import react from "eslint-plugin-react";

/**
 * Build tooling that no tsconfig owns, so the type-aware rules cannot run on it.
 */
const UNTYPED_FILES = ["src/packages/*/vitest.config.ts", "src/packages/cli/scripts/**/*.{ts,tsx}"];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "formal/**",
      "coverage/**",
      "src/packages/**/tests/support/*.mjs",
    ],
  },
  {
    // Release and tooling scripts shipped alongside the packages.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/packages/**/*.{ts,tsx}"],
    plugins: { sonarjs, unicorn, react },
    settings: { react: { version: "19.0" } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      // Mirrors the SonarLint rules the IDE reports, so CI catches them too.
      // The IDE sources these from several upstream plugins, hence the mix.
      "sonarjs/no-nested-conditional": "error", // S3358
      "sonarjs/cognitive-complexity": "error", // S3776
      "sonarjs/use-type-alias": "error", // S4323
      "unicorn/prefer-at": "error", // S7755
      "unicorn/prefer-array-find": ["error", { checkFromLast: true }], // S7750
      "react/hook-use-state": "error", // S6754
    },
  },
  {
    // Type-aware rules are scoped separately: they need a program, and the
    // package `lint` scripts keep one package in memory at a time so that
    // building those programs stays affordable.
    files: ["src/packages/**/*.{ts,tsx}"],
    ignores: UNTYPED_FILES,
    languageOptions: {
      parserOptions: {
        // Production and test sources are compiled by separate projects.
        project: ["src/packages/*/tsconfig.json", "src/packages/*/tsconfig.tests.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "sonarjs/void-use": "error", // S3735
      "@typescript-eslint/prefer-nullish-coalescing": "error", // S6606
      "@typescript-eslint/no-base-to-string": "error", // S6551
    },
  },
);
