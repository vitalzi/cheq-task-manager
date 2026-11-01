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

## Task 6: Logging, CORS, server entry

- **`buildApp(store, options)` with `AppOptions { logger, corsOrigin }`:** tests need to inject a log stream and an origin; `server.ts` fills them from the environment. Both are optional, so `buildApp(store)` still works and stays silent (logger off) in tests.
- **Our own `onResponse` hook, Fastify's request logging off:** Fastify normally logs two lines per request ("incoming request", "request completed") without the fields the task asks for. `LogController({ disableRequestLogging: true })` leaves only our single line. The top-level `disableRequestLogging` option works but prints a deprecation warning in this Fastify version.
- **Log fields `method`, `path`, `status`, `responseTimeMs`:** `path` has the query string stripped, because query values can carry secrets. Pino adds `reqId`, `time` and `level`. `responseTimeMs` comes from `reply.elapsedTime` and is not rounded.
- **CORS origin passed as a one-item array:** with a plain string, `@fastify/cors` sends the allowed origin to every caller. The browser still blocks the mismatch, but the array makes the server compare and send nothing to other sites.
- **No `CORS_ORIGIN` means no CORS plugin:** same-origin only. Local dev goes through the Vite proxy (task 8); the deployed API gets the S3 website URL from Terraform (task 13).
- **`npm audit` reports `deepmerge` in Jest's dev tree:** not from `@fastify/cors`, not in the production image. The suggested fix downgrades Jest to v25, so I did not apply it.

## Restructure: `src/tasks/`

- **Task files grouped in `backend/src/tasks/`, tests stay next to their code:** `src/` had 13 flat files. `docs/plan.md` had planned a separate `test/` folder; tests were co-located from Task 2 on without flagging the change. The owner agreed to co-location after the trade-offs were explained (a separate folder needs `rootDir`/`include` changes in the tsconfigs, longer imports and mirrored folders). `docs/plan.md` layout updated to match.

## Task 7: Coverage gate

- **Coverage runs on every `npm test` (`collectCoverage: true`):** the 80% gate then cannot be skipped by forgetting a flag, and CI (task 15) needs no extra command. Cost: about a second more per run.
- **`collectCoverageFrom` lists `src/**/*.ts` minus `*.test.ts` and `*.contract.ts`:** without it Jest only counts files a test imports, so `server.ts` would be invisible. The contract file is test code and would inflate the numbers.
- **`server.ts` is not excluded:** it sits at 0%, but total coverage is 89% (statements), well over 80%, so no exclusion is needed. The task allowed one; not taking it keeps the number honest.

## Task 8: Frontend scaffold

- **No frontend tests, no test dependency:** `plan.md` and `decisions.md` skip frontend tests in the MVP and Jest/Vitest for React is not in the approved stack. The TDD skill conflicts; CLAUDE.md wins. Check is the browser check from tasks.md.
- **`typescript@~5.9` in the frontend:** npm picked 7.x by default; matching the backend keeps one compiler version across the repo.
- **`@vitejs/plugin-react` added:** the standard glue that makes Vite compile JSX with Fast Refresh. Needed for any Vite + React app, so treated as part of the approved stack.
- **Proxy target hardcoded to `http://localhost:3000`:** an env override needs `@types/node` for no current benefit. It is a dev-only setting.
- **`VITE_API_URL ?? ''`:** empty locally (calls go through the Vite proxy), the ALB URL in the deployed build.
- **Health badge has three states (up / down / checking) and `retry: false`:** "checking" avoids a red flash on first load; no retry so one failed poll turns it red at once.
- **`build` script runs `tsc --noEmit` before `vite build`:** Vite does not type-check, so without it type errors would ship.

## Task 9: Task list

- **`retry: false` on the tasks query:** TanStack Query retries 3 times with backoff by default, so the alert would appear about 7 seconds late. The alert has its own Retry button.
- **Retry button disabled while refetching:** stops repeated clicks from stacking requests.
- **List rows show title and local-time `createdAt`:** the PDF requires the list; the date costs one line and shows the order. No other fields exist.
- **Manual checks used a throwaway stub server in the scratchpad (not in the repo):** the real API cannot answer slowly or with an HTML 502, which the "done when" check needs.

## Task 10: Create form

- **No frontend test, TDD skill conflict:** same as Task 8; no test framework in the approved stack, so CLAUDE.md wins. Checked in the browser against the real API instead.
- **Validation lives in the component, not `api.ts`:** the check (`title.trim() === ''`) is one line and the server still enforces the real rules (200 chars, types). Only emptiness is checked client-side, as the PDF asks; over-long titles come back as the API's `400` message in the error alert.
- **Submit guarded twice against double sends:** the button is disabled while pending, and `handleSubmit` returns early if the mutation is pending, because Enter submits even when the button is disabled. A real double-click sent one POST. Two synchronous scripted `click()` calls sent two, because React had not re-rendered between them; real input does not behave that way.
- **Typed text is cleared only on success:** after a failed request the title stays so the user can retry without retyping.
- **Validation message clears on the next keystroke:** otherwise it stays next to a now-valid input.
