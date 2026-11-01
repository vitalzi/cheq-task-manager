# Agent decisions

Small decisions the agent made while building, one entry per decision with the task number and the reason. Decisions agreed beforehand live in `docs/decisions.md`; do not mix the two.

## Task 2: Backend scaffold

- **TypeScript pinned to ~5.9 in `backend/`:** ts-jest 29 cannot use the TypeScript 7 compiler API that npm installs by default.
- **Jest transforms `cookie`:** Fastify's `inject()` pulls in the ESM-only `cookie@2`, and Jest runs CommonJS. `jest.config.js` lets ts-jest transpile that one package (`allowJs` in `tsconfig.json`).
