// Throwaway local PostgreSQL for development (no Docker needed). Not for production.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.env.PGDATA_DIR ?? '.pgdata');
const port = Number(process.env.PGPORT ?? 54331);
mkdirSync(dir, { recursive: true });
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'harvestia', password: 'harvestia', port, persistent: true });
if (!existsSync(resolve(dir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
try { await pg.createDatabase('harvestia'); } catch { /* already exists */ }
console.log(`postgres ready: postgresql://harvestia:harvestia@127.0.0.1:${port}/harvestia`);
process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
