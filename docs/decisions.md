# Decisions

Running log. One entry per decision: what, and why. Hard-to-reverse choices are discussed first and recorded here once agreed.

## Open questions (one at a time, in this order)

_None. All planned questions are decided._

## Decided

### Language and tooling

- **Language: TypeScript** for backend and frontend
  - **Why:** typed task contract on both sides; expected default for a senior role
  - **Cost:** a small build step (`tsx` for dev, `tsc` for prod)
- **Package manager: npm**
  - **Why:** the PDF says `npm test`; no extra tooling in Docker/CI (`npm ci`, `setup-node` cache)
  - **Rejected:** pnpm and Yarn add corepack/config friction with no real benefit for two small packages
- **Repo layout: one public GitHub repo, plain folders**
  - **Folders:** `backend/`, `frontend/`, `infra/`, `.github/workflows/`, `docs/`
  - **Packages:** each has its own `package.json`, no workspace tooling
  - **Shared types:** the task type is duplicated as a small interface on each side; the HTTP contract is the shared boundary

### Backend

- **Framework: Fastify**
  - **Why:** built-in JSON Schema validation (the 400 case) and `app.inject()` for HTTP tests, with no extra dependencies
  - **Rejected:** NestJS is too heavy for three endpoints
  - **Mapping from NestJS:** route = controller method, hook = middleware, `setErrorHandler` = exception filter
  - **Kept simple:** plugins/encapsulation deliberately unused
- **Storage: in-memory now, swappable later**
  - **Interface:** async `TaskStore` (`list`, `create`) with an `InMemoryTaskStore`
  - **Injection:** the store is a plain argument to `buildApp(store)`, no DI container
  - **Responsibilities:** the service generates `id`/`createdAt`; the store only persists
  - **Trade-off:** data resets on restart/deploy (documented in the README)
  - **Follow-up:** a DynamoDB implementation is planned after the required work, not part of the PDF scope
- **Testing: Jest + ts-jest, three layers**
  - **Service unit tests:** mocked `TaskStore`, interaction and error paths, written test-first
  - **HTTP tests:** `app.inject()` against the real `InMemoryTaskStore` (200/201/400 cases, error format, end-to-end POST then GET)
  - **Store contract test:** shared `describeTaskStore(createStore)`, run against `InMemoryTaskStore` now and `DynamoTaskStore` in Phase 2
  - **Config:** `npm test` needs no external dependencies and enforces the 80% coverage threshold in Jest config
  - **Skipped:** frontend tests in the MVP (optional in the PDF)
  - **Phase 2:** DynamoDB tests as a separate `test:integration` script using DynamoDB Local (AMB-11)

### Frontend

- **Stack: Vite + React + TypeScript, CSS Modules, TanStack Query**
  - **CSS Modules:** no dependency, plain CSS
  - **TanStack Query:** handles server state (loading/error/empty come from the query; the health badge is a polling query) and is the PDF's "state-management layer"
  - **Code style:** plain `fetch` functions in one `api.ts`, `useQuery` called directly in components
  - **No Zustand in the MVP:** the only client state is the form input (`useState`)
