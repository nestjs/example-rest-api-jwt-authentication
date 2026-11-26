import { fileURLToPath } from 'node:url';
import { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { DrizzleRefreshTokenStore } from '../src/auth/drizzle-refresh-token.store.js';

// A real PostgreSQL with a pool, where parallel calls really race.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('DrizzleRefreshTokenStore', () => {
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  });
  afterAll(() => pool.end());

  /** The store on an empty table, registered nowhere: the suite builds its own registry. */
  async function emptyStore() {
    await pool.query('TRUNCATE refresh_tokens');
    return { refreshTokens: new DrizzleRefreshTokenStore(db, new AuthenticationStorage()) };
  }

  for (const c of authenticationStoreContract(emptyStore, { contracts: ['refreshTokens'], concurrent: true })) {
    it(c.name, c.run);
  }
});
