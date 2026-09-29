export const config = {
  live: process.env.E2E_LIVE === 'true',
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
    process.env.E2E_FULL_SCREEN_RECORD === 'true' || process.env.E2E_PRESENTATION === 'true',
  defaultDevUser: process.env.E2E_DEV_USER ?? 'admin.dev',
  defaultDevUserName: process.env.E2E_DEV_USER_NAME ?? 'Kei Yam',
  cognitoUsername: process.env.E2E_COGNITO_USERNAME ?? '',
  cognitoPassword: process.env.E2E_COGNITO_PASSWORD ?? '',
  expectedDisplayName: process.env.E2E_EXPECTED_DISPLAY_NAME ?? 'kei-admin',
  targetHostId: process.env.E2E_TARGET_HOST_ID ?? 'host-dev-1',
  demoAlarmName: process.env.E2E_DEMO_ALARM_NAME ?? '',
  awsProfile: process.env.AWS_PROFILE ?? 'capstone',
  expectedAwsAccountId: process.env.EXPECTED_AWS_ACCOUNT_ID ?? '891377133321',
  artifactDir: process.env.E2E_ARTIFACT_DIR ?? 'e2e/artifacts/live-core',
  injectionMarker: process.env.E2E_INJECTION_MARKER ?? 'e2e/artifacts/.live-injection-active',
  alarmTimeoutMs: Number(process.env.E2E_ALARM_TIMEOUT_MS ?? 300000),
  incidentTimeoutMs: Number(process.env.E2E_INCIDENT_TIMEOUT_MS ?? 480000),
  remediationTimeoutMs: Number(process.env.E2E_REMEDIATION_TIMEOUT_MS ?? 300000),
  recoveryTimeoutMs: Number(process.env.E2E_RECOVERY_TIMEOUT_MS ?? 300000),
  implicitWaitMs: Number(process.env.E2E_IMPLICIT_WAIT_MS ?? 5000),
  pageLoadTimeoutMs: Number(process.env.E2E_PAGE_LOAD_TIMEOUT_MS ?? 30000),
};
