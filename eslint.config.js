import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "poc/**",
      ".research/**",
      "research/**",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // ── Type-system hygiene (Python-typing spirit) ─────────────────────────

      // Ban ts-ignore (force fixing the real type issue). Allow ts-expect-error
      // but require an explanation.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          // Default is "ban" (true). Be explicit so intent is clear.
          "ts-ignore": true,
          "ts-nocheck": true,
          // Only allow expect-error with a justification comment.
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],

      // Any defeats type checking. Start as warning (we have legacy any usage);
      // we can tighten to "error" once the surface area is reduced.
      "@typescript-eslint/no-explicit-any": "warn",

      // Non-null assertion is a common escape hatch; prefer runtime checks.
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Type assertions should be rare; prefer narrowing/guards.
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "never",
        },
      ],
    },
  },
];
