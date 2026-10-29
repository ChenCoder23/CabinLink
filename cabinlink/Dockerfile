FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
RUN npm run build && mkdir -p dist/server/migrations && cp drizzle/*.sql dist/server/migrations/

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docker/start.sh ./start.sh
COPY scripts/start-production.mjs scripts/word-scheduler.mjs scripts/run-worker.mjs scripts/worker-options.mjs scripts/service-health.mjs scripts/check-service.mjs scripts/outbound-fetch.mjs scripts/patch-wrangler-outbound.mjs ./scripts/
RUN chmod 755 ./start.sh && node ./scripts/patch-wrangler-outbound.mjs
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=8s --start-period=120s --retries=3 CMD ["node", "/app/scripts/check-service.mjs"]
CMD ["/app/start.sh"]
