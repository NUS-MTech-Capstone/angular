export const config = {
  baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3000/ddm',
  headless: process.env.E2E_HEADLESS === 'true',
  record: process.env.E2E_RECORD === 'true',
  presentation: process.env.E2E_PRESENTATION === 'true',
  /** In presentation mode, pacing is driven by scene pauses in presentation.spec.ts. */
  skipActionPauses: process.env.E2E_PRESENTATION === 'true',
  stepDelayMs: Number(
    process.env.E2E_STEP_DELAY_MS ?? (process.env.E2E_PRESENTATION === 'true' ? 1500 : 0),
  ),
  sceneDelayMs: Number(
    process.env.E2E_SCENE_DELAY_MS ?? (process.env.E2E_PRESENTATION === 'true' ? 3500 : 0),
  ),
  recordLeadInMs: Number(
    process.env.E2E_RECORD_LEAD_IN_MS ?? (process.env.E2E_PRESENTATION === 'true' ? 2500 : 1000),
  ),
  recordTailMs: Number(
    process.env.E2E_RECORD_TAIL_MS ?? (process.env.E2E_PRESENTATION === 'true' ? 3000 : 0),
  ),
  fullScreenRecord:
    process.env.E2E_FULL_SCREEN_RECORD === 'true' ||
    process.env.E2E_PRESENTATION === 'true',
  defaultDevUser: process.env.E2E_DEV_USER ?? 'admin.dev',
  defaultDevUserName: process.env.E2E_DEV_USER_NAME ?? 'Kei Yam',
  implicitWaitMs: Number(process.env.E2E_IMPLICIT_WAIT_MS ?? 5000),
  pageLoadTimeoutMs: Number(process.env.E2E_PAGE_LOAD_TIMEOUT_MS ?? 30000),
};
