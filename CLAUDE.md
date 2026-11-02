# Working agreement

This is a hiring task. The goal is to show good engineering judgment, and the
owner must understand and be able to defend every line. The task description is
in the PDF in this folder.

## Stack (fixed)

Do not change or add to this without my explicit approval. Reasons are in
`docs/decisions.md`.

- **Language:** TypeScript (backend and frontend)
- **Package manager:** npm. Plain folders, each with its own `package.json`, no workspaces
- **Repo:** one public GitHub repo. Folders: `backend/`, `frontend/`, `infra/`,
  `.github/workflows/`, `docs/`
- **Backend:** Fastify, JSON Schema validation, `tsx` for dev, `tsc` for build
- **Storage:** in-memory `InMemoryTaskStore` behind an async `TaskStore` interface,
  injected as an argument to `buildApp(store)`. No DI container
- **Frontend:** Vite, React, CSS Modules, TanStack Query (plain `fetch` functions in
  `api.ts`, `useQuery` in components). No Zustand in the MVP
- **Frontend serving:** built static files in a public S3 bucket (S3 website
  hosting, HTTP), deployed independently from the API
  - Phase 1: the browser calls the ALB directly, so the API enables CORS (`@fastify/cors`).
    Removed in Phase 2: CloudFront serves the site and the API from one origin
  - The API URL is a build-time setting (`VITE_API_URL`)
  - No CloudFront in the MVP
- **Testing:** Jest with ts-jest. Service unit tests with a mocked `TaskStore`; HTTP
  tests with `app.inject()`; shared store contract test. Coverage >= 80%
- **Hosting:** AWS ECS Fargate behind an ALB, default VPC, public subnets, no NAT,
  one task
- **Registry:** Amazon ECR
- **IaC:** Terraform, local state, applied once by me from my laptop
- **CI/CD:** GitHub Actions on push to `main`, two independent path-filtered
  workflows. AWS auth via GitHub OIDC
  - Backend: test, build image, push to ECR,
    `aws ecs update-service --force-new-deployment`
  - Frontend: build, `aws s3 sync`
- **Phases:** Phase 1 = the PDF MVP. Phase 2 = my own extras (DynamoDB store, more
  endpoints, real styling, CloudFront in front of S3 and the ALB), only after
  Phase 1 is live

## How to work

- Work in small steps. Finish one task, then STOP and wait for my "next".
- Before writing code for a task, say in 2-4 sentences what you will do and
  which files you will create or change.
- After each task: run the code or tests and show the result, then give a short
  walkthrough of each new or changed file (what it is, why it exists, how it
  connects to the rest).
- One task = one commit. Only commit when I say so.
- Commit message format: `Task <N>: <short description>`, for example
  `Task 1: Repo foundation`. N is the task number in `docs/tasks/` (numbering runs on across the
  phase files: Phase 1 is 1-18, Phase 2 starts at 19).
- Write a failing test first for core logic, then the minimal code to pass it.

### Per-task loop

Tasks live in `docs/tasks/`: `phase-1.md` (the PDF MVP, Tasks 1-18, done) and
`phase-2.md` (my extras, Task 19 on, current). Each has a tracker table and
global constraints; Phase 1 also has the review focus. Follow this loop for
every task, in order:

1. **Announce:** 2-4 sentences on what you will do and which files you touch.
2. **Skills (mandatory, no judgment calls):**
   - Always load `superpowers:verification-before-completion` with the Skill
     tool before calling any task done, whatever the task.
   - Always load `superpowers:test-driven-development` with the Skill tool
     whenever the task involves application code.
   - Load them for every task. Never skip them or replace them with an
     improvised check.
   - This file wins if a skill conflicts with it. Flag the conflict.
3. **Red:** write the failing test and run it to show it fails.
4. **Green:** write the minimal code and run the test to show it passes.
5. **Verify:** run the task's "done when" check and show the real output.
6. **Walkthrough:** each new or changed file, briefly.
7. **Track:** set the task's status in the tracker of its phase file.
8. **Stop:** wait for my "commit" and/or "next". Never start the next task
   or commit on your own.

## Scope and simplicity

- Build only what the PDF requires. If you think something extra is valuable,
  propose it in one sentence and wait. Default answer is no.
- Prefer the simplest solution that works. No abstractions, layers, or config
  for hypothetical future needs.
- No new dependencies without asking. Say why it is needed and what the
  alternative is.
- Prefer classes over factory functions wherever a class fits (services,
  stores, anything holding injected dependencies). Plain functions are fine
  for stateless helpers and where a framework expects them (`buildApp`, React
  components).
- Match the existing style. Keep files small and names clear. Comment only
  where the "why" is not obvious.

## Questions and decisions

- Ask at most 1-2 questions at a time, and always include your recommended
  default so I can just say "yes".
- Make small decisions yourself and append them to `docs/agent-decisions.md`
  (one line: decision, reason, grouped by task). Ask me only for choices that
  are hard to reverse (stack, database, cloud provider, framework).
- Never write to `docs/decisions.md` without my explicit approval.
- If the PDF is ambiguous, list the ambiguity and your proposed interpretation
  instead of silently choosing.

## Documents

- **`docs/requirements.md`:** checklist derived from the PDF (must / nice-to-have /
  ambiguous). Source of truth for scope.
- **`docs/tasks/phase-1.md`, `docs/tasks/phase-2.md`:** small tasks, each with a
  clear "done" check; Phase 1 tasks are tied to a requirement.
- **`docs/decisions.md`:** decisions I approved or agreed beforehand. Edit only
  with my approval.
- **`docs/agent-decisions.md`:** small decisions you make during implementation.
- **`docs/pushbacks.md`:** every time I correct you or scrutinize your output and
  ask for a change. Append an entry the same turn: what you did, my pushback,
  the outcome, and the lesson. I use it in the final walkthrough.
- **`README.md`:** how to run, how to test, key decisions, trade-offs, what I would
  do with more time. Keep it updated as we go, not at the end.

## Order of work

1. Requirements checklist from the PDF (no code).
2. One-page plan: stack, folder layout, main components, and what we are
   explicitly NOT building.
3. Task list (8-15 small tasks).
4. Build task by task, local first.
5. CI and deployment only if the PDF requires them, as separate tasks, last.
6. Final check: clone into a clean folder and follow the README from scratch.
