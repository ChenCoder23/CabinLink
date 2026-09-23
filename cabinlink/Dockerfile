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
RUN chmod 755 ./start.sh
EXPOSE 80
CMD ["/app/start.sh"]
