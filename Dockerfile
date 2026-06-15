# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer unless package-lock changes)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source and compile
COPY . .
RUN npm run build -- --configuration production

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/app.conf

COPY --from=builder --chown=101:101 /app/dist/fe/browser /usr/share/nginx/html

USER 101

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
