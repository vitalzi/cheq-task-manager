# Tasks

Breakdown of `docs/plan.md` (build order) into reviewable steps. Requirement IDs refer to `docs/requirements.md`.

**Rules**

- **One task = one commit**, made only when the owner says so
- **Order:** top to bottom; each task assumes the ones above it are done
- **Core logic is test-first:** failing test, then minimal code
- **README grows with the work:** each task lists the README part it adds
- **Status:** `[ ]` todo · `[~]` in progress · `[x]` done

## Global constraints

Apply to every task. Values come from `docs/requirements.md` and `docs/decisions.md`.

- **Stack:** TypeScript, npm, Fastify, Jest + ts-jest, Vite + React, CSS Modules, TanStack Query; no new dependency without approval
- **Task shape:** `{ id: string (UUID), title: string, createdAt: string (ISO 8601 UTC) }`
- **Title rule:** string, trimmed, 1-200 characters after trimming
- **Errors:** every error response is `{ "error": "<message>" }`
- **Config:** environment variables only (`PORT`, `CORS_ORIGIN`, `VITE_API_URL`); no `.env` or secrets in the repo
- **Process:** one task = one commit, only when the owner says so; stop after each task and wait for "next"

## Review focus

Cases the PDF does not spell out but a real user or reviewer will hit. Each one has a test in the task named on the right.

- **Odd request bodies:** `null`, array, string, empty body, or wrong content type give `400` (or `415`) in the `{ error }` shape, never `500` → task 5
- **Padded titles:** 200 characters plus surrounding spaces is valid; 201 characters after trimming is `400`. The schema checks only the type, the service checks length after trimming → tasks 4 and 5
- **Unknown routes and methods:** `404` in the `{ error }` shape, not Fastify's default body → task 5
- **Store isolation:** changing the array returned by `list()` must not change the store → task 3
- **Frontend failure modes:** a non-JSON error response (for example an ALB 502 page) shows the error alert instead of crashing; double-clicking submit sends one request → tasks 9 and 10

## Tracker

| # | Task | Requirements | Status |
|---|------|--------------|--------|
| 1 | Repo foundation | G3 | [x] |
| 2 | Backend scaffold and `/health` | B1, E1, T1 | [x] |
| 3 | Task store and contract test | B2, T3 | [x] |
| 4 | Task service | B4, T3 | [x] |
| 5 | Task routes, validation, error format | E2, E3, B4, B5 | [x] |
| 6 | Request logging, CORS, server entry | B3 | [x] |
| 7 | Coverage gate and report | T2, R2 | [x] |
| 8 | Frontend scaffold, `api.ts`, health badge | F1, F5, F6, F7 | [x] |
| 9 | Task list with loading, empty, error states | F2, F4 | [x] |
| 10 | Create form with validation | F3, F4 | [x] |
| 11 | Responsive layout and local end-to-end check | F8, R1 | [x] |
| 12 | Dockerfile | D1, D2 | [x] |
| 13 | Terraform: app infrastructure | I1, I2, I3 | [x] |
| 14 | Terraform: CI access (GitHub OIDC) | C5 | [x] |
| 15 | Backend workflow | C1, C2, C3, C4 | [x] |
| 16 | Frontend workflow | C1, C4 | [x] |
| 17 | First deploy and live verification | S2 | [x] |
| 18 | README finish and clean-clone check | R3-R7, G4, G5, S1, S3 | [ ] |

## Repo and backend

### 1. Repo foundation

- **What:** root `.gitignore` (node_modules, dist, coverage, `.env`, Terraform state and `.terraform/`), empty `backend/`, `frontend/`, `infra/`, `.github/workflows/` folders, README stub
- **README:** title, one-paragraph overview, folder map
- **Done when:** `git status` shows no ignored junk; secrets and state patterns are covered by `.gitignore`

### 2. Backend scaffold and `/health`

- **What:** `backend/package.json`, `tsconfig.json`, Jest + ts-jest config; `app.ts` with `buildApp()` and `GET /health`
- **Interfaces:** produces `buildApp(): FastifyInstance`; task 5 changes it to `buildApp(store: TaskStore)`
- **Test first:** `app.inject()` on `/health` expects `200` and `{ status: "ok", uptime: <whole number> }`
- **README:** how to install and run the API
- **Done when:** `npm test` is green; `npm run dev` serves `/health` via `curl`; `npm run build` compiles

