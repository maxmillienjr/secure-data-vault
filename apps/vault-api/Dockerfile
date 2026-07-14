# ── Stage 1: Builder ──────────────────────────────────────────────
FROM node:26-alpine AS builder

WORKDIR /app

# Copy workspace root config
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./

# Copy package definitions for dependency resolution
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/crypto-core/package.json packages/crypto-core/
COPY packages/audit-core/package.json packages/audit-core/
COPY apps/vault-api/package.json apps/vault-api/

# Install dependencies
RUN npm install -g corepack@latest && corepack enable && corepack prepare yarn@4.9.1 --activate
RUN yarn install --immutable || yarn install

# Copy source code
COPY packages/ packages/
COPY apps/vault-api/ apps/vault-api/

# Build all workspaces in dependency order
RUN yarn workspaces foreach -A --topological run build

# ── Stage 2: Runner ──────────────────────────────────────────────
FROM node:26-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace root
COPY package.json yarn.lock .yarnrc.yml ./

# Copy package definitions
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/crypto-core/package.json packages/crypto-core/
COPY packages/audit-core/package.json packages/audit-core/
COPY apps/vault-api/package.json apps/vault-api/

# Install production dependencies only
RUN npm install -g corepack@latest && corepack enable && corepack prepare yarn@4.9.1 --activate
RUN yarn workspaces focus @secure-data-vault/vault-api --production || yarn install --production

# Copy built artifacts
COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /app/packages/crypto-core/dist packages/crypto-core/dist
COPY --from=builder /app/packages/audit-core/dist packages/audit-core/dist
COPY --from=builder /app/apps/vault-api/dist apps/vault-api/dist

# Copy dev keysets (only for dev/demo images)
# DEV ONLY — production images should NOT include keysets
COPY packages/crypto-core/keysets packages/crypto-core/keysets

# Copy drizzle-kit and schema for auto-migration on startup
COPY --from=builder /app/node_modules/drizzle-kit node_modules/drizzle-kit
COPY apps/vault-api/drizzle.config.ts apps/vault-api/drizzle.config.ts
COPY apps/vault-api/src/db/schema.ts apps/vault-api/src/db/schema.ts

# Copy entrypoint script
COPY apps/vault-api/entrypoint.sh apps/vault-api/entrypoint.sh

# Non-root user
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser

EXPOSE 3000

ENTRYPOINT ["sh", "apps/vault-api/entrypoint.sh"]
