# Selenium E2E Tests

Browser automation for the DenDenMushi Angular app using
[selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver) and
Google Chrome.

These tests run against the **development auth flow** (`AUTH_MODE=dev` on
nest-backend). Production ALB/Cognito login is not exercised here.

## Prerequisites

1. **Google Chrome** installed locally
2. **nest-backend** running with dev auth:

   ```bash
   cd nest-backend
   AUTH_MODE=dev npm run start:dev
   ```

3. **Angular dev server** running:

   ```bash
   cd angular
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
