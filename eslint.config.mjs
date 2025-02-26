import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Ignore patterns (equivalent to .eslintignore or ignorePatterns)
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.d.ts",
      "*.js",
      "scripts/**" // Exclude all scripts directory files
    ]
  },
  ...compat.extends("prettier"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["scripts/**/*.ts"], // Explicitly ignore TypeScript files in scripts directory
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      "no-unused-vars": "off", // Turn off the base rule
      "@typescript-eslint/no-unused-vars": ["warn", {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_"
      }],
      // Additional rules to catch unused exports
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      // Copy over other useful rules from .eslintrc.json
      "no-unreachable": "warn",
      "no-empty-function": "warn",
      "no-empty": ["warn", { "allowEmptyCatch": true }],
      "no-useless-escape": "warn"
    },
  },
  // Special configuration for test files
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
];

export default eslintConfig;
