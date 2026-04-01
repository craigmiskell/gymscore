import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(["**/out", "**/node_modules", "**/dist", "src/renderer/autocomplete.js", "eslint.config.mjs"]),
    {
        extends: compat.extends("eslint:recommended"),

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.node,
            },

            ecmaVersion: "latest",
            sourceType: "commonjs",
        },

        rules: {
            indent: ["error", 2],
            "linebreak-style": ["error", "unix"],
            quotes: ["error", "double"],
            semi: ["error", "always"],

            "max-len": ["error", {
                code: 120,
                tabWidth: 2,
            }],

            camelcase: ["error", {}],
            curly: ["error", "all"],
            "no-trailing-spaces": ["error"],
        },
    },
    {
        files: ["**/*.ts", "**/*.tsx"],

        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/eslint-recommended",
            "plugin:@typescript-eslint/recommended",
        ),

        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            parser: tsParser,
        },

        rules: {
            "@typescript-eslint/no-explicit-any": 0,
        },
    },
]);
