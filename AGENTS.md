# AGENTS.md

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

Nest's packages are ESM only. A CommonJS project loads them through `require(esm)`, which needs Node.js 20.19+ or 22.12+, and doesn't have to convert (https://docs.nestjs.com/migration-guide.md).

## Production data: NestJS Observe

This app's production telemetry - traces, errors, logs and metrics - goes to [NestJS Observe](https://observe.nestjs.com). `ObserveModule` is registered first in `src/app.module.ts`, and `src/main.ts` passes `instrument: ObserveInstrument`, but nothing is sent until the app has a key pair: `npx @nestjs/observe link` writes it (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) to `.env` (https://observe.nestjs.com/documentation/sdk#quick-start).

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.

## This project

A REST API for personal notes, the finished app of https://docs.nestjs.com/tutorials/rest-api-jwt-authentication, which explains each part. NestJS Observe is already registered: `ObserveModule.forRoot()` is the first import of `AppModule` in `src/app.module.ts`, and `src/main.ts` passes `instrument: ObserveInstrument` to `NestFactory.create()`. Its key pair is empty until `npx @nestjs/observe link` writes it into `.env`, and until then it sends nothing.

- Layout: one folder per feature under `src/` (`auth`, `users`, `notes`, `health`), each with its module, controller, service or repository, and Zod schemas in `*.schemas.ts`. The environment is a Zod schema in `src/config.ts`, validated at startup; read it with `ConfigService<Env, true>` and `{ infer: true }`, and add every new variable to `.env.example`.
- Database: Drizzle through `@nestjs/drizzle` (`@InjectDrizzle()`), tables in `src/database/schema.ts`. After changing it, run `npm run db:generate -- --name=<change>` and commit the migration it writes to `drizzle/`; apply migrations with `npm run db:migrate`. The tests apply the same migrations, so a missing migration fails them.
- Validation: the global `StandardSchemaValidationPipe` (`APP_PIPE` in `AppModule`) runs the Zod schema passed as `@Body({ schema })`, `@Query({ schema })` or `@Param('id', { schema })`. Optional fields are not nullable (a `null` title is a 400). Don't derive an update schema with `.partial()` from a schema that has `.default()`: the default would overwrite the stored value on every update (see `src/notes/notes.schemas.ts`).
- Auth: `@nestjs/authentication` registers a global guard, so every route requires a valid bearer access token unless it is marked `@Public()`. `JwtAuth` (`src/auth/jwt-auth.provider.ts`) loads the user from the token's `sub`; `@CurrentUser()` gives it to handlers. Mark public routes `@ApiSecurity({})` as well, since `main.ts` requires the bearer token document-wide in the OpenAPI document. Refresh tokens live in PostgreSQL (`DrizzleRefreshTokenStore`); set `NODE_ENV=production` in production, so the module refuses to start if a feature it uses has no store.
- Users: only `UsersRepository` sees password hashes; it returns `User` objects without them. Emails are trimmed, NFC-normalized and lowercased before they are stored or looked up.
- Ownership: every notes query filters on the owner (`NotesService.owned()`), so another user's note answers 404, like a missing one. Writes are single conditional statements (`UPDATE ... WHERE id AND owner_id ... RETURNING`, `INSERT ... ON CONFLICT DO NOTHING`), never read-then-write.
- Rate limits: `ThrottlerGuard` is global, with a `default` throttler per IP and an `account` throttler per email and IP wherever the body names an email (`src/auth/account-email.ts`). Per-route limits use `@Throttle()` and `@SkipThrottle()`, as in `AuthController`; the health checks skip throttling.
- Logging: `ConsoleLogger` writes JSON when `NODE_ENV=production` in the process environment (it is created before `ConfigModule` reads `.env`), and masks `password`, `authorization`, `accessToken` and `refreshToken` in logged objects. Pass values as a structured param (`this.logger.warn('Sign-in failed', { email })`), never interpolated into the message: masking covers objects, not strings.
- Tests: `npm run test:e2e`. `test/notes.e2e-spec.ts` boots the real `AppModule` on PGlite with a cheaper `PasswordHasher`, sending requests with `app.inject()`; it protects deny-by-default (401 without a token), owner scoping (404 for another user's note, empty list), non-nullable updates (400 for `title: null`), and refresh-token rotation with family revocation on reuse. `test/refresh-token.store.e2e-spec.ts` runs the `@nestjs/authentication` store contract, concurrently, against real PostgreSQL at `TEST_DATABASE_URL` (skipped without it); it truncates `refresh_tokens`, so use a test database (`notes_test` in `docker-compose.yml`).

This project is ESM: relative imports end in `.js`, and `__dirname` doesn't exist (use `import.meta.dirname`).
