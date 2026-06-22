module.exports = {
  timeout: 60000,
  require: ['tsx/cjs', './e2e/support/setup.ts'],
  spec: ['e2e/specs/**/*.spec.ts'],
};