- **Serving: public S3 bucket with website hosting, deployed independently from the API**
  - **Why:** owner wants to release frontend and API separately
  - **Browser to API:** the browser calls the ALB directly
  - **CORS:** the API enables it via `@fastify/cors` (approved dependency); the allowed origin is the S3 website URL, set through an env var from Terraform
  - **API URL:** the frontend reads it from `VITE_API_URL` at build time (Vite dev proxy locally)
  - **HTTP only:** the PDF does not require HTTPS and there is no domain (AMB-9); both sides being HTTP avoids mixed content
  - **Known weakness (stated in the README):** public bucket, no HTTPS
  - **Rejected alternatives:**
    - **API serves the SPA** (`@fastify/static`): couples releases, no edge caching
    - **CloudFront + private S3, with path routing to the ALB:** production-like, but its HTTPS gain is partial without a domain, and it adds the SPA-fallback gotcha and slow applies
    - **Amplify Hosting:** reverse-proxy rewrites support only HTTPS targets and the ALB has no certificate; Git-connected mode needs a token
    - **Vercel/Netlify:** splits infrastructure across providers
  - **Upgrade path (Phase 2):**
    - Private bucket + CloudFront routing `/tasks*` and `/health` to the ALB
    - Set `VITE_API_URL` empty and drop CORS
    - With a domain: add ACM and an HTTPS listener
  - **Phase 2 update (owner-approved):** the upgrade path above was carried out in Tasks 19-20: private bucket, CloudFront routing `/tasks*` and `/health` to the ALB, empty `VITE_API_URL`. `@fastify/cors` and `CORS_ORIGIN` were then removed, because the browser calls its own origin in dev (Vite proxy) and deployed (CloudFront). The Phase 1 text above is kept as the record of what was decided at the time

### Infrastructure and delivery

- **Hosting: ECS Fargate behind an ALB** (instead of the PDF's default EC2; justified in the README)
  - **Why:** owner knows ECS and can defend it
  - **ALB benefits:** real health checks on `/health`, a stable DNS name, zero-downtime rolling deploys
  - **Deploy:** needs no SSH
  - **Network:** default VPC, public subnets, no NAT gateway (cost)
  - **One task for the MVP:** the in-memory store is per-container; scaling beyond one task requires the DynamoDB store (Phase 2)
  - **Scaling answer:** service auto scaling (min/max tasks, target tracking)
  - **Cost:** about $25-30/month
- **IaC: Terraform, local state**
  - **Why:** explicit resources are easy to explain; most common tool
  - **Workflow:** owner runs `terraform apply` once from a laptop; state is gitignored; CI deploys the app only, not the infrastructure (AMB-10)
  - **Next step (documented):** move state to an S3 backend
- **CI/CD: GitHub Actions + ECR + GitHub OIDC, two independent workflows**
  - **Triggers:** both run on push to `main`, filtered by path
  - **Backend workflow** (`backend/**`): test, build image, push to ECR, `aws ecs update-service --force-new-deployment`
  - **Frontend workflow** (`frontend/**`): install, build with `VITE_API_URL`, `aws s3 sync`
  - **Caching:** hashed assets get a long cache, `index.html` gets no-cache; no CDN, so no invalidation
  - **Auth:** CI assumes an IAM role via OIDC (trust rule limited to this repo's `main`), so no long-lived AWS keys exist
  - **GitHub variables:** only the role ARN and the non-secret API URL
  - **In Terraform:** the role, OIDC provider and policy (ECR push, ECS update-service, S3 write on the one bucket)
  - **README note:** explains how this meets the PDF's "credentials as CI secrets" wording, and that access keys were the considered alternative
  - **Image content:** the image holds only the API; the frontend is a separate deploy (AMB-3)
  - **Dropped:** SSH deploy (AMB-12)

### Process

- **Phases**
  - **Phase 1:** the PDF MVP
  - **Phase 2:** owner's extras (DynamoDB, more endpoints, real styling, maybe Zustand, CloudFront), only after Phase 1 is live
  - Recorded in `docs/requirements.md`

## Small decisions

Confirmed as proposed in requirements section 8 (AMB-4 to AMB-8):

- **Title validation (AMB-4):** string, trimmed, 1-200 characters. Whitespace-only and malformed JSON give 400; unknown fields are ignored.
- **Error shape (AMB-5):** every error is `{ "error": "<message>" }`.
- **Health (AMB-6):** liveness only; `uptime` is whole seconds since process start.
- **IDs and timestamps (AMB-7):** `crypto.randomUUID()` (no dependency); `createdAt` is an ISO 8601 UTC string.
- **List order (AMB-8):** `GET /tasks` returns oldest first.
- **HTTPS/domain (AMB-9):** plain HTTP on the ALB DNS name and the S3 website endpoint; no custom domain.
