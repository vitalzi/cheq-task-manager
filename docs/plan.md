# Implementation plan

Scope comes from `docs/requirements.md`, reasons from `docs/decisions.md`. This page is the "what and in what order". The task lists (`docs/tasks/phase-1.md`, `docs/tasks/phase-2.md`) breaks it down further.

## Architecture

```
Browser ──HTTP──> S3 website (static React build)
   │
   └──HTTP, CORS──> ALB ──> ECS Fargate (1 task) ── Fastify API ── InMemoryTaskStore
```

- **Two independent deploys:** frontend (`s3 sync`) and backend (ECR image + ECS rollout)
- **Everything is plain HTTP:** no domain (AMB-9)
- **Data resets on every deploy:** in-memory store, documented in the README

## Folder layout

```
backend/
  src/
    server.ts            entry: reads PORT and CORS_ORIGIN, starts the app
    app.ts               buildApp(store, options): CORS, logging hook, error handlers, /health
    app.test.ts, cors.test.ts, requestLogging.test.ts   app-level HTTP tests
    tasks/               everything about tasks; each test sits next to its code
      routes.ts          GET /tasks, POST /tasks (+ JSON Schema)
      taskService.ts     business logic: validates/trims title, generates id and createdAt
      taskStore.ts       Task + TaskStore interface (async list, create)
      inMemoryTaskStore.ts
      taskStore.contract.ts   shared store contract test, called by each store's test
  Dockerfile, .dockerignore
frontend/
  src/
    main.tsx             QueryClientProvider + App
    api.ts               fetch functions, reads VITE_API_URL
    components/          TaskList, TaskForm, HealthBadge (each with a .module.css)
infra/                   Terraform: ecr, ecs, alb, s3, github oidc/iam, outputs
.github/workflows/       backend.yml, frontend.yml
docs/                    requirements, decisions, plan, tasks
```

## Main components

- **Backend**
  - **Store:** `TaskStore` interface, injected into `buildApp(store)`; service owns the logic, store only persists
  - **Validation:** JSON Schema on `POST /tasks`; service trims the title and rejects whitespace-only
  - **Errors:** one error handler, every error is `{ "error": "<message>" }`
  - **Logging:** custom `onResponse` hook, one line per request (method, path, status, ms)
  - **Config:** environment variables only, no `.env` in the repo
- **Frontend**
  - **Server state:** TanStack Query; list, create (mutation) and health (polling)
  - **States:** loading, empty and error come from the query; failed calls show an alert
  - **Form:** client-side validation blocks empty titles before the API call
  - **Layout:** CSS Modules, works at desktop and mobile widths
- **Infrastructure (Terraform)**
  - **Backend side:** ECR repo, ECS cluster, task definition and service, ALB with `/health` check, security groups, CloudWatch log group
  - **Frontend side:** public S3 bucket with website hosting
  - **CI access:** GitHub OIDC provider and one IAM role (ECR push, ECS update-service, S3 write)
  - **Outputs:** ALB URL, S3 website URL, role ARN, ECR repo URL
- **CI/CD**
  - **Backend workflow:** test with coverage, build image, push to ECR, force new ECS deployment
  - **Frontend workflow:** install, build with `VITE_API_URL`, `s3 sync`

## Build order

1. **Repo foundation:** `.gitignore`, folder skeleton, README stub
2. **Backend:** scaffold, then test-first: store + contract test, service, routes and validation, logging hook, CORS, coverage threshold
3. **Frontend:** scaffold, `api.ts`, list, form, health badge, states, responsive CSS; verify against the real backend
4. **Dockerfile:** multi-stage, non-root, API only; run it locally
5. **Terraform:** backend side, frontend side, then CI role; owner runs `plan` and `apply`
6. **GitHub Actions:** backend workflow, then frontend workflow
7. **Deploy and verify:** `/health`, frontend loads, create a task through the UI on the live URLs
8. **README finish:** scalability, observability, AI use, assumptions, clean-clone check

README sections are written alongside each step, not at the end.

## Not building (Phase 1)

- **Persistence:** no DynamoDB or database
- **API extras:** no update/delete endpoints, no pagination, no auth
- **CDN and HTTPS:** no CloudFront, no custom domain, no certificates
- **Frontend extras:** no Zustand, no routing, no frontend tests, no real design work
- **Infrastructure extras:** no auto scaling, no multiple environments, no remote Terraform state, no WAF
- **Observability stack:** logs go to CloudWatch only; the rest is described in the README

## Risks and how the plan handles them

- **First deploy order:** the ECS service cannot start until an image exists in ECR
  - **Plan:** `apply`, copy the outputs into GitHub variables, then the first push to `main` builds the image and starts the service
- **Image tag:** proposed `latest` plus `--force-new-deployment` (simplest, less traceable than commit-SHA tags); logged as a small decision when we reach the workflow
- **Public bucket:** S3 Block Public Access is on by default; Terraform turns it off for this bucket only, and an account-level block would make `apply` fail
- **URL wiring:** the frontend needs the ALB URL at build time and the API needs the S3 URL for CORS; both come from Terraform and are set once
- **AWS and OIDC are the likeliest failures:** they are tested only at step 7, so we leave time for it

## Open items for the task list

- Coverage report location and format (HTML + text summary in `backend/coverage`)
- Which GitHub repository variables the workflows need (role ARN, region, API URL, bucket name, ECR repo)
