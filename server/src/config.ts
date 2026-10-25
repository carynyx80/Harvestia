// Runtime configuration, read once from the environment.
const list = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // Railway routes to the container, so listen on all interfaces there; loopback locally.
  host: process.env.HOST ?? (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1'),
  env: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? 'development',
  commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
  /** Exact origins allowed to call the API (the Vercel frontend and local dev). */
  corsOrigins: list(process.env.CORS_ORIGINS ?? 'https://harvestia-one.vercel.app,http://localhost:5180'),
  /** Vercel preview deployments of this project, e.g. harvestia-abc123-carynyx1.vercel.app */
  corsPreviewPattern: /^https:\/\/harvestia-[a-z0-9-]+-carynyx1\.vercel\.app$/,
};
