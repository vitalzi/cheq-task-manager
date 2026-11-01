# Requirements Checklist

Source: `cheq_assignment.pdf` (Senior Software Developer, Node.js take-home, ~4–6 h).
This is the source of truth for scope. Anything not listed here is out of scope.

Legend: **MUST** = required by the PDF · **NICE** = bonus/optional in the PDF · **AMB** = ambiguous, see section 8.

## 1. Ground rules

- [ ] **G1 MUST** Everything (API, frontend, Dockerfile, IaC, pipeline) in one public GitHub/GitLab repo.
- [ ] **G2 MUST** All AWS resources in Terraform or CDK. Nothing created by hand in the console.
- [ ] **G3 MUST** No secrets in the repo (AWS keys, SSH keys, `.env`). Use CI secrets.
- [ ] **G4 MUST** Assumptions for unclear requirements are written in the README.
- [ ] **G5 MUST** Anything unfinished is listed in the README with how it would be completed.

## 2. Backend API

- [ ] **B1 MUST** Express, Fastify or NestJS.
- [ ] **B2 MUST** Storage: MongoDB/PostgreSQL, or in-memory/JSON file with **async** data-access functions. → AMB-1
- [ ] **B3 MUST** Custom request-logging middleware: one log line per request with method, path, status, response time.
- [ ] **B4 MUST** Basic request validation; invalid requests → `400` with a clear error message. → AMB-4, AMB-5
- [ ] **B5 MUST** Standard HTTP methods, status codes, correct async patterns, sensible error handling.

Endpoints:

- [ ] **E1 MUST** `GET /health` → `200` `{ "status": "ok", "uptime": <n> }`. → AMB-6
- [ ] **E2 MUST** `GET /tasks` → `200` with a JSON array, `[]` when empty.
- [ ] **E3 MUST** `POST /tasks` → `title` must be a non-empty string. `201` + created task, or `400` + error message.

Task shape (fields may be added): `{ "id": "a1b2c3", "title": "Write the README", "createdAt": "2026-11-02T09:30:00Z" }` → AMB-7

## 3. Backend testing

- [ ] **T1 MUST** Jest; `npm test` runs the suite.
- [ ] **T2 MUST** Backend coverage ≥ 80%, and the report can be viewed.
- [ ] **T3 MUST** Unit tests mock the data-access layer and test business logic. → AMB-11

## 4. Frontend

- [ ] **F1 MUST** React with Vite or Next.js (CRA accepted).
- [ ] **F2 MUST** Task list from `GET /tasks`.
- [ ] **F3 MUST** Create form → `POST /tasks`; client-side validation (title required, not empty) blocks invalid input before the API.
- [ ] **F4 MUST** Loading, empty and error states; an alert (or similar) when an API call fails.
- [ ] **F5 MUST** Health indicator from `GET /health` (e.g. green/red badge); shows "down" when the API is unreachable.
- [ ] **F6 MUST** Clean component separation; API calls in custom hooks or a state layer.
- [ ] **F7 MUST** Styling via CSS Modules, Tailwind or styled-components.
- [ ] **F8 MUST** Layout works at desktop and mobile widths.
- [ ] **F9 NICE** Frontend tests.

## 5. DevOps

Container:

- [ ] **D1 MUST** Production-ready API Dockerfile: pinned base image, non-root user, `.dockerignore`, clear start command.
- [ ] **D2 NICE** Multi-stage build, no dev dependencies in the final image.

Infrastructure as code:

- [ ] **I1 MUST** AWS hosting in Terraform or CDK.
- [ ] **I2 MUST** Default: EC2 running the container, security group allowing SSH and inbound API port. Alternatives (Fargate, App Runner, S3+CloudFront) allowed if justified in the README. → AMB-2
- [ ] **I3 MUST** `terraform apply` / `cdk deploy` creates the environment from scratch. → AMB-10

CI/CD:

- [ ] **C1 MUST** GitHub Actions or GitLab CI, on every push to `main`.
- [ ] **C2 MUST** Install dependencies and run unit tests; stop if any test fails.
- [ ] **C3 MUST** Build the Docker image.
- [ ] **C4 MUST** Deploy the new container automatically, with no manual steps. → AMB-3, AMB-12
- [ ] **C5 MUST** AWS credentials and SSH keys stored as CI secrets. Registry choice is open.

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
| AMB-1 | Real DB or in-memory store? | **(step 2)** In-memory store with async functions. The PDF allows it, and it's the simplest option. Trade-off: data resets on every deploy/restart. Write this in the README. |
| AMB-2 | How is the frontend served at the live URL? | **(step 2)** Build the SPA and serve it from the same container as the API. That gives one origin, no CORS and one deploy. Alternative: S3 + CloudFront. |
| AMB-3 | Does the pipeline also deploy the frontend? | It does automatically if AMB-2 is accepted: one image contains both. |
| AMB-4 | Validation limits beyond "non-empty string" | `title` must be a string, trimmed, 1–200 characters. Whitespace-only → 400. Malformed JSON → 400. Unknown fields are ignored. |
| AMB-5 | What is a "clear error message"? | One shape for every error: `{ "error": "<message>" }`. |
| AMB-6 | Health semantics and uptime unit | Liveness only (an in-memory store has no dependencies to check). `uptime` = whole seconds since process start. |
| AMB-7 | ID format | UUID from Node's built-in `crypto.randomUUID()`, so no extra dependency. `createdAt` is an ISO 8601 UTC string. |
| AMB-8 | Order of `GET /tasks` | Creation order, oldest first. |
| AMB-9 | HTTPS / custom domain | Not required. Plain HTTP on the EC2 public DNS/IP. |
| AMB-10 | Where Terraform state lives, and who runs `apply` | **(step 2)** The owner runs `terraform apply` once, locally. State stays local and gitignored. CI deploys the app only, not the infrastructure. |
| AMB-11 | "Unit tests mock data access" vs. testing HTTP behaviour | Unit tests for business logic with the store mocked. HTTP-level tests check status codes and the 400 cases. Both count toward coverage. |
| AMB-12 | How CI reaches EC2 | **(step 2)** Push the image to a registry, then SSH to the instance to pull and restart. The PDF's mention of SSH keys suggests this path. Alternative: AWS SSM. |
