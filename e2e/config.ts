export const config = {
  baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3000/ddm',
  headless: process.env.E2E_HEADLESS === 'true',
  defaultDevUser: process.env.E2E_DEV_USER ?? 'admin.dev',
  defaultDevUserName: process.env.E2E_DEV_USER_NAME ?? 'Kei Yam',
  implicitWaitMs: Number(process.env.E2E_IMPLICIT_WAIT_MS ?? 5000),
  pageLoadTimeoutMs: Number(process.env.E2E_PAGE_LOAD_TIMEOUT_MS ?? 30000),
};
