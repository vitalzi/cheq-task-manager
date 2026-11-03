# Task manager

A small task manager: a REST API (create and list tasks) with a React frontend, deployed to AWS. Built as a hiring take-home; the assignment is in `cheq_assignment.pdf`.

## Live deployment

- **Frontend:** https://d1vsq2jivxqe81.cloudfront.net
- **API:** the same address (`GET /health`, `GET /tasks`, `POST /tasks`); CloudFront sends `/tasks*` and `/health` to the API
- **Repository:** https://github.com/vitalzi/cheq-task-manager

The site and the API share one HTTPS address with a valid certificate. The old S3 website URL no longer exists, and the ALB's plain-HTTP address still answers but is not the entry point (see Unfinished and known limits). Tasks are stored in DynamoDB, so they survive deploys and restarts.

## Folder map

- **`backend/`:** Fastify API in TypeScript
- **`frontend/`:** React app (Vite, TypeScript)
- **`infra/`:** Terraform for the AWS resources
- **`.github/workflows/`:** CI/CD pipelines, one per deployable
- **`docs/`:** requirements, decisions, plan and task list

## Backend

Requires Node 24 (see `.nvmrc`) and npm.

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

**Integration test (DynamoDB Local).** `DynamoTaskStore` runs the same contract test as the in-memory store, against a local DynamoDB in Docker. It is a separate script so `npm test` needs nothing but Node.

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
npm run build    # type-check, then build to frontend/dist
```

- **`VITE_API_URL`:** the API base URL baked into the build. Leave it unset locally: the app calls its own origin and the Vite dev server proxies `/health` and `/tasks` to `http://localhost:3000`. The deployed build leaves it unset too, because CloudFront serves the site and the API from one origin. The API sends no CORS headers, so a build pointed at a different API origin would be blocked by the browser.

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

- **API:** ECS Fargate (one task, 0.25 vCPU / 512 MB) behind an Application Load Balancer that checks `GET /health`. It runs in the default VPC's public subnets with no NAT gateway; the task's security group accepts port 3000 only from the load balancer.
- **Frontend and HTTPS:** a CloudFront distribution is the entry point at `https://<id>.cloudfront.net` (`cloudfront_url`), which has a valid certificate without a domain. Its default behavior serves the site from a private S3 bucket; `/tasks*` and `/health` go to the ALB with caching off and all methods allowed. The hop from CloudFront to the ALB is plain HTTP inside AWS.
- **Why the bucket is private:** Block Public Access is on, website hosting is off, and the bucket policy lets only this one distribution read objects (Origin Access Control). Nobody can reach the files except through CloudFront, so there is one front door that serves HTTPS.
- **Storage:** one DynamoDB table (`task-manager-tasks`, on demand, `id` as the key). The container runs with its own IAM task role that may only `Scan` and `PutItem` on that table, the two calls the store makes. Terraform passes the table name as `TABLE_NAME` and the region as `AWS_REGION`. Data survives deploys and restarts. The service stays at one task (see Scalability).
- **Wiring:** the frontend build sets no `VITE_API_URL`, so the browser calls its own origin and the API needs no CORS. The container gets only `PORT`.
- **First apply:** the ECS service is created before any image exists in ECR, so its task cannot start until the first image is pushed (the first push to `main` does this).
- **CI access:** GitHub Actions authenticates with OpenID Connect (OIDC), so no AWS access keys are stored anywhere. Terraform creates the GitHub OIDC provider and one IAM role, `task-manager-ci`, that only workflow runs on `main` of this repository can assume. The trust rule matches the `sub` claim GitHub issues for the repo, which includes the owner and repo IDs (`github_sub_prefix`), so a deleted and re-created repo with the same name cannot reuse the role. Its policy allows only ECR push on the API repository, `ecs:UpdateService` and `ecs:DescribeServices` on the API service (the workflow waits for the rollout to become stable), S3 list/write/delete on the frontend bucket, and `cloudfront:CreateInvalidation` on the one distribution. The PDF asks for credentials as CI secrets; here the only thing stored in GitHub is the role ARN (a repository variable, not a secret), and access keys in secrets were the considered alternative.
- **GitHub variables:** after `apply`, the workflows read six repository variables (Settings → Secrets and variables → Actions → Variables), each set from a Terraform output with `gh variable set`: `CI_ROLE_ARN` (`ci_role_arn`), `ECR_REPOSITORY_URL` (`ecr_repository_url`), `ECS_CLUSTER_NAME` (`ecs_cluster_name`), `ECS_SERVICE_NAME` (`ecs_service_name`), `FRONTEND_BUCKET_NAME` (`frontend_bucket_name`) and `CLOUDFRONT_DISTRIBUTION_ID` (`cloudfront_distribution_id`). None is a secret. The old `API_URL` variable is no longer used and can be deleted.
- **Region:** `eu-central-1`; change with `-var aws_region=...`.
- **Teardown:** `terraform destroy` (the ECR repository and the S3 bucket are emptied automatically).

