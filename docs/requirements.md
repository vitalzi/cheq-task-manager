# Requirements Checklist

Source: `cheq_assignment.pdf` (Senior Software Developer, Node.js take-home, ~4–6 h).
This is the source of truth for scope. Anything not listed here is out of scope.

## Phases

- **Phase 1: MVP.** Exactly what the PDF requires (everything in sections 1–7). Built, deployed and documented first.
- **Phase 2: Extra mile.** Owner-chosen additions beyond the PDF, started only after Phase 1 is live and the README is complete. Candidates so far: DynamoDB store implementation, additional API methods, real styling, Zustand if client state needs it, CloudFront in front of a private S3 bucket and the ALB. Each item is proposed and agreed before work starts.

Everything below this section is Phase 1 unless stated otherwise.

Legend: **MUST** = required by the PDF · **NICE** = bonus/optional in the PDF · **AMB** = ambiguous, see section 8.

Boxes: `[x]` means a decision has been made for that item, not that it is built yet. Original wording is unchanged; `Decision:` notes follow it.

## 1. Ground rules

- [x] **G1 MUST** Everything (API, frontend, Dockerfile, IaC, pipeline) in one public GitHub/GitLab repo. ***Decision:*** public GitHub repo; plain folders `backend/`, `frontend/`, `infra/`.
- [x] **G2 MUST** All AWS resources in Terraform or CDK. Nothing created by hand in the console. ***Decision:*** Terraform.
- [ ] **G3 MUST** No secrets in the repo (AWS keys, SSH keys, `.env`). Use CI secrets.
- [ ] **G4 MUST** Assumptions for unclear requirements are written in the README.
- [ ] **G5 MUST** Anything unfinished is listed in the README with how it would be completed.

## 2. Backend API

- [x] **B1 MUST** Express, Fastify or NestJS. ***Decision:*** Fastify.
- [x] **B2 MUST** Storage: MongoDB/PostgreSQL, or in-memory/JSON file with **async** data-access functions. → AMB-1 ***Decision:*** in-memory behind an async `TaskStore` interface, injected into `buildApp(store)`; DynamoDB in Phase 2.
- [ ] **B3 MUST** Custom request-logging middleware: one log line per request with method, path, status, response time.
- [x] **B4 MUST** Basic request validation; invalid requests → `400` with a clear error message. → AMB-4, AMB-5 ***Decision:*** `title` is a trimmed string of 1-200 characters; whitespace-only and malformed JSON give 400; unknown fields ignored; every error is `{ "error": "<message>" }`.
- [ ] **B5 MUST** Standard HTTP methods, status codes, correct async patterns, sensible error handling.

Endpoints:

- [x] **E1 MUST** `GET /health` → `200` `{ "status": "ok", "uptime": <n> }`. → AMB-6 ***Decision:*** liveness only; `uptime` in whole seconds since process start.
- [x] **E2 MUST** `GET /tasks` → `200` with a JSON array, `[]` when empty. ***Decision:*** tasks returned in creation order, oldest first.
- [ ] **E3 MUST** `POST /tasks` → `title` must be a non-empty string. `201` + created task, or `400` + error message.

Task shape (fields may be added): `{ "id": "a1b2c3", "title": "Write the README", "createdAt": "2026-11-02T09:30:00Z" }` → AMB-7

## 3. Backend testing

- [x] **T1 MUST** Jest; `npm test` runs the suite. ***Decision:*** Jest with ts-jest; npm.
- [ ] **T2 MUST** Backend coverage ≥ 80%, and the report can be viewed.
- [x] **T3 MUST** Unit tests mock the data-access layer and test business logic. → AMB-11 ***Decision:*** service unit tests mock `TaskStore`; HTTP tests use the in-memory store; shared store contract test.

## 4. Frontend

- [x] **F1 MUST** React with Vite or Next.js (CRA accepted). ***Decision:*** Vite + React + TypeScript.
- [ ] **F2 MUST** Task list from `GET /tasks`.
- [ ] **F3 MUST** Create form → `POST /tasks`; client-side validation (title required, not empty) blocks invalid input before the API.
- [ ] **F4 MUST** Loading, empty and error states; an alert (or similar) when an API call fails.
- [ ] **F5 MUST** Health indicator from `GET /health` (e.g. green/red badge); shows "down" when the API is unreachable.
- [x] **F6 MUST** Clean component separation; API calls in custom hooks or a state layer. ***Decision:*** TanStack Query for server state, plain `fetch` functions in `api.ts`, `useQuery` called in components; no custom hook layer.
- [x] **F7 MUST** Styling via CSS Modules, Tailwind or styled-components. ***Decision:*** CSS Modules.
- [ ] **F8 MUST** Layout works at desktop and mobile widths.
- [ ] **F9 NICE** Frontend tests.

## 5. DevOps

Container:

- [ ] **D1 MUST** Production-ready API Dockerfile: pinned base image, non-root user, `.dockerignore`, clear start command.
- [ ] **D2 NICE** Multi-stage build, no dev dependencies in the final image.

Infrastructure as code:

