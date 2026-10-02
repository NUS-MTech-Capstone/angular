# DenDenMushi Angular

Angular web client for the DenDenMushi change-request, inventory, access, user
administration, and terminal workflows.

In the Phase 1 baseline, Angular uses the authenticated ALB session, same-origin
webapp APIs, and direct Proxy Control Plane/Proxy Dataplane routes. It does not
store production bearer tokens and does not proxy terminal traffic through the
Nest Backend.

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
- Open terminal WebSockets send an empty `0x11` heartbeat every 30 seconds so
  transport idle timeouts do not interrupt a live browser tab.
- After 15 minutes without terminal input, output, or resize activity, the
  client sends `0x12`, detaches gracefully, and leaves the persistent session
  available for rejoin. Heartbeats do not reset this application idle timer.
- Users with `session-audit.view` can open `/session-audit` to review retained
  SSH command/output audit fetched from `/ddm/session-audit`; this page is a
  read-only REST view and never opens a terminal observer WebSocket.

When a production API call returns 401, the client clears its cached profile and
navigates to the Angular `/login` page. The user explicitly starts the ALB
authentication flow from the Login button, which prevents repeated
`/access -> /ddm/auth/login -> /access` redirects if the ALB session is missing
or rejected.

The production environment therefore uses an empty API base URL. Development
continues to use the local JWT flow against `http://localhost:3000`; local SSH
gateway calls use `environment.gatewayUrl`.

## Agentic AI Workspace

Agentic AI uses a single, persistent tabbed workspace. Incidents are the
default operator view and Alerts provide supporting monitoring context:

```text
/agentic-ai                         -> /agentic-ai/incidents
/agentic-ai/incidents               incident list
/agentic-ai/incidents/:incidentId   full incident workspace
/agentic-ai/alerts                  alert list
/agentic-ai/alerts/:alertId         concise alert context
```

Legacy `/agentic-ai?incidentId=...` links redirect to the dedicated incident
route. The previous incident and alert drawers have been removed so details are
deep-linkable and the current outcome, workflow step, and required human action
remain visible at presentation resolution.

Incident detail presents Overview, Agent activity, Evidence and safety, and
Timeline and audit sections. The activity view distinguishes deterministic,
model-assisted, bounded-tool, and human actors; overlays the actual A2A
handoffs; and numbers tool calls by diagnose, remediate, and verify phase.
Readable operation labels are shown alongside operation IDs. Diagnostic output,
model/catalog/gateway identity, hashes, and responsibility detail are collapsed
by default. The page displays stored safe summaries only and never requests or
renders chain-of-thought, prompts, tokens, command bodies, secrets, or terminal
traffic.

`DIAGNOSING` and `EXECUTING` incident details refresh every five seconds. The
poll stops on terminal states and component destruction, and approval/rejection
refreshes immediately. Manager/Admin role checks and exact stored plan-hash
submission are unchanged.

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
immutable caching headers, while SPA HTML and probe responses use
`Cache-Control: no-store`. Application routes fall back to `index.html`.

Nginx applies the enforced application CSP, clickjacking and MIME-sniffing
protection, a restricted permissions policy, the referrer policy, and
`Strict-Transport-Security: max-age=31536000`. The CSP intentionally retains
the sources required by the current Angular and WebSocket UI; COEP and COOP are
not enabled because the application does not require cross-origin isolation.
Nginx version tokens are disabled.
