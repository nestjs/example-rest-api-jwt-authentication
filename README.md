# Notes API: a NestJS REST API with JWT authentication

This is the finished application of the tutorial [Build a REST API with JWT authentication in Node.js](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication) in the NestJS documentation. The tutorial builds it step by step and explains each decision; this repository holds the result.

## What it does

The API stores personal notes. Users sign up with an email and a password, get a 15-minute JWT access token and a refresh token, and read and write only their own notes.

- Sign-in with [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication): passwords hashed with scrypt, HS256 access tokens, refresh tokens that rotate on every use and revoke their whole family when one is reused. Every route requires a bearer token unless it is marked public.
- Users, notes and refresh tokens in PostgreSQL, through Drizzle.
- Zod schemas validate every request body, query string and route parameter, and the environment at startup: the app refuses to start when its configuration is missing or malformed.
- Rate limits per IP address, and per email and IP address on sign-in.
- Security headers on every response, and CORS only for the origins you list.
- An OpenAPI document with Swagger UI, liveness and readiness checks, shutdown hooks, and JSON logs in production with passwords and tokens masked.
- NestJS Observe wired in, sending nothing until you link the project.

## Run it

You need Node.js 22 or later, and Docker for PostgreSQL.

```bash
git clone https://github.com/nestjs/example-rest-api-jwt-authentication.git
cd example-rest-api-jwt-authentication
npm install
cp .env.example .env    # then set JWT_SECRET: openssl rand -base64 32
docker compose up -d
npm run db:migrate
npm run start:dev
```

The API listens on http://localhost:3000, with Swagger UI at http://localhost:3000/docs.

```bash
curl -X POST http://localhost:3000/auth/sign-up \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse battery"}'
```

The answer holds an `accessToken` to send as `Authorization: Bearer <token>` to the other routes, and a `refreshToken` for `POST /auth/token/refresh`.

## Endpoints

| Endpoint | Auth | Tutorial section |
| --- | --- | --- |
| `GET /notes`, `GET /notes/:id`, `POST /notes`, `PATCH /notes/:id`, `DELETE /notes/:id` | bearer token, owner only | [Start with one file](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#start-with-one-file), scoped to their owner in [Sign users in with JWTs](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#sign-users-in-with-jwts) |
| `POST /auth/sign-up`, `POST /auth/token`, `POST /auth/token/refresh`, `POST /auth/token/revoke` | public | [Sign users in with JWTs](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#sign-users-in-with-jwts) |
| `GET /me` | bearer token | [Sign users in with JWTs](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#sign-users-in-with-jwts) |
| `GET /docs` | public | [Describe the API with OpenAPI](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#describe-the-api-with-openapi) |
| `GET /health/live`, `GET /health/ready` | public | [Add health checks](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#add-health-checks) |

`GET /notes` takes `limit` (1 to 100, default 20) and `offset`. The rate limits are in [Rate-limit sign-in](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#rate-limit-sign-in).

## Layout

| Path | What it holds |
| --- | --- |
| `src/main.ts` | bootstrap on the Node adapter: logger, security headers, CORS, Swagger UI, shutdown hooks |
| `src/app.module.ts` | NestJS Observe, config, database, authentication, throttler, the global validation pipe |
| `src/config.ts` | the environment, as a Zod schema checked at startup |
| `src/database/schema.ts` | Drizzle tables: users, notes, refresh_tokens |
| `src/auth/` | sign-up and token endpoints, the JWT bearer provider, password checks, the refresh-token store |
| `src/users/` | the users repository and `GET /me` |
| `src/notes/` | the notes resource, scoped to its owner |
| `src/health/` | liveness and readiness |
| `drizzle/` | migrations |
| `test/` | end-to-end tests on PGlite, and the refresh-token store contract on PostgreSQL |

## Tests

```bash
TEST_DATABASE_URL=postgres://postgres:notes@localhost:5432/notes_test npm run test:e2e
```

`test/notes.e2e-spec.ts` boots the whole app on [PGlite](https://pglite.dev) (PostgreSQL in WebAssembly, with the real migrations), so it needs no server. `test/refresh-token.store.e2e-spec.ts` runs the `@nestjs/authentication` store contract against real PostgreSQL, and is skipped when `TEST_DATABASE_URL` isn't set. `docker compose` creates the `notes_test` database; the store test truncates its `refresh_tokens` table, so never point it at your development database.

## Stack

[NestJS](https://nestjs.com) 12 on the Node adapter, [Zod](https://zod.dev) with `StandardSchemaValidationPipe`, [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication), [`@nestjs/config`](https://docs.nestjs.com/application/configuration), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle) with PostgreSQL 17, [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting), [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction), [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus), [NestJS Observe](https://docs.nestjs.com/observability/overview), and Vitest with PGlite.

## Production

Read the tutorial's [production checklist](https://docs.nestjs.com/tutorials/rest-api-jwt-authentication#production-checklist) first.

The app registers [NestJS Observe](https://docs.nestjs.com/observability/overview), which records requests per route, traces with their SQL queries, and errors. It sends nothing until it has a key pair: `npx @nestjs/observe link` writes `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` into `.env`. In production, set them in the platform's environment, since `start:prod` doesn't load `.env`.

## License

MIT
