# GoDigital API — build од ROOT контекст (pnpm workspace).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gd/db exec prisma generate
RUN pnpm --filter @gd/core build && pnpm --filter @gd/api build

FROM base AS runtime
ENV NODE_ENV=production
# Claude Code CLI за CLAUDE_MODE=cli (auth преку CLAUDE_CODE_OAUTH_TOKEN).
RUN npm i -g @anthropic-ai/claude-code
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