### 3. Task store and contract test

- **What:** `taskStore.ts` (async `list`, `create`), `inMemoryTaskStore.ts`, shared `describeTaskStore(createStore)` contract test
- **Interfaces:** produces `interface Task`, `interface TaskStore { list(): Promise<Task[]>; create(task: Task): Promise<Task> }`, `class InMemoryTaskStore implements TaskStore`, `describeTaskStore(createStore: () => TaskStore): void`
- **Test first:** contract covers empty list, create then list, creation order (oldest first), and that mutating the returned array does not change the store
- **Done when:** contract test passes against `InMemoryTaskStore`

### 4. Task service

- **What:** `taskService.ts`: trims the title, rejects empty or whitespace-only and over-200-char titles, generates `id` (`crypto.randomUUID()`) and `createdAt` (ISO 8601 UTC), delegates persistence to the store
- **Interfaces:** consumes `TaskStore`; produces `class TaskService { constructor(store: TaskStore); list(): Promise<Task[]>; create(title: unknown): Promise<Task> }` and `class ValidationError extends Error` (maps to `400`; any other error maps to `500`)
- **Test first:** unit tests with a mocked `TaskStore`: trimming, each rejection (non-string, empty, whitespace-only, 201 characters after trim), 200 characters plus padding accepted, generated fields, store called once with the right object, store errors propagate
- **Done when:** service tests pass with no real store involved

### 5. Task routes, validation, error format

- **What:** `GET /tasks` and `POST /tasks` in `routes.ts` with a JSON Schema that requires `title` of type string (no `maxLength`; the service enforces length after trimming); one error handler plus a not-found handler that return `{ "error": "<message>" }`
- **Interfaces:** consumes `TaskService`, `ValidationError`; changes `buildApp()` to `buildApp(store: TaskStore): FastifyInstance`
- **Test first:** HTTP tests with the real in-memory store: `GET` returns `[]`; `POST` returns `201` + task; missing, empty, whitespace-only, non-string and too-long titles return `400`; malformed JSON returns `400`; body `null`, array, string, empty and wrong content type return `400`/`415` in the `{ error }` shape; unknown route returns `404` in the same shape; unknown fields are ignored; POST then GET returns the task
- **Done when:** all HTTP tests pass; manual `curl` of both endpoints matches the PDF examples

### 6. Request logging, CORS, server entry

- **What:** `onResponse` hook logging method, path, status and response time (one line per request); `@fastify/cors` with origin from `CORS_ORIGIN`; `server.ts` reading `PORT` and `CORS_ORIGIN`
- **Test first:** logging test captures the log line and checks its four fields; CORS test checks the allow-origin header for the configured origin
- **Done when:** tests pass; running the server prints one line per request

### 7. Coverage gate and report

- **What:** Jest coverage config: 80% threshold on all four metrics, HTML + text summary into `backend/coverage`; excludes `server.ts` only if it cannot be tested cheaply (noted in decisions)
- **README:** how to run tests and open the report
- **Done when:** `npm test` prints the summary and fails if coverage drops below 80%; report opens in a browser

## Frontend

### 8. Frontend scaffold, `api.ts`, health badge

