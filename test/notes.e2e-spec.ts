import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PasswordHasher } from '@nestjs/authentication';
import { getDrizzleToken } from '@nestjs/drizzle';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { AppModule } from '../src/app.module.js';

describe('Notes API (e2e)', () => {
  const pglite = new PGlite(); // PostgreSQL in-process: no server to start
  let app: NestNodeApplication;

  beforeAll(async () => {
    const db = drizzle({ client: pglite });
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDrizzleToken())
      .useValue(db)
      // scrypt at the default cost takes 128 MiB and a few hundred ms per hash.
      .overrideProvider(PasswordHasher)
      .useValue(new PasswordHasher({ logN: 10 }))
      .compile();
    app = moduleRef.createNestApplication<NestNodeApplication>(new NodeAdapter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await pglite.close();
  });

  async function signUp(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/sign-up',
      payload: { email, password: 'correct horse battery' },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ accessToken: string; refreshToken: string }>();
  }

  it('rejects requests without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/notes' });
    expect(res.statusCode).toBe(401);
  });

  it('creates, updates and lists notes for their owner only', async () => {
    const ada = await signUp('ada@example.com');
    const bob = await signUp('bob@example.com');
    const asAda = { authorization: `Bearer ${ada.accessToken}` };
    const asBob = { authorization: `Bearer ${bob.accessToken}` };

    const created = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: asAda,
      payload: { title: 'Buy milk', body: '2 litres' },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();

    const nulled = await app.inject({ method: 'PATCH', url: `/notes/${id}`, headers: asAda, payload: { title: null } });
    expect(nulled.statusCode).toBe(400);

    const renamed = await app.inject({ method: 'PATCH', url: `/notes/${id}`, headers: asAda, payload: { title: 'Buy oat milk' } });
    expect(renamed.json()).toMatchObject({ title: 'Buy oat milk', body: '2 litres' });

    const stolen = await app.inject({ method: 'GET', url: `/notes/${id}`, headers: asBob });
    expect(stolen.statusCode).toBe(404);
    const bobsList = await app.inject({ method: 'GET', url: '/notes', headers: asBob });
    expect(bobsList.json()).toEqual([]);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { refreshToken } = await signUp('carol@example.com');
    const refresh = (token: string) =>
      app.inject({ method: 'POST', url: '/auth/token/refresh', payload: { refreshToken: token } });

    const first = await refresh(refreshToken);
    expect(first.statusCode).toBe(200);
    const successor = first.json<{ refreshToken: string }>().refreshToken;

    expect((await refresh(refreshToken)).statusCode).toBe(401); // reused: the family is revoked
    expect((await refresh(successor)).statusCode).toBe(401);
  });
});
