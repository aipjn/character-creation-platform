# Repository Guidelines

## Project Structure & Module Organization
The platform centers on the Express API in `apps/server/src`. Routes and controllers live under `routes/v1/` and `controllers/`, domain logic in `domains/<feature>/`, and background workers in `workers/`. Shared cross-cutting code sits in `shared/` (constants, types, utilities), while database schema, migrations, and seeds are in `prisma/`. Operational scripts reside in `tools/`, and static assets used by the web client belong in `public/`. Build artifacts emit into `dist/` (git-ignored).

## Build, Test, and Development Commands
- `npm run dev` – start the API via `apps/server/src/index.ts` with ts-node reload.
- `npm run dev:client` – incremental TypeScript compilation for client-side bundles defined by `tsconfig.client.json`.
- `npm run build` – transpile server and client targets into `dist/`.
- `npm test` / `npm run test:watch` – execute the Jest suite once or in watch mode.
- `npm run type-check` – strict TypeScript verification across server and shared modules.
- `npm run db:migrate` / `npm run db:seed` – apply Prisma migrations and seed baseline data (requires a running Postgres instance).

## Coding Style & Naming Conventions
Code is TypeScript-first with 2-space indentation, LF endings, and single quotes enforced by Prettier (`.prettierrc`). Run `npx prettier --check .` and `npx eslint "apps/**/*.ts" "shared/**/*.ts"` before opening a PR. Filenames use `camelCase.ts` (`generationQueue.ts`, `metricsCollector.ts`); keep REST routes in `routes/v1/` and background logic in `workers/`. Follow ESLint guidance: declare explicit return types, prefer `const`, and avoid `any`.

## Testing Guidelines
Unit and integration tests co-locate in `__tests__` folders (e.g. `apps/server/src/services/__tests__/generationQueue.test.ts`, `shared/utils/__tests__/searchUtils.test.ts`). Jest (via `ts-jest`) targets Node, stores coverage in `coverage/`, and is configured in `jest.config.js`. Extend existing suites when touching core flows (queues, schemas, middleware) to keep coverage stable; use descriptive test names like `should queue generation jobs in FIFO order`.

## Commit & Pull Request Guidelines
Commits follow imperative, Title Case messages (`Add user sync to local database`). Group related changes and document schema or API adjustments in the body. Pull requests should include: a concise summary, linked issue or ticket, verification steps (`npm test`, `npm run db:migrate`), and screenshots for UI-visible changes. Request review from the relevant module owner (server, shared utilities, data) before merge.

## Environment & Data Setup
Copy `.env.example` to `.env` and fill service credentials (Auth0 steps live in `AUTH0_SETUP.md`). Start dependencies with `docker-compose up postgres redis` or connect to your own Postgres/Redis instances. Run `npm run db:generate` after modifying `prisma/schema.prisma`, and prefer `npm run db:setup` for full bootstrap on new machines.