## CI/CD

Two GitHub Actions workflows run on push to `main`, each only when its own folder changes. They assume the AWS role from the CI access section above, using the repository variables.

- **Backend (`.github/workflows/backend.yml`, on `backend/**`):**
  - **Steps:** `npm ci`, `npm run lint`, `npm test` (fails below 80% coverage), build the image, push it to ECR as `latest` and as the commit SHA, then force a new ECS deployment.
  - **Gate:** a lint error or a failing test stops the run before anything reaches AWS.
  - **Rollout:** the run waits for the service to become stable, so a new task that never turns healthy fails the run instead of going green. The old task keeps serving until then.
  - **Overlap:** runs queue and never cancel each other mid-rollout.
- **Frontend (`.github/workflows/frontend.yml`, on `frontend/**`):**
  - **Steps:** `npm ci`, `npm run lint`, `npm run build` (type-check, then Vite build) with no `VITE_API_URL` (same-origin), then `aws s3 sync` to the bucket and a CloudFront invalidation of `/index.html`.
  - **Gate:** a lint or type error stops the run before anything reaches AWS. The frontend has no tests (optional in the assignment).
  - **Caching:** hashed files under `assets/` are uploaded first with a one-year `immutable` cache and `--delete`; `index.html` goes last with `no-cache`, so a visitor never gets a page that points at files not yet uploaded. The invalidation makes CloudFront drop its copy of `index.html`, so a new build shows on the next load.

## Design choices

- **ECS Fargate behind an ALB instead of the assignment's default EC2:** the ALB gives a real health check on `/health`, a stable DNS name and rolling deploys that keep the old task serving until the new one is healthy; deploying needs no SSH keys. Cost: about $25-30 a month, mostly the ALB.
- **Async `TaskStore` interface with two implementations:** in-memory (the assignment allows it, and it is what runs locally) and DynamoDB (deployed). `buildApp(store)` takes the store as an argument, so switching needed no change to the routes or the service, and the same contract test runs against both.
- **Frontend in its own private S3 bucket behind CloudFront:** it releases independently of the API. CloudFront serves the site and routes `/tasks*` and `/health` to the ALB, so the browser sees one HTTPS origin and needs no CORS. The API has no CORS plugin; locally the Vite dev proxy gives the same single origin.
- **Validation split:** the route schema checks the type (`title` is a string); the service trims and checks the length, so a title of 200 characters plus surrounding spaces is valid and 201 after trimming is a `400`. Every error, including unknown routes and malformed JSON, is `{ "error": "<message>" }`.
- **Tests in three layers:** service unit tests with a mocked store, HTTP tests through `app.inject()` against the real in-memory store, and the shared store contract test. Coverage is enforced at 80% in the Jest config.

## Assumptions

Where the assignment was unclear, these are the readings used:

- **Storage:** the assignment accepts in-memory. The first version used it; the deployed API now uses DynamoDB so data survives a deploy.
- **Title:** a string, trimmed, 1-200 characters. The rules are in the route's JSON Schema; the trim is the `transform` keyword from `ajv-keywords`. Whitespace-only is a `400`. Unknown body fields are ignored.
- **Fields:** `id` is a UUID from `crypto.randomUUID()`; `createdAt` is an ISO 8601 UTC string; `GET /tasks` returns oldest first.
- **`done` and `priority`:** both are plain numbers. `done` is `0` (open) or `1` (done); the server sets `0` on create and ignores a `done` in the body. `priority` is `0` (high), `1` (medium) or `2` (low); it is optional on `POST /tasks` and defaults to `1`, and any other value (`3`, `1.5`, `"1"`, `null`) is a `400`.
  ```bash
  curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Ship it"}'
  # {"id":"...","title":"Ship it","createdAt":"...","done":0,"priority":1}
  curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Urgent","priority":0}'
  # {"id":"...","title":"Urgent","createdAt":"...","done":0,"priority":0}
  ```
