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
