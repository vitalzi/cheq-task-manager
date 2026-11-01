# Task manager

A small task manager: a REST API (create and list tasks) with a React frontend, deployed to AWS. Built as a hiring take-home; the assignment is in `cheq_assignment.pdf`.

> Work in progress. Sections are added together with the code they describe.

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

## Frontend

Requires Node 24 and npm. Start the backend first (see above).

```bash
cd frontend
npm install
npm run dev      # app on http://localhost:5173
npm run lint     # ESLint (typescript-eslint and React hooks rules)
npm run build    # type-check, then build to frontend/dist
```

- **`VITE_API_URL`:** the API base URL baked into the build. Leave it unset locally: the app calls its own origin and the Vite dev server proxies `/health` and `/tasks` to `http://localhost:3000`. Set it for a deployed build, for example `VITE_API_URL=http://<alb-dns> npm run build`; the API must then allow the page's origin through `CORS_ORIGIN`.

## Docker

The API ships as a container image (multi-stage, Node 24 Alpine, runs as the unprivileged `node` user). The frontend is static files and is not containerized.

```bash
cd backend
docker build -t task-api .
docker run --rm --init -p 3000:3000 task-api   # add -e CORS_ORIGIN=<site origin> if needed
curl localhost:3000/health
```

`--init` makes `docker stop` immediate: the image runs `node` as PID 1, which ignores SIGTERM without a handler, so without it a stop waits for the kill timeout.

## Infrastructure

All AWS resources are Terraform in `infra/`, with local state (gitignored). CI deploys the app only; it never changes infrastructure. Needs Terraform >= 1.5 and AWS credentials.

```bash
cd infra
terraform init
terraform plan    # review: 19 resources to add
terraform apply   # run once from a laptop
terraform output  # alb_url, s3_website_url, ecr_repository_url, ...
```

- **API:** ECS Fargate (one task, 0.25 vCPU / 512 MB) behind an Application Load Balancer that checks `GET /health`. It runs in the default VPC's public subnets with no NAT gateway; the task's security group accepts port 3000 only from the load balancer.
- **Frontend:** a public S3 bucket with website hosting (HTTP). Block Public Access is off for this bucket only.
- **Wiring:** Terraform passes the S3 website URL to the container as `CORS_ORIGIN`; the ALB URL (`alb_url`) is what the frontend build takes as `VITE_API_URL`.
- **First apply:** the ECS service is created before any image exists in ECR, so its task cannot start until the first image is pushed (the first push to `main` does this).
- **CI access:** GitHub Actions authenticates with OpenID Connect (OIDC), so no AWS access keys are stored anywhere. Terraform creates the GitHub OIDC provider and one IAM role, `task-manager-ci`, that only workflow runs on `main` of the repository in `github_repository` can assume. Its policy allows only ECR push on the API repository, `ecs:UpdateService` and `ecs:DescribeServices` on the API service (the workflow waits for the rollout to become stable), and S3 list/write/delete on the frontend bucket. The PDF asks for credentials as CI secrets; here the only thing stored in GitHub is the role ARN (a repository variable, not a secret), and access keys in secrets were the considered alternative.
- **GitHub variables:** after `apply`, the workflows read six repository variables (Settings → Secrets and variables → Actions → Variables), each set from a Terraform output with `gh variable set`: `CI_ROLE_ARN` (`ci_role_arn`), `ECR_REPOSITORY_URL` (`ecr_repository_url`), `ECS_CLUSTER_NAME` (`ecs_cluster_name`), `ECS_SERVICE_NAME` (`ecs_service_name`), `FRONTEND_BUCKET_NAME` (`frontend_bucket_name`) and `API_URL` (`alb_url`, used as `VITE_API_URL`). None is a secret.
- **Region:** `eu-central-1`; change with `-var aws_region=...`.
- **Teardown:** `terraform destroy` (the ECR repository and the S3 bucket are emptied automatically).

## CI/CD

Two GitHub Actions workflows run on push to `main`, each only when its own folder changes. They assume the AWS role from the CI access section above, using the repository variables.

- **Backend (`.github/workflows/backend.yml`, on `backend/**`):**
  - **Steps:** `npm ci`, `npm run lint`, `npm test` (fails below 80% coverage), build the image, push it to ECR as `latest` and as the commit SHA, then force a new ECS deployment.
  - **Gate:** a lint error or a failing test stops the run before anything reaches AWS.
  - **Rollout:** the run waits for the service to become stable, so a new task that never turns healthy fails the run instead of going green. The old task keeps serving until then.
  - **Overlap:** runs queue and never cancel each other mid-rollout.
