# DenDenMushi Angular

Angular web client for the DenDenMushi change-request, inventory, access, user
administration, and terminal workflows.

## Authentication And Routing

Production uses the Cognito-authenticated ALB session cookie. The application
does not store production bearer or PKCE tokens.

- Login navigates the browser to `/ddm/auth/login`.
- Logout navigates the browser to `/ddm/auth/logout`.
- Data APIs remain under same-origin `/ddm`.
- Session creation uses same-origin `POST /sessions/start`.
- WebSockets connect directly to `/sessions/{sessionId}/ws`.

The production environment therefore uses an empty API base URL. Development
continues to use the local JWT flow against `http://localhost:3000`.

## Development

```bash
npm ci
npm start
npm test -- --watch=false
npm run build
```

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