- **Health:** liveness only (it does not check DynamoDB). `uptime` is whole seconds since the process started.
- **HTTPS and domain:** not required, so the API and the website use plain HTTP on the AWS-generated hostnames. This also avoids browser mixed-content blocking.
- **EC2, SSH and CI secrets:** the assignment's default is EC2 with SSH keys in CI secrets. With ECS there is no SSH. CI logs in with GitHub OIDC and assumes an IAM role, so no AWS keys are stored; the only thing in GitHub is the role ARN, as a repository variable.
- **Terraform state:** local and gitignored; the owner applies once. CI deploys the app, never the infrastructure.

## Unfinished and known limits

Each item says how it would be completed.

- **Plain HTTP between CloudFront and the ALB:** users get HTTPS, but the last hop inside AWS is HTTP because the ALB has no certificate. With a domain, add an ACM certificate and an HTTPS listener on the ALB and switch the origin to `https-only`.
- **Terraform state on a laptop:** move it to an S3 backend with locking before a second person applies.
- **No authentication, no rate limiting, unbounded list:** `GET /tasks` returns everything and any client can post. Add pagination (`limit` and a cursor) and an AWS WAF rate rule, and authentication if tasks become per-user.
- **No frontend tests:** optional in the assignment. Component tests with Vitest or Jest and Testing Library would cover the form validation, double-submit and the three list states.
- **No alarms or error tracking yet:** see Observability.

## Scalability: 10x traffic tomorrow

What would change in this design, in order:

1. **Replace the in-memory store.** This is the blocker: each container holds its own tasks, so a second task would show a different list per request. Move to DynamoDB on-demand, which scales with no capacity planning for this access pattern.
2. **Run several tasks.** Set `desired_count` to at least 2, spread over the default VPC's subnets in different availability zones (the ALB already spans them), and add ECS service auto scaling with target tracking, for example on `ALBRequestCountPerTarget` with CPU as a second signal. The rolling-deploy settings (`minimum_healthy_percent = 100`) already keep capacity during a release.
3. **Cap the list response.** `GET /tasks` grows with the data; add pagination before the table is large.
4. **Take static and read traffic off the origin.** The site is already static files on S3; CloudFront in front adds caching and absorbs spikes. A short cache on `GET /tasks` would only be safe once reads are the bulk of traffic and slightly stale lists are acceptable.
5. **Protect the API.** AWS WAF rate limiting on the ALB so one noisy client cannot use up the capacity.
6. **Size.** The task is 0.25 vCPU and 512 MB. Load-test one task first (for example with `autocannon` against `POST /tasks` and `GET /tasks`) and set the size and the scaling target from the measured requests per second, not a guess.

## Observability

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

## AI use

Claude Code (Anthropic's CLI agent) wrote most of the code and Terraform, one task at a time, from a requirements checklist and task list I reviewed. I made the hard-to-reverse choices (stack, hosting, storage, serving the frontend) and approved them before any code was written; the agent proposed, I decided. Where it helped: scaffolding, test-first work on the service and routes, the Terraform and the OIDC trust rule, and finding the causes of deployment failures from the logs (a wrong OIDC subject, a missing ECR permission).

Every time I corrected it is recorded with the lesson in `docs/pushbacks.md`. Two concrete cases:

- **Tests reported complete too early.** After writing the store tests, the agent said they were complete having broken the code only once to see a test fail. I doubted it, so it broke the store four more ways. All were caught. After that, every test set was checked by breaking the production code on purpose before being called done, and a logging test that asserted nothing was deleted.
- **A confident wrong diagnosis.** When the editor showed type errors in the test files, the agent stated as fact that `tsconfig.json` excluded them. That was a guess; the real cause was the editor's bundled TypeScript no longer loading `@types/*` automatically, fixed with an explicit `types` list. It then removed the working setup on the strength of an empty result from a diagnostics tool that had not re-checked the file, and the errors came back. The rule since: treat a diagnosis as a hypothesis until it is confirmed in the place the problem is seen.
