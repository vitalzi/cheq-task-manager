# Agent decisions

Small decisions the agent made while building, one entry per decision with the task number and the reason. Decisions agreed beforehand live in `docs/decisions.md`; do not mix the two.

## Task 2: Backend scaffold

- **TypeScript pinned to ~5.9 in `backend/`:** ts-jest 29 cannot use the TypeScript 7 compiler API that npm installs by default.
- **Jest transforms `cookie`:** Fastify's `inject()` pulls in the ESM-only `cookie@2`, and Jest runs CommonJS. `jest.config.js` lets ts-jest transpile that one package (`allowJs` in `tsconfig.json`).

## Task 3: Task store

- **Contract helper is `taskStore.contract.ts`, not `*.test.ts`:** Jest does not run it on its own; each store's test file calls `describeTaskStore`. `tsconfig.json` excludes it so test code is not compiled into `dist`.
- **`list()` returns a copy (`[...this.tasks]`):** callers cannot change the store through the returned array; the contract test pins this.

## Task 4: Task service

- **Validation messages:** `title must be a string`, `title must not be empty`, `title must be at most 200 characters`. They are the `error` text clients see, so each names the rule that failed.
- **`ValidationError` has no extra fields:** the error handler only needs `instanceof ValidationError` to pick `400`.

## Task 5: Task routes

- **Ajv `coerceTypes: false`:** Fastify's default Ajv turns `{ "title": 42 }` into `"42"` and `["a"]` into `"a"`, so a wrong type returned `201`. Found by the HTTP tests; a wrong type must be `400`.
- **`text/plain` body gives `400`, not `415`:** Fastify has a built-in `text/plain` parser, so the body is a string and fails the schema's "must be object" check. The task allows `400`/`415`; I did not add a custom parser. A content type with no parser (for example `application/xml`) gives `415`.
- **Fastify's own 4xx messages are passed through:** schema, malformed JSON and media-type errors keep Fastify's text in the `error` field (for example `body/title must be string`). They are accurate and specific, so I did not rewrite them.
- **`500` returns a fixed `Internal Server Error`:** the real error is logged with `request.log.error`, never sent to the client, so store details cannot leak. A test pins this.
- **Not-found message is `Route not found`:** one message for unknown routes and unsupported methods; Fastify answers both with 404.
- **Routes are a plain function `registerTaskRoutes(app, service)`:** stateless, and Fastify expects functions here. `buildApp` creates the `TaskService` from the store it is given.

## Task 2/3 follow-up (found during Task 5)

- **`"types": ["node", "jest"]` in `tsconfig.json`:** fixes the editor errors on `describe`/`expect`. VS Code bundles TypeScript 6.0, which no longer loads `@types/*` automatically (our CLI uses 5.9, which does). Listing them works on both.
- **Tests stay in `tsconfig.json`; `tsconfig.build.json` excludes them for `npm run build`:** I tried putting the `exclude` back and deleting the second file, and the owner still saw red underlines in VS Code. The diagnostics tool had reported no errors for those files, so it is not a reliable check for excluded files. Only the owner's editor settles this. Bonus: `tsc --noEmit` type-checks tests too.