- **What:** Vite + React + TS app; TanStack Query provider in `main.tsx`; `api.ts` with `getHealth(): Promise<{ status: string; uptime: number }>`, `getTasks(): Promise<Task[]>`, `createTask(title: string): Promise<Task>` reading `VITE_API_URL` (a failed call throws an `Error` carrying the API's `error` message, or a generic one when the body is not JSON); `Task` is duplicated as a small interface; Vite dev proxy to the local API; `HealthBadge` polling `/health` (green "up" / red "down")
- **Done when:** with the API running the badge is green; stopping the API turns it red within one poll

### 9. Task list with loading, empty, error states

- **What:** `TaskList` using `useQuery`: loading indicator, "no tasks yet" empty state, error alert with retry when `GET /tasks` fails
- **Done when:** all three states seen in the browser (slow response, empty list, API stopped); a non-JSON error response (for example a 502 HTML page) shows the alert without crashing

### 10. Create form with validation

- **What:** `TaskForm` with controlled input; blocks empty or whitespace-only titles and shows the message before any request; submit uses a mutation (button disabled while pending), refreshes the list on success, shows an error alert on failure
- **Done when:** invalid input sends no network request; double-clicking submit sends one request; a valid title appears in the list; API stopped shows an alert

### 11. Responsive layout and local end-to-end check

- **What:** CSS Modules layout for desktop and mobile widths; full local run of API + frontend
- **README:** how to run the frontend and `VITE_API_URL`
- **Done when:** checked at about 375 px and desktop width in the browser; create, list and health flows work together

## Container

### 12. Dockerfile

- **What:** multi-stage `backend/Dockerfile` (build with dev deps, final image with production deps and compiled output only), pinned base image, non-root user, explicit `CMD`, `.dockerignore`
- **Done when:** `docker build` and `docker run -p` work; `/health` answers; `docker run ... id` shows non-root

## Infrastructure and CI

### 13. Terraform: app infrastructure

- **What:** `infra/` with ECR repo, ECS cluster, task definition and service (1 task, default VPC, public subnets), ALB with `/health` target group check, security groups, CloudWatch log group, public S3 website bucket (Block Public Access off for this bucket only); outputs for ALB URL, S3 website URL, ECR URL
- **Container settings:** `initProcessEnabled = true` in the container's `linuxParameters` (Node runs as PID 1 in the image and ignores SIGTERM, so without it every rollout waits out the stop timeout; see `docs/agent-decisions.md`, Task 12); CPU architecture set explicitly (`X86_64`), because the image was first built locally on arm64
- **README:** how infrastructure is provisioned
- **Done when:** `terraform validate` and `terraform plan` look right and the owner reviews the plan; **`apply` is run by the owner**

### 14. Terraform: CI access (GitHub OIDC)

- **What:** OIDC provider and one IAM role trusted only by this repo's `main`; policy limited to ECR push, `ecs:UpdateService`, and S3 write on the one bucket; output the role ARN
- **Done when:** `plan` reviewed by the owner and applied; role ARN and other values set as GitHub repository variables

### 15. Backend workflow

- **What:** `.github/workflows/backend.yml`, path-filtered on `backend/**`: `npm ci`, `npm run lint`, `npm test`, OIDC login, build and push image, `aws ecs update-service --force-new-deployment`, then `aws ecs wait services-stable` (the role already allows `ecs:DescribeServices`, Task 14)
- **Linter (added to this task at the owner's request):** ESLint with `typescript-eslint` in `backend/` and `frontend/` (plus `eslint-plugin-react-hooks` in the frontend), `npm run lint` in both, no Prettier. The frontend workflow (Task 16) runs the frontend lint too
- **Small decision to log:** image tag (`latest` vs commit SHA)
- **Done when:** `npm run lint` is clean in both packages and reports a planted violation; a push touching `backend/` runs green only after ECS has rolled a new, healthy task; a lint error or a failing test stops the run before the push

### 16. Frontend workflow

- **What:** `.github/workflows/frontend.yml`, path-filtered on `frontend/**`: `npm ci`, `npm run lint`, build with `VITE_API_URL`, `aws s3 sync` (long cache for hashed assets, no-cache for `index.html`)
- **Done when:** a push touching `frontend/` runs green and the S3 website shows the new build

## Ship

### 17. First deploy and live verification

- **What:** push to `main` to build the first image and start the service; test the live URLs
- **Done when:** `GET <ALB>/health` returns `200`; the S3 website opens; a task created in the UI shows up after reload; CORS works from the S3 origin

### 18. README finish and clean-clone check

- **What:** fill remaining sections: provisioning and deploy, assumptions, unfinished items, scalability (10x), observability, AI use with one concrete correction; then clone into a clean folder and follow the README from scratch
- **Done when:** every R/G/S item in `docs/requirements.md` is ticked; the clean clone runs tests and both apps using only the README
