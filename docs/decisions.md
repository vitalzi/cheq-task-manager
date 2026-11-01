# Decisions

Running log. One line per decision: what, and why. Hard-to-reverse choices are discussed first and recorded here once agreed.

## Open questions (one at a time, in this order)

_None. All planned questions are decided._

## Decided

- **Language: TypeScript** for backend and frontend. Typed task contract shared across both, expected default for a senior role; cost is a small build step (`tsx` for dev, `tsc` for prod).
- **Backend framework: Fastify.** Built-in JSON Schema validation (the 400 case) and `app.inject()` for HTTP tests need no extra dependencies; NestJS is too heavy for three endpoints. Owner knows NestJS, which maps closely (route = controller method, hook = middleware, `setErrorHandler` = exception filter). Plugins/encapsulation deliberately unused to keep it small.
- **Storage: in-memory now, swappable later.** `TaskStore` interface (`list`, `create`, both async) with an `InMemoryTaskStore`; the store is injected as a plain argument to `buildApp(store)` (no DI container). Service generates `id`/`createdAt`, the store only persists. Data resets on restart/deploy (documented). DynamoDB implementation is a planned follow-up after the required work, not part of the PDF scope.
- **Frontend: Vite + React + TypeScript, CSS Modules, TanStack Query.** CSS Modules need no dependency and are plain CSS; TanStack Query handles server state (loading/error/empty come from the query, health badge is a polling query) and is the PDF's "state-management layer". Plain `fetch` functions in one `api.ts`, `useQuery` called directly in components. No Zustand in the MVP: the only client state is the form input (`useState`).
- **Frontend serving: built static files served by the Fastify container** (`@fastify/static`). One origin, no CORS, one image, one deploy. Scaling answer: S3 + CloudFront.
- **Phases:** Phase 1 = PDF MVP; Phase 2 = owner's extras (DynamoDB, more endpoints, real styling, maybe Zustand), only after Phase 1 is live. Recorded in `docs/requirements.md`.
- **Repo layout: one public GitHub repo, plain folders** (`backend/`, `frontend/`, `infra/`, `.github/workflows/`, `docs/`), each package with its own `package.json`, no workspace tooling. Task type is duplicated as a small interface on each side; the HTTP contract is the shared boundary.
- **Package manager: npm.** The PDF says `npm test`; no extra tooling in Docker/CI (`npm ci`, `setup-node` cache). pnpm and Yarn add corepack/config friction with no real benefit for two small packages.
- **AWS hosting: ECS Fargate behind an ALB** (instead of the PDF's default EC2; justified in the README). Owner knows ECS and can defend it; ALB uses `/health` for real health checks, gives a stable DNS name and zero-downtime rolling deploys; deploy needs no SSH. Default VPC, public subnets, no NAT gateway (cost). One task for the MVP because the in-memory store is per-container; scaling beyond one task requires the DynamoDB store (Phase 2). Scaling answer: service auto scaling (min/max tasks, target tracking). Cost ~$25-30/month.
- **IaC: Terraform, local state.** Explicit resources are easy to explain; most common tool. Owner runs `terraform apply` once from a laptop; state is gitignored; CI deploys the app only, not the infrastructure (AMB-10). Moving state to an S3 backend is a documented next step.
- **CI/CD: GitHub Actions + ECR + GitHub OIDC.** Workflow on push to `main`: test, build image, push to ECR, `aws ecs update-service --force-new-deployment`. CI assumes an IAM role via OIDC (trust rule limited to this repo's `main`), so no long-lived AWS keys exist; only the role ARN is stored in GitHub. Role, OIDC provider and policy are in Terraform. README explains how this meets the PDF's "credentials as CI secrets" wording and that access keys were the considered alternative. One image holds both frontend and API, so one pipeline deploys both (AMB-3). No SSH deploy (AMB-12 dropped).
- **Testing: Jest + ts-jest, three layers.** (1) Service unit tests with a mocked `TaskStore` (interaction + error paths), written test-first. (2) HTTP tests with `app.inject()` against the real `InMemoryTaskStore` (200/201/400 cases, error format, end-to-end POST then GET). (3) A shared store contract test, `describeTaskStore(createStore)`, run against `InMemoryTaskStore` now and against `DynamoTaskStore` in Phase 2. `npm test` needs no external dependencies and enforces the 80% coverage threshold in Jest config; frontend tests skipped in the MVP (optional in the PDF). In Phase 2, DynamoDB tests would be a separate `test:integration` script using DynamoDB Local (AMB-11).

## Small decisions

Confirmed as proposed in requirements section 8 (AMB-4 to AMB-8):

- **Title validation (AMB-4):** string, trimmed, 1-200 characters. Whitespace-only and malformed JSON give 400; unknown fields are ignored.
- **Error shape (AMB-5):** every error is `{ "error": "<message>" }`.
- **Health (AMB-6):** liveness only; `uptime` is whole seconds since process start.
- **IDs and timestamps (AMB-7):** `crypto.randomUUID()` (no dependency); `createdAt` is an ISO 8601 UTC string.
- **List order (AMB-8):** `GET /tasks` returns oldest first.
- **HTTPS/domain (AMB-9):** plain HTTP on the ALB DNS name; no custom domain.
