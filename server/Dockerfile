# Harvestia API (Railway). Built from the repository root so the shared game rules
# in /shared are bundled into the server exactly as the browser uses them.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci
COPY shared shared
COPY server server
RUN cd server && npm run build && npm prune --omit=dev
WORKDIR /app/server
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && node --enable-source-maps dist/index.js"]
