# Selenium E2E Tests

Browser automation for the DenDenMushi Angular app using
[selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver) and
Google Chrome.

The default suites run against the **development auth flow** (`AUTH_MODE=dev`
on nest-backend). A separate opt-in suite exercises the deployed
ALB/Cognito, Change Request, SSH, CloudWatch, and approval-gated incident
recovery path.

## Prerequisites

Start each prerequisite in a separate terminal from the `angular` repository.

1. **Google Chrome** installed locally
2. **nest-backend** running with dev auth:

   ```bash
   cd ../nest-backend
   AUTH_MODE=dev npm run start:dev
   ```

3. **Angular dev server** running:

   ```bash
   npm start
   ```

## Run tests

From the `angular` directory:

```bash
npm run test:e2e
```

Headless mode (CI-friendly):

```bash
npm run test:e2e:headless
```

The opt-in AWS dev workflow uses the verified capstone account:

```bash
AWS_PROFILE=capstone EXPECTED_AWS_ACCOUNT_ID=891377133321 \
npm run test:e2e:live
```

The runner reads `kei-admin@ddm.keiyam.me` from the macOS Keychain service
`DenDenMushi E2E Cognito`; it never writes the password to files or output.
It creates and retains a timestamped Change Request and incident evidence,
captures only post-authentication screenshots under the ignored
`e2e/artifacts/` directory, and closes the SSH session. If the test stops after
the selected demo application is made unhealthy, the runner invokes the
bounded `ddm-ops recover_demo_app` helper through SSM and waits for the alarm
to recover. The workflow exercises application-health recovery.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:4200` | Angular app URL |
| `E2E_API_URL` | `http://localhost:3000/ddm` | Backend API base |
| `E2E_HEADLESS` | `false` | Set to `true` for headless Chrome |
| `E2E_DEV_USER` | `admin.dev` | Expected username after login |
| `E2E_DEV_USER_NAME` | `Kei Yam` | Dev login button label |
| `E2E_IMPLICIT_WAIT_MS` | `5000` | Selenium implicit wait |
| `E2E_PAGE_LOAD_TIMEOUT_MS` | `30000` | Page load timeout |
| `E2E_LIVE` | `false` | Enables deployed ALB/Cognito service checks |
| `E2E_COGNITO_USERNAME` | `kei-admin@ddm.keiyam.me` | Dedicated live-test login |
| `E2E_ARTIFACT_DIR` | timestamped `e2e/artifacts` directory | Post-authentication evidence output |
| `E2E_ALARM_TIMEOUT_MS` | `300000` | CloudWatch transition limit |
| `E2E_INCIDENT_TIMEOUT_MS` | `480000` | Awaiting-approval limit |
| `E2E_REMEDIATION_TIMEOUT_MS` | `300000` | Completion limit |
| `E2E_RECOVERY_TIMEOUT_MS` | `300000` | Target and alarm recovery limit |

## Layout

```text
e2e/
  config.ts           Shared runtime configuration
  pages/              Page Object Model helpers
  specs/              Mocha test suites
  support/            Driver factory and global setup
```

## Test suites

| Spec | Coverage |
|------|----------|
| `login.spec.ts` | Dev login page and sign-in |
| `navigation.spec.ts` | Icon rail navigation for admin |
| `access.spec.ts` | Access sidebar sections |
| `profile.spec.ts` | Profile page and logout |
| `auth-guard.spec.ts` | Route protection and role limits |
| `live-core-workflow.live.ts` | Opt-in Cognito, CR, SSH, alarm, HITL remediation, and recovery workflow |
