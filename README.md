# DenDenMushi Angular

Angular web client for the DenDenMushi change-request, inventory, access, user
administration, and terminal workflows.

## Authentication And Routing

Production uses the Cognito-authenticated ALB session cookie. The application
does not store production bearer or PKCE tokens.

- Login navigates the browser to `/ddm/auth/login`.
- Logout navigates the browser to `/ddm/auth/logout`.
- Webapp data APIs remain under same-origin `/ddm`.
- SSH session control uses the Proxy Control Plane directly under same-origin
  `/sessions`.
- Session creation uses `POST /sessions/start`.
- Owner rejoin uses `POST /sessions/{gatewaySessionId}/rejoin`.
- Authenticated read-only observing uses
  `POST /sessions/{gatewaySessionId}/observe` and receives an observer token.
- Session stop uses `POST /sessions/{gatewaySessionId}/close`.
- Active session lists use `GET /sessions`.
- WebSockets connect directly to `/sessions/{sessionId}/ws`.

When a production API call returns 401, the client clears its cached profile and
navigates to the Angular `/login` page. The user explicitly starts the ALB
authentication flow from the Login button, which prevents repeated
`/access -> /ddm/auth/login -> /access` redirects if the ALB session is missing
or rejected.

The production environment therefore uses an empty API base URL. Development
continues to use the local JWT flow against `http://localhost:3000`; local SSH
gateway calls use `environment.gatewayUrl`.

## Development

```bash
npm ci
npm start
npm test -- --watch=false
npm run build
```

## Selenium E2E tests

Browser tests live under `e2e/` and use Chrome via `selenium-webdriver`.
They require the dev auth flow (`AUTH_MODE=dev` on nest-backend) plus both
services running locally.

```bash
# terminal 1
cd ../nest-backend && AUTH_MODE=dev npm run start:dev

# terminal 2
npm start

# terminal 3
npm run test:e2e
npm run test:e2e:headless
```

See [e2e/README.md](e2e/README.md) for environment variables and suite details.

## Container

The image builds with Node.js 22 and serves the compiled SPA from unprivileged
Nginx on port `8080`.

```http
GET /healthz
GET /readyz
```

Both probe endpoints are served directly by Nginx. Hashed static assets receive
immutable caching headers, application routes fall back to `index.html`, and
security headers are applied at the web server.
