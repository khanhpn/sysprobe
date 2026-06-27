import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "coverage"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["**/*.ts"],
    rules: {
      "prefer-arrow-callback": "error",
      "func-style": ["error", "expression"]
    }
  }
);
