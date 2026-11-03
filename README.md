# Task manager

A small task manager: a REST API with a React frontend, deployed to AWS. Built as a hiring take-home; the assignment is in `cheq_assignment.pdf`. The assignment asks for three endpoints (`GET /health`, `GET /tasks`, `POST /tasks`); what the app has on top of that is listed under "Beyond the brief".

## Live deployment

- **Frontend:** https://d1vsq2jivxqe81.cloudfront.net
- **API:** the same address (`GET /health`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`); CloudFront sends `/tasks*` and `/health` to the API
- **Repository:** https://github.com/vitalzi/cheq-task-manager

The site and the API share one HTTPS address with a valid certificate. The ALB accepts connections only from CloudFront, so its own plain-HTTP address does not answer. Tasks are stored in DynamoDB, so they survive deploys and restarts.

## Beyond the brief

What the app has on top of the assignment's MVP (the task list for it is `docs/tasks/phase-2.md`):

- **More endpoints:** `PATCH /tasks/:id` (partial update) and `DELETE /tasks/:id`
- **More fields:** `done` and `priority` on every task
- **DynamoDB store:** the deployed API uses DynamoDB; locally it runs on the in-memory store, which needs nothing installed
- **HTTPS:** CloudFront in front of a private S3 bucket and the ALB, on one origin
- **UI:** edit, mark done, prioritize and delete; Status and Priority filters, search and a By day view; styled from the design handoff in `docs/design/`
- **Frontend tests:** Vitest, Testing Library and MSW

## Folder map

- **`backend/`:** Fastify API in TypeScript. `src/app.ts` builds the app, `src/tasks/` holds the routes and the service, and `src/tasks/store/` holds the `TaskStore` interface, its two implementations and the shared contract test
- **`frontend/`:** React app (Vite, TypeScript)
- **`infra/`:** Terraform for the AWS resources
- **`.github/workflows/`:** CI/CD pipelines, one per deployable
- **`docs/`:** `requirements.md` (checklist from the PDF), `decisions.md` (approved decisions), `agent-decisions.md` (small implementation decisions), `pushbacks.md` (every correction of the AI agent), `plan.md`, `tasks/` (per phase) and `design/` (the UI handoff)

## Backend

Requires Node 24 (see `.nvmrc`; `nvm use` or `fnm use` selects it) and npm.

```bash
cd backend
npm install
npm run dev      # API on http://localhost:3000 (override with PORT)
curl localhost:3000/health
npm run lint     # ESLint; also runs in CI before the tests
npm test         # Jest + coverage; fails below 80%
npm run build    # compiles to backend/dist
npm start        # runs the compiled build
open coverage/index.html   # HTML coverage report (after npm test)
```

**Integration test (DynamoDB Local).** `DynamoTaskStore` runs the same contract test as the in-memory store, against a local DynamoDB in Docker. It is a separate script so `npm test` needs nothing but Node. CI runs it on every backend deploy, against an `amazon/dynamodb-local` service container, before any AWS step.

```bash
docker run --rm -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory
cd backend
npm run test:integration   # DYNAMODB_ENDPOINT overrides http://localhost:8000
docker stop dynamodb-local
```

Each test creates its own table and the tests delete them afterwards. The server picks its store at startup: `DynamoTaskStore` when `TABLE_NAME` is set (the deployed container), the in-memory store otherwise, so `npm run dev` needs nothing.

## Frontend

Requires Node 24 and npm. Start the backend first (see above).

```bash
cd frontend
npm install
npm run dev      # app on http://localhost:5173
npm run lint     # ESLint (typescript-eslint and React hooks rules)
npm test         # Vitest + Testing Library, in jsdom; no API or browser needed
npm run build    # type-check, then build to frontend/dist
```

- **Design:** follows the handoff in `docs/design/`; every colour, font and spacing is a CSS variable in `src/tokens.css`, used by the `*.module.css` files, with no styling library. Filters, search and the By day view run on the client. Works from about 360 px up.
- **Delete asks first:** an inline confirmation in the row (Cancel is focused, Esc backs out), no browser dialog; a failed delete keeps the row and shows the error.
- **`VITE_API_URL`:** the API base URL baked into the build. Leave it unset locally: the app calls its own origin and the Vite dev server proxies `/health` and `/tasks` to `http://localhost:3000` (fixed, so run the backend on its default port). The deployed build leaves it unset too, because CloudFront serves the site and the API from one origin. The API sends no CORS headers, so a build pointed at a different API origin would be blocked by the browser.

## Docker

The API ships as a container image (multi-stage, Node 24 Alpine, runs as the unprivileged `node` user). The frontend is static files and is not containerized.

```bash
cd backend
docker build -t task-api .
docker run --rm --init -p 3000:3000 task-api
curl localhost:3000/health
```

`--init` makes `docker stop` immediate: the image runs `node` as PID 1, which ignores SIGTERM without a handler, so without it a stop waits for the kill timeout.

## Infrastructure

All AWS resources are Terraform in `infra/`, with local state (gitignored). CI deploys the app only; it never changes infrastructure. Needs Terraform >= 1.5 and AWS credentials.

```bash
cd infra
terraform init
terraform plan    # review: 23 resources to add
terraform apply   # run once from a laptop
terraform output  # alb_url, cloudfront_url, ecr_repository_url, ...
```

- **API:** ECS Fargate (one task, 0.25 vCPU / 512 MB) behind an Application Load Balancer that checks `GET /health`. The load balancer's security group accepts port 80 only from CloudFront's origin-facing address list (an AWS-managed prefix list), so the API cannot be reached over plain HTTP except through the distribution. The task runs in the default VPC's public subnets with no NAT gateway; its security group accepts port 3000 only from the load balancer.
- **Frontend and HTTPS:** a CloudFront distribution is the entry point at `https://<id>.cloudfront.net` (`cloudfront_url`), which has a valid certificate without a domain. Its default behavior serves the site from a private S3 bucket; `/tasks*` and `/health` go to the ALB with caching off and all methods allowed. The hop from CloudFront to the ALB is plain HTTP inside AWS.
- **Why the bucket is private:** Block Public Access is on, website hosting is off, and the bucket policy lets only this one distribution read objects (Origin Access Control). Nobody can reach the files except through CloudFront, so there is one front door that serves HTTPS.
- **Storage:** one DynamoDB table (`task-manager-tasks`, on demand, `id` as the key). The container runs with its own IAM task role that may only `Scan`, `PutItem`, `UpdateItem` and `DeleteItem` on that table, the four calls the store makes (update and delete carry a condition that the item exists, so an unknown id is "not found", not a new item). Terraform passes the table name as `TABLE_NAME` and the region as `AWS_REGION`. Data survives deploys and restarts. The service stays at one task (see Scalability).
- **Wiring:** the frontend build sets no `VITE_API_URL`, so the browser calls its own origin and the API needs no CORS. The container gets `PORT`, `TABLE_NAME` and `AWS_REGION`.
- **First apply:** the ECS service is created before any image exists in ECR, so its task cannot start until the first image is pushed (the first push to `main` does this, or run the Backend and Frontend workflows by hand from the Actions tab, on `main`, so a fresh environment needs no dummy commit).
- **CI access:** GitHub Actions authenticates with OpenID Connect (OIDC), so no AWS access keys are stored anywhere. Terraform creates the GitHub OIDC provider and one IAM role, `task-manager-ci`, that only workflow runs on `main` of this repository can assume. The trust rule matches the `sub` claim GitHub issues for the repo, which includes the owner and repo IDs (`github_sub_prefix`), so a deleted and re-created repo with the same name cannot reuse the role. Its policy allows only ECR push on the API repository, `ecs:UpdateService` and `ecs:DescribeServices` on the API service (the workflow waits for the rollout to become stable), S3 list/write/delete on the frontend bucket, and `cloudfront:CreateInvalidation` on the one distribution. The PDF asks for credentials as CI secrets; here the only thing stored in GitHub is the role ARN (a repository variable, not a secret), and access keys in secrets are the alternative.
- **GitHub variables:** after `apply`, the workflows read six repository variables (Settings → Secrets and variables → Actions → Variables), each set from a Terraform output with `gh variable set`: `CI_ROLE_ARN` (`ci_role_arn`), `ECR_REPOSITORY_URL` (`ecr_repository_url`), `ECS_CLUSTER_NAME` (`ecs_cluster_name`), `ECS_SERVICE_NAME` (`ecs_service_name`), `FRONTEND_BUCKET_NAME` (`frontend_bucket_name`) and `CLOUDFRONT_DISTRIBUTION_ID` (`cloudfront_distribution_id`). None is a secret.
- **Region:** `eu-central-1`; change with `-var aws_region=...`.
- **Teardown:** `terraform destroy` (the ECR repository and the S3 bucket are emptied automatically).

## CI/CD

Two GitHub Actions workflows run on push to `main`, each only when its own folder, its own workflow file or `.nvmrc` changes (both read the Node version from it). They can also be run by hand from the Actions tab; the AWS role trusts only `main`, so run them on `main`. They assume the AWS role from the CI access section above, using the repository variables.

- **Backend (`.github/workflows/backend.yml`, on `backend/**`):**
  - **Steps:** `npm ci`, `npm run lint`, `npm test` (fails below 80% coverage), `npm run test:integration` against a DynamoDB Local service container, build the image, push it to ECR as `latest` and as the commit SHA, then force a new ECS deployment.
  - **Gate:** a lint error, a failing test or a failing integration test stops the run before anything reaches AWS.
  - **Rollout:** the run waits for the service to become stable, so a new task that never turns healthy fails the run instead of going green. The old task keeps serving until then.
  - **Overlap:** runs queue and never cancel each other mid-rollout.
- **Frontend (`.github/workflows/frontend.yml`, on `frontend/**`):**
  - **Steps:** `npm ci`, `npm run lint`, `npm test`, `npm run build` (type-check, then Vite build) with no `VITE_API_URL` (same-origin), then `aws s3 sync` to the bucket and a CloudFront invalidation of `/index.html`.
  - **Gate:** a lint error, a failing test or a type error stops the run before anything reaches AWS.
  - **Caching:** hashed files under `assets/` are uploaded first with a one-year `immutable` cache and `--delete`; `index.html` goes last with `no-cache`, so a visitor never gets a page that points at files not yet uploaded. The invalidation makes CloudFront drop its copy of `index.html`, so a new build shows on the next load.

## Design choices

- **ECS Fargate behind an ALB instead of the assignment's default EC2:** the ALB gives a real health check on `/health`, a stable DNS name and rolling deploys that keep the old task serving until the new one is healthy; deploying needs no SSH keys. Cost: about $25-30 a month, mostly the ALB.
- **Async `TaskStore` interface with two implementations:** in-memory (the assignment allows it, and it is what runs locally) and DynamoDB (deployed). `buildApp(store)` takes the store as an argument, so the routes and the service do not know which store runs, and the same contract test runs against both.
- **Frontend in its own private S3 bucket behind CloudFront:** it releases independently of the API. CloudFront serves the site and routes `/tasks*` and `/health` to the ALB, so the browser sees one HTTPS origin and needs no CORS. The API has no CORS plugin; locally the Vite dev proxy gives the same single origin.
- **Validation:** the route's JSON Schema holds the rules (the title is trimmed first by the `transform` keyword from `ajv-keywords`, then `minLength`/`maxLength` apply, so a title of 200 characters plus surrounding spaces is valid and 201 after trimming is a `400`). The service gets already-validated input. Every error, including unknown routes and malformed JSON, is `{ "error": "<message>" }`.
- **Tests in three layers:** service unit tests with a mocked store, HTTP tests through `app.inject()` against the real in-memory store, and the shared store contract test. Coverage is enforced at 80% in the Jest config.

## Assumptions

Where the assignment was unclear, these are the readings used:

- **"Every push to main" deploys:** each pipeline runs only when its own code, its workflow file or `.nvmrc` changes, so a docs-only push deploys nothing. Manual runs are available.
- **Storage:** the assignment names MongoDB or PostgreSQL, or in-memory / a JSON file with async access. The deployed API uses DynamoDB so data survives a deploy; locally it runs in-memory. DynamoDB fits the same async `TaskStore` interface, is serverless with no connection pool to manage, and is billed per request, which suits a small app. RDS Postgres is the alternative; it would need a running instance, a connection pool and a migration tool for one table.
- **Title:** a string, trimmed, 1-200 characters. The rules are in the route's JSON Schema; the trim is the `transform` keyword from `ajv-keywords`. Whitespace-only is a `400`. Unknown body fields are ignored.
- **Fields:** `id` is a UUID from `crypto.randomUUID()`; `createdAt` is an ISO 8601 UTC string; `GET /tasks` returns oldest first.
- **`done` and `priority`:** both are plain numbers. `done` is `0` (open) or `1` (done); the server sets `0` on create and ignores a `done` in the body. `priority` is `0` (high), `1` (medium) or `2` (low); it is optional on `POST /tasks` and defaults to `1`, and any other value (`3`, `1.5`, `"1"`, `null`) is a `400`.
  ```bash
  curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Ship it"}'
  # {"id":"...","title":"Ship it","createdAt":"...","done":0,"priority":1}
  curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Urgent","priority":0}'
  # {"id":"...","title":"Urgent","createdAt":"...","done":0,"priority":0}
  ```
- **Update and delete:**
  - `PATCH /tasks/:id` takes any of `title`, `done` and `priority` and changes only those. `id` and `createdAt` never change; other fields are ignored. A body with none of the three fields is a `400` with the message `body must include at least one of title, done, priority`. It returns `200` with the task.
  - `DELETE /tasks/:id` returns `204` with no body.
  - An unknown id is a `404` `{ "error": "Task not found" }` for both.
  ```bash
  curl -X PATCH localhost:3000/tasks/<id> -H 'content-type: application/json' -d '{"done":1}'
  curl -X PATCH localhost:3000/tasks/<id> -H 'content-type: application/json' -d '{"title":"New title","priority":2}'
  curl -X DELETE localhost:3000/tasks/<id>
  ```
- **Health:** liveness only (it does not check DynamoDB). `uptime` is whole seconds since the process started.
- **HTTPS and domain:** not required, and there is no custom domain. Users get HTTPS on CloudFront's `*.cloudfront.net` certificate; only the hop from CloudFront to the ALB is plain HTTP (see Unfinished and known limits).
- **EC2, SSH and CI secrets:** the assignment's default is EC2 with SSH keys in CI secrets. With ECS there is no SSH. CI logs in with GitHub OIDC and assumes an IAM role, so no AWS keys are stored; the only thing in GitHub is the role ARN, as a repository variable.
- **Terraform state:** local and gitignored; the owner applies once. CI deploys the app, never the infrastructure.

## Unfinished and known limits

Each item says how it would be completed.

- **Plain HTTP between CloudFront and the ALB:** users get HTTPS, but the last hop inside AWS is HTTP because the ALB has no certificate. With a domain, add an ACM certificate and an HTTPS listener on the ALB and switch the origin to `https-only`.
- **Any CloudFront distribution can reach the ALB:** the address list is CloudFront's as a whole, not this distribution's. To close that, have CloudFront add a secret header to its requests to the ALB and have an ALB listener rule forward only requests that carry it.
- **Terraform state on a laptop:** move it to an S3 backend with locking before a second person applies.
- **No authentication, no rate limiting, unbounded list:** `GET /tasks` returns everything and any client can post. Add pagination (`limit` and a cursor) and an AWS WAF rate rule, and authentication if tasks become per-user.
- **Frontend tests cover behavior, not looks:** Vitest and Testing Library run the real components and `api.ts`; MSW (Mock Service Worker) answers the network calls in-process, with small handlers in `src/test/fakeApi.ts` (the `PATCH` is kept in memory so the refetch shows it; the backend's rules are not copied, they are tested in the backend). The tests assert on the request the UI sent. A request with no handler fails the test. They cover the create form, the done toggle, editing (title and priority, blank title, cancel, Enter, Esc), delete with its confirmation, focus and failure, the Status and Priority filters and the counts, search, the By day switch, the pending state and the error alerts. The filter, sort, grouping and time logic has its own unit tests, and the health badge and the loading and error states are tested too. Not covered: how it looks, and the real network path (checked by hand in a browser).
- **No alarms or error tracking:** see Observability.
- **No automatic rollback:** CI pushes the image as `:latest` and forces a new deployment, so the task definition does not say which commit runs, and a bad image stays `:latest`. The run fails if the new task never turns healthy, and the old task keeps serving, but going back means pushing a fix. To finish: an ECS deployment circuit breaker with rollback, and CI registering a task definition revision per commit (`:<sha>`) and checking the rollout landed on it.
- **No shutdown handler:** the API does not drain on SIGTERM. ECS first takes the task out of the ALB and waits up to 30 seconds for open requests to finish, so little is cut. To finish: on SIGTERM, `app.close()` and exit.
- **Actions pinned by tag, not commit:** the workflows that can assume the AWS role use `@v4`-style tags, which can move. To finish: pin each `uses:` to a commit SHA. There is also no workflow on pull requests, because changes go straight to `main`.

## System Architecture

```
Browser ──HTTPS──> CloudFront ─┬─ /* ──────────────> S3 (private bucket, static site)
                               └─ /tasks*, /health ─HTTP─> ALB ──> ECS Fargate (Fastify API)
                                                                          │
                                                                          └──> DynamoDB
```

### Scalability: 10x traffic tomorrow

The API keeps no state in the container, so the steps are about capacity, not a redesign. In order:

1. **Run several tasks.** Set `desired_count` to at least 2, spread over availability zones (the ALB already spans them), and add ECS service auto scaling with target tracking, for example on `ALBRequestCountPerTarget` with CPU as a second signal. The rolling-deploy settings (`minimum_healthy_percent = 100`) already keep capacity during a release.
2. **Fix the list query.** `GET /tasks` is the first hot spot: a full `Scan` with `ConsistentRead`, sorted in code, so its cost grows with the table. Add pagination (`limit` and a cursor) and a key that reads in time order: a global secondary index or a time-sortable key, so the list becomes a `Query`. DynamoDB on demand scales the point reads and writes with no capacity planning.
3. **Protect the API.** AWS WAF rate limiting on CloudFront so one noisy client cannot use up the capacity.
4. **Size from a load test.** The task is 0.25 vCPU and 512 MB. Load-test one task first (for example with `autocannon` against `POST /tasks` and `GET /tasks`) and set the size and the scaling target from the measured requests per second, not a guess.
5. **Static traffic is already at the edge.** CloudFront serves the site from its cache. The API paths are not cached on purpose, so a list is never stale; a short cache on `GET /tasks` would only pay off once reads are the bulk of traffic.

### Observability

What exists today:

- **Logs:** the API writes one JSON line per request (method, path without query string, status, response time in ms) plus Fastify's startup and error lines. The ECS `awslogs` driver ships them to the CloudWatch log group, kept 14 days.
- **Health:** the ALB checks `/health` every 15 seconds and removes an unhealthy task from rotation. The backend workflow waits for the rollout to become stable, so a release that never turns healthy fails the run.

What I would add, in order:

- **Alarms (CloudWatch to SNS to email or chat):** ALB `HTTPCode_Target_5XX_Count`, `TargetResponseTime` p95, `UnHealthyHostCount`, and ECS running task count below desired. A metric filter on the log group for lines with `status >= 500` gives an error-rate alarm with no code change.
- **Log queries:** CloudWatch Logs Insights over the JSON fields, for example the slowest paths or the count of `400` by hour.
- **Error tracking:** Sentry in the Fastify error handler (unexpected `500`s with stack traces) and in the React app (render and network errors the user sees), with the release set to the commit SHA the pipeline already tags images with.
- **Uptime from outside:** a Route 53 health check or an external probe on `/health`, because the ALB check cannot tell you the ALB itself is unreachable.
- **Request IDs:** return Fastify's request id in a response header and in the error body, so a user's failed request can be found in the logs.
- **Container Insights** for CPU and memory per task, which also feeds the scaling policy.

### AI use

Claude Code (Anthropic's CLI agent) wrote most of the code and Terraform, one task at a time, from a requirements checklist and task list I reviewed. I made the hard-to-reverse choices (stack, hosting, storage, serving the frontend) and approved them before any code was written; the agent proposed, I decided. Where it helped: scaffolding, test-first work on the service and routes, the Terraform and the OIDC trust rule, and finding the causes of deployment failures from the logs (a wrong OIDC subject, a missing ECR permission).

Every time I corrected it is recorded with the lesson in `docs/pushbacks.md`. Two concrete cases:

- **A database built without a design pass (pushback #11).** The agent built the DynamoDB store and table with `id` as the key because the task text said so, without writing down the access patterns or the consistency model. I asked for that design review. It found a real bug: the list used DynamoDB's default eventually consistent `Scan`, so a task created a moment earlier could be missing from the list. DynamoDB Local cannot show this, so the integration test was green. Fixed test first with `ConsistentRead: true`.
- **A deploy that could go green on a broken image (pushback #9).** The agent's CI plan ran `aws ecs update-service` and stopped there, because the task list said only that. I asked for the standard check: without `aws ecs wait services-stable`, the pipeline reports success while the new task is still failing its health checks. The `ecs:DescribeServices` permission went into the CI role before its first apply, and the wait into the pipeline.
