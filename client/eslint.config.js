import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactPlugin from "eslint-plugin-react";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores(["dist"]),
	{
		files: ["scripts/**/*.js"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: {
				...globals.node,
				require: "readonly",
				__dirname: "readonly",
				process: "readonly",
			},
			parserOptions: {
				ecmaVersion: "latest",
			},
		},
		rules: {
			"no-unused-vars": "off",
			"no-undef": "off",
		},
	},
	{
		files: ["**/*.{js,jsx}"],
		extends: [
			js.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		plugins: { react: reactPlugin },
		rules: {
			"react/jsx-uses-vars": "error",
			"no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
		},
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				ecmaVersion: "latest",
				ecmaFeatures: { jsx: true },
				sourceType: "module",
			},
		},
	},
]);
