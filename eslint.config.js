import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const rawStorageCall =
  "MemberExpression[object.type='MemberExpression'][object.object.type='MemberExpression'][object.object.object.name='browser'][object.object.property.name='storage'][object.property.name='local']";
const rawSendMessageCall =
  "CallExpression[callee.type='MemberExpression'][callee.property.name='sendMessage'][callee.object.type='MemberExpression'][callee.object.property.name='runtime']";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: rawStorageCall,
          message: "Use the typed storage API instead of browser.storage.local directly.",
        },
        {
          selector: rawSendMessageCall,
          message: "Use sendCommand() so background commands remain type checked.",
        },
      ],
    },
  },
  {
    files: ["src/shared/storage.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: rawSendMessageCall,
          message: "Use sendCommand() so background commands remain type checked.",
        },
      ],
    },
  },
  {
    files: ["src/shared/messages.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: rawStorageCall,
          message: "Use the typed storage API instead of browser.storage.local directly.",
        },
      ],
    },
  },
  {
    files: [
      "src/content/**/*.{ts,tsx}",
      "src/features/*/content/**/*.{ts,tsx}",
      "src/features/*/gateway/**/*.{ts,tsx}",
      "src/options/**/*.{ts,tsx}",
      "src/popup/**/*.{ts,tsx}",
      "src/survey/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: rawStorageCall,
          message: "Use the typed storage API instead of browser.storage.local directly.",
        },
        {
          selector: rawSendMessageCall,
          message: "Use sendCommand() so background commands remain type checked.",
        },
        {
          selector: "ImportSpecifier[imported.name='setDayState']",
          message: "DayState is background-owned; send a typed command instead.",
        },
      ],
    },
  },
];