- [x] **I1 MUST** AWS hosting in Terraform or CDK. ***Decision:*** Terraform.
- [x] **I2 MUST** Default: EC2 running the container, security group allowing SSH and inbound API port. Alternatives (Fargate, App Runner, S3+CloudFront) allowed if justified in the README. → AMB-2 ***Decision:*** **ECS Fargate behind an ALB** instead of EC2, so the EC2 and SSH parts do not apply; justified in the README.
- [x] **I3 MUST** `terraform apply` / `cdk deploy` creates the environment from scratch. → AMB-10 ***Decision:*** Terraform with local state; owner runs `apply` once.

CI/CD:

- [x] **C1 MUST** GitHub Actions or GitLab CI, on every push to `main`. ***Decision:*** GitHub Actions.
- [ ] **C2 MUST** Install dependencies and run unit tests; stop if any test fails.
- [ ] **C3 MUST** Build the Docker image.
- [x] **C4 MUST** Deploy the new container automatically, with no manual steps. → AMB-3, AMB-12 ***Decision:*** push to ECR, then `aws ecs update-service --force-new-deployment`. No SSH. The frontend deploys separately: build, `aws s3 sync`.
- [x] **C5 MUST** AWS credentials and SSH keys stored as CI secrets. Registry choice is open. ***Decision:*** GitHub OIDC; CI assumes an IAM role, so no long-lived AWS keys and only the role ARN is stored in GitHub. No SSH keys, since ECS has no SSH. Registry: ECR.

## 6. Documentation (root `README.md`)

- [ ] **R1 MUST** Run the API and frontend locally.
- [ ] **R2 MUST** Run tests and view the coverage report.
- [ ] **R3 MUST** How infrastructure is provisioned and how deployment works.
- [ ] **R4 MUST** Assumptions made and unfinished items.
- [ ] **R5 MUST** Scalability: specific changes to *this* design for 10x traffic tomorrow.
- [ ] **R6 MUST** Observability: monitoring, error tracking, log aggregation for *this* service.
- [ ] **R7 MUST** AI use: where it helped, plus one concrete case where its output was corrected.

## 7. Submission

- [ ] **S1 MUST** Public repo link.
- [ ] **S2 MUST** Live URL (public IP/DNS) where `GET /health` responds and the frontend opens; kept up until the interview.
- [ ] **S3 MUST** README as described in section 6.

How it is graded: functionality **on the live deployment**, code quality, meaningful tests, production readiness, specific scalability/observability answers, and being able to defend every decision.

## 8. Ambiguities and proposed interpretations

Items marked **(step 2)** are hard to reverse and get decided in the plan. The rest are proposals to confirm or change. Every final choice goes into the README as an assumption.

| ID | Ambiguity | Proposed interpretation |
|----|-----------|-------------------------|
| AMB-1 | Real DB or in-memory store? | **(step 2)** In-memory store with async functions. The PDF allows it, and it's the simplest option. Trade-off: data resets on every deploy/restart. Write this in the README. ***Decision:*** in-memory behind a swappable `TaskStore`; DynamoDB in Phase 2. |
| AMB-2 | How is the frontend served at the live URL? | **(step 2)** Alternatives: serve it from the API container (one origin, coupled releases), or host it separately. ***Decision:*** separate public S3 bucket with website hosting, independent of the API. The browser calls the ALB directly (CORS on the API, `VITE_API_URL` at build time). CloudFront + private bucket is the Phase 2 upgrade. |
| AMB-3 | Does the pipeline also deploy the frontend? | ***Decision:*** yes, with its own path-filtered workflow (build, `s3 sync`), independent of the backend workflow. The Docker image holds only the API. |
| AMB-4 | Validation limits beyond "non-empty string" | `title` must be a string, trimmed, 1–200 characters. Whitespace-only → 400. Malformed JSON → 400. Unknown fields are ignored. ***Decision:*** as proposed. |
| AMB-5 | What is a "clear error message"? | One shape for every error: `{ "error": "<message>" }`. ***Decision:*** as proposed. |
| AMB-6 | Health semantics and uptime unit | Liveness only (an in-memory store has no dependencies to check). `uptime` = whole seconds since process start. ***Decision:*** as proposed. |
| AMB-7 | ID format | UUID from Node's built-in `crypto.randomUUID()`, so no extra dependency. `createdAt` is an ISO 8601 UTC string. ***Decision:*** as proposed. |
| AMB-8 | Order of `GET /tasks` | Creation order, oldest first. ***Decision:*** as proposed. |
| AMB-9 | HTTPS / custom domain | Not required. Plain HTTP on the EC2 public DNS/IP. ***Decision:*** the EC2 part does not apply (ECS + ALB). Plain HTTP on the ALB DNS name and the S3 website endpoint, no custom domain. |
| AMB-10 | Where Terraform state lives, and who runs `apply` | **(step 2)** The owner runs `terraform apply` once, locally. State stays local and gitignored. CI deploys the app only, not the infrastructure. ***Decision:*** as proposed. |
| AMB-11 | "Unit tests mock data access" vs. testing HTTP behaviour | Unit tests for business logic with the store mocked. HTTP-level tests check status codes and the 400 cases. Both count toward coverage. ***Decision:*** as proposed, plus a shared store contract test. |
| AMB-12 | How CI reaches EC2 | **(step 2)** Push the image to a registry, then SSH to the instance to pull and restart. The PDF's mention of SSH keys suggests this path. Alternative: AWS SSM. ***Decision:*** not applicable. ECS has no SSH; CI deploys via ECR + `update-service` with OIDC. |
