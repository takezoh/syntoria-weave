FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM postgres:18-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/local/LICENSE /app/licenses/node-LICENSE
COPY --from=build /app/LICENSE /app/licenses/application-LICENSE
COPY --from=build /app/vendor/shadcn-tailwind-4.13.0.LICENSE.md /app/licenses/shadcn-tailwind-LICENSE.md
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=postgres:postgres /app/dist/server ./dist/server
COPY --from=build --chown=postgres:postgres /app/node_modules ./node_modules
COPY --from=build --chown=postgres:postgres /app/package.json ./package.json
COPY --from=build --chown=postgres:postgres /app/db/postgres/migrations ./db/postgres/migrations
USER postgres
EXPOSE 8080
ENTRYPOINT ["node"]
CMD ["dist/server/index.mjs"]
