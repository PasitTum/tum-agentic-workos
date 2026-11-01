# Multi-stage Dockerfile for TUM Agentic WorkOS
# Build Stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY tests ./tests
RUN npm run build

# Production Runtime Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

USER node
CMD ["node", "dist/presentation/server/api-server.js"]
