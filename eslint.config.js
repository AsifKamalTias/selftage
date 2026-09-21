// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'example/*', '.expo/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Logging goes through src/lib/logger.ts, which keeps entries for the
      // diagnostics screen; a bare console call would be invisible there.
      'no-console': 'error',
      // An empty catch hides a failure with no way to notice it later.
      'no-empty': ['error', { allowEmptyCatch: false }],
      // `throw 'text'` loses the stack; always throw an Error.
      'no-throw-literal': 'error',
    },
  },
  {
    // The logger itself is the one place allowed to reach the console.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
]);
