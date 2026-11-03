# Agent decisions

Small decisions the agent made while building, one entry per decision with the task number and the reason. Decisions agreed beforehand live in `docs/decisions.md`; do not mix the two.

## Task 2: Backend scaffold

- **TypeScript pinned to ~5.9 in `backend/`:** ts-jest 29 cannot use the TypeScript 7 compiler API that npm installs by default.
- **Jest transforms `cookie`:** Fastify's `inject()` pulls in the ESM-only `cookie@2`, and Jest runs CommonJS. `jest.config.js` lets ts-jest transpile that one package (`allowJs` in `tsconfig.json`).

## Task 3: Task store

- **Contract helper is `taskStore.contract.ts`, not `*.test.ts`:** Jest does not run it on its own; each store's test file calls `describeTaskStore`. `tsconfig.json` excludes it so test code is not compiled into `dist`.
- **`list()` returns a copy (`[...this.tasks]`):** callers cannot change the store through the returned array; the contract test pins this.

## Task 4: Task service

- **Validation messages:** `title must be a string`, `title must not be empty`, `title must be at most 200 characters`. They are the `error` text clients see, so each names the rule that failed.
- **`ValidationError` has no extra fields:** the error handler only needs `instanceof ValidationError` to pick `400`.

## Task 5: Task routes

- **Ajv `coerceTypes: false`:** Fastify's default Ajv turns `{ "title": 42 }` into `"42"` and `["a"]` into `"a"`, so a wrong type returned `201`. Found by the HTTP tests; a wrong type must be `400`.
- **`text/plain` body gives `400`, not `415`:** Fastify has a built-in `text/plain` parser, so the body is a string and fails the schema's "must be object" check. The task allows `400`/`415`; I did not add a custom parser. A content type with no parser (for example `application/xml`) gives `415`.
- **Fastify's own 4xx messages are passed through:** schema, malformed JSON and media-type errors keep Fastify's text in the `error` field (for example `body/title must be string`). They are accurate and specific, so I did not rewrite them.
- **`500` returns a fixed `Internal Server Error`:** the real error is logged with `request.log.error`, never sent to the client, so store details cannot leak. A test pins this.
- **Not-found message is `Route not found`:** one message for unknown routes and unsupported methods; Fastify answers both with 404.
- **Routes are a plain function `registerTaskRoutes(app, service)`:** stateless, and Fastify expects functions here. `buildApp` creates the `TaskService` from the store it is given.

## Task 2/3 follow-up (found during Task 5)

- **`"types": ["node", "jest"]` in `tsconfig.json`:** fixes the editor errors on `describe`/`expect`. VS Code bundles TypeScript 6.0, which no longer loads `@types/*` automatically (our CLI uses 5.9, which does). Listing them works on both.
- **Tests stay in `tsconfig.json`; `tsconfig.build.json` excludes them for `npm run build`:** I tried putting the `exclude` back and deleting the second file, and the owner still saw red underlines in VS Code. The diagnostics tool had reported no errors for those files, so it is not a reliable check for excluded files. Only the owner's editor settles this. Bonus: `tsc --noEmit` type-checks tests too.

## Task 6: Logging, CORS, server entry

- **`buildApp(store, options)` with `AppOptions { logger, corsOrigin }`:** tests need to inject a log stream and an origin; `server.ts` fills them from the environment. Both are optional, so `buildApp(store)` still works and stays silent (logger off) in tests.
- **Our own `onResponse` hook, Fastify's request logging off:** Fastify normally logs two lines per request ("incoming request", "request completed") without the fields the task asks for. `LogController({ disableRequestLogging: true })` leaves only our single line. The top-level `disableRequestLogging` option works but prints a deprecation warning in this Fastify version.
- **Log fields `method`, `path`, `status`, `responseTimeMs`:** `path` has the query string stripped, because query values can carry secrets. Pino adds `reqId`, `time` and `level`. `responseTimeMs` comes from `reply.elapsedTime` and is not rounded.
- **CORS origin passed as a one-item array:** with a plain string, `@fastify/cors` sends the allowed origin to every caller. The browser still blocks the mismatch, but the array makes the server compare and send nothing to other sites.
- **No `CORS_ORIGIN` means no CORS plugin:** same-origin only. Local dev goes through the Vite proxy (task 8); the deployed API gets the S3 website URL from Terraform (task 13).
- **`npm audit` reports `deepmerge` in Jest's dev tree:** not from `@fastify/cors`, not in the production image. The suggested fix downgrades Jest to v25, so I did not apply it.

## Restructure: `src/tasks/`

- **Task files grouped in `backend/src/tasks/`, tests stay next to their code:** `src/` had 13 flat files. `docs/plan.md` had planned a separate `test/` folder; tests were co-located from Task 2 on without flagging the change. The owner agreed to co-location after the trade-offs were explained (a separate folder needs `rootDir`/`include` changes in the tsconfigs, longer imports and mirrored folders). `docs/plan.md` layout updated to match.

## Task 7: Coverage gate

- **Coverage runs on every `npm test` (`collectCoverage: true`):** the 80% gate then cannot be skipped by forgetting a flag, and CI (task 15) needs no extra command. Cost: about a second more per run.
- **`collectCoverageFrom` lists `src/**/*.ts` minus `*.test.ts` and `*.contract.ts`:** without it Jest only counts files a test imports, so `server.ts` would be invisible. The contract file is test code and would inflate the numbers.
- **`server.ts` is not excluded:** it sits at 0%, but total coverage is 89% (statements), well over 80%, so no exclusion is needed. The task allowed one; not taking it keeps the number honest.

## Task 8: Frontend scaffold

- **No frontend tests, no test dependency:** `plan.md` and `decisions.md` skip frontend tests in the MVP and Jest/Vitest for React is not in the approved stack. The TDD skill conflicts; CLAUDE.md wins. Check is the browser check from `docs/tasks/phase-1.md`.
- **`typescript@~5.9` in the frontend:** npm picked 7.x by default; matching the backend keeps one compiler version across the repo.
- **`@vitejs/plugin-react` added:** the standard glue that makes Vite compile JSX with Fast Refresh. Needed for any Vite + React app, so treated as part of the approved stack.
- **Proxy target hardcoded to `http://localhost:3000`:** an env override needs `@types/node` for no current benefit. It is a dev-only setting.
- **`VITE_API_URL ?? ''`:** empty locally (calls go through the Vite proxy), the ALB URL in the deployed build.
- **Health badge has three states (up / down / checking) and `retry: false`:** "checking" avoids a red flash on first load; no retry so one failed poll turns it red at once.
- **`build` script runs `tsc --noEmit` before `vite build`:** Vite does not type-check, so without it type errors would ship.

## Task 9: Task list

- **`retry: false` on the tasks query:** TanStack Query retries 3 times with backoff by default, so the alert would appear about 7 seconds late. The alert has its own Retry button.
- **Retry button disabled while refetching:** stops repeated clicks from stacking requests.
- **List rows show title and local-time `createdAt`:** the PDF requires the list; the date costs one line and shows the order. No other fields exist.
- **Manual checks used a throwaway stub server in the scratchpad (not in the repo):** the real API cannot answer slowly or with an HTML 502, which the "done when" check needs.

## Task 10: Create form

- **No frontend test, TDD skill conflict:** same as Task 8; no test framework in the approved stack, so CLAUDE.md wins. Checked in the browser against the real API instead.
- **Validation lives in the component, not `api.ts`:** the check (`title.trim() === ''`) is one line and the server still enforces the real rules (200 chars, types). Only emptiness is checked client-side, as the PDF asks; over-long titles come back as the API's `400` message in the error alert.
- **Submit guarded twice against double sends:** the button is disabled while pending, and `handleSubmit` returns early if the mutation is pending, because Enter submits even when the button is disabled. A real double-click sent one POST. Two synchronous scripted `click()` calls sent two, because React had not re-rendered between them; real input does not behave that way.
- **Typed text is cleared only on success:** after a failed request the title stays so the user can retry without retyping.
- **Validation message clears on the next keystroke:** otherwise it stays next to a now-valid input.

## Task 11: Responsive layout

- **One breakpoint, 480px:** below it each list row stacks title over date; above it they sit side by side. Nothing else needed to change. The form row already shrinks with `min-width: 0` on the input.
- **Centered column, `max-width: 40rem`:** the PDF asks for a layout that works at both widths, not a design; a readable column is the least that does that.
- **Small global `index.css` (box-sizing, body font, margin reset):** the only global CSS. Everything else stays in CSS Modules.
- **Long titles wrap (`overflow-wrap: anywhere`):** a 200-character title with no spaces would otherwise push the page sideways on mobile. Checked with a 120-character unbroken title.
- **375px checked in a same-origin iframe:** the Chrome window resize did not change the viewport (`innerWidth` stayed 1220), and the iframe applies media queries against its own width. Desktop was checked in the full window.

## Task 12: Dockerfile

- **No test written first, configuration not code:** the red step was `docker build` with no Dockerfile (fails: file not found); the green check is build, run, `/health`, `id`.
- **Base image `node:24.22.2-alpine`, by version tag not digest:** `node:24-alpine` resolved to 24.22.2 at build time. An exact version is reproducible and readable; a digest would pin harder but hides which Node it is. Alpine keeps the image at 257 MB.
- **Final stage runs `npm ci --omit=dev` itself instead of copying `node_modules` from the build stage:** the build stage's `node_modules` includes Jest, ts-jest and tsx.
- **`USER node`:** the official image already has an unprivileged user (uid 1000), so no `adduser` needed.
- **No `HEALTHCHECK` in the image:** the ALB target group checks `/health` (Task 13), and Alpine has no `curl`; adding one would be extra for no benefit.
- **Node as PID 1 ignores SIGTERM:** `docker stop` took 10 s (the kill timeout) without `--init` and 0.15 s with it. I did not add a signal handler to `server.ts` (extra app code and a test). **Task 13 must set `initProcessEnabled = true` in the ECS container definition's `linuxParameters`**, otherwise each rollout waits out ECS's stop timeout (30 s by default) for the old task.

## Task 13: Terraform app infrastructure

- **Region `eu-central-1`, as a variable:** it is the region already configured in the owner's AWS CLI.
- **Provider `hashicorp/aws ~> 6.0`, lock file committed:** a lock file pins exact provider versions for reproducible applies. `.terraform/` stays gitignored.
- **One file per concern (`network`, `ecr`, `alb`, `ecs`, `s3`, `outputs`):** each stays short and is easy to explain.
- **Bucket named `task-manager-frontend-<account id>`:** bucket names are global; the account id avoids collisions without a `random` provider.
- **Image `:latest` in the task definition:** matches the plan; CI only forces a new deployment, so the task definition never changes after the first apply. The first apply creates a service whose task cannot start until the first image is pushed (Task 17).
- **Task 256 CPU / 512 MB:** the smallest Fargate size; the API is three trivial endpoints.
- **Target group `deregistration_delay = 30`:** the default of 300 s would hold every rollout open for 5 minutes.
- **`force_delete` on ECR and `force_destroy` on S3:** so `terraform destroy` works when the owner tears the demo down.
- **Two security groups:** ALB takes port 80 from anywhere; the task takes port 3000 only from the ALB group. Tasks have public IPs (no NAT), so this is what keeps them closed to the internet.
- **Extra outputs (`ecs_cluster_name`, `ecs_service_name`, `frontend_bucket_name`):** the CI workflows in Tasks 15 and 16 need these as GitHub variables.
- **No task role, only the execution role:** the app calls no AWS APIs.
- **Log retention 14 days:** avoids unbounded log storage.

## Task 14: CI access (GitHub OIDC)

- **Trust rule uses the repo's ID-based `sub` prefix (`github_sub_prefix`), not `owner/name`:** found when the first deploy failed with `Not authorized to perform sts:AssumeRoleWithWebIdentity`. New GitHub repos issue `repo:<owner>@<owner id>/<repo>@<repo id>:ref:...`; `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` shows the prefix. The first version matched `repo:vitalzi/cheq-task-manager:...`, which this repo never sends. The ID form is also safer: a deleted and re-created repo with the same name gets new IDs. The value is public, so a default is fine.
- **Trust rule matches `sub` exactly (`ref:refs/heads/main`) plus `aud = sts.amazonaws.com`:** a pull request or another branch cannot assume the role, which is what lets the policy hold write access.
- **No `thumbprint_list` on the OIDC provider:** AWS now validates GitHub's certificate itself, and AWS provider 6 makes the field optional.
- **Policy is inline on the role, not a separate managed policy:** it has no other user, so one resource fewer to explain.
- **`ecr:GetAuthorizationToken` on `*`:** AWS does not support resource-level scoping for this call. Every other action is limited to the one repo, service or bucket.
- **S3 has `PutObject`, `DeleteObject` and `ListBucket`:** `aws s3 sync` needs list to compare; delete is for removing old hashed assets with `--delete`. Task 16 may drop it if the workflow does not use `--delete`.
- **`ecs:DescribeServices` on the same service:** the owner wants the backend workflow (Task 15) to run `aws ecs wait services-stable`, so a rollout that never becomes healthy fails the run. That command polls `DescribeServices`. I had first left it out because the plan only mentioned `update-service`.
- **GitHub variable names are upper-case and mirror the Terraform outputs** (`CI_ROLE_ARN`, `ECR_REPOSITORY_URL`, `ECS_CLUSTER_NAME`, `ECS_SERVICE_NAME`, `FRONTEND_BUCKET_NAME`, `API_URL`): the usual convention for CI variables. They are variables, not secrets, because none is sensitive. `API_URL` is the ALB URL the frontend workflow passes as `VITE_API_URL`.
- **Repository created public and the existing 20 commits pushed before the Task 14 commit:** the owner asked me to do the setup with `gh`. I checked tracked files and history for keys and `.env`/state files first and found none; `terraform.tfstate` is gitignored and was not pushed.

## Task 15: Backend workflow

- **Image tagged with the commit SHA and `latest`:** the task definition points at `:latest`, so `latest` is what ECS pulls; the SHA tag only tells you which commit an image came from. The ECR repository is mutable, so `latest` can move.
- **One job, tests then deploy steps:** a second job would need artifacts or a rebuild. Steps run in order, so a failing `npm test` stops the run before the AWS login.
- **Region in a workflow `env` (`eu-central-1`), not a GitHub variable:** it matches the Terraform default and is not worth a seventh variable. Change both together if the region changes.
- **Actions pinned to major versions (`@v4`, `@v2`), not commit SHAs:** readable, and these are official GitHub and AWS actions. SHA pinning is the stricter option for later.
- **Node version from the root `.nvmrc`:** CI and local development share one source. `npm` is cached through `backend/package-lock.json`.
- **The workflow file is in its own path filter:** editing it re-runs the deploy, so a change to the pipeline is tested by the pipeline. The cost is that committing it triggers the first deploy.
- **`concurrency` group with `cancel-in-progress: false`:** cancelling a run during `update-service` could leave a rollout half-checked; queueing is safer.
- **Runner is `ubuntu-latest` (x86_64):** matches the `X86_64` Fargate setting from Task 13, so no cross-build is needed.
- **Linter in Task 15, ESLint with `typescript-eslint`, in both packages:** the owner noticed there was none and asked for it inside this task, so it is not a separate task. Dev dependencies only (`eslint`, `@eslint/js`, `typescript-eslint`, and `eslint-plugin-react-hooks` in the frontend); the production image is unchanged. No Prettier: not requested.
- **ESLint 10, not 9:** it is the current release and `typescript-eslint` 8.72 supports it and our pinned TypeScript 5.9.
- **`recommended` plus three type-aware rules, not the full type-checked preset:** `no-floating-promises`, `no-misused-promises` and `await-thenable` catch the async mistakes the PDF grades ("correct async patterns"). I first tried `recommendedTypeChecked` and got 31 backend and 6 frontend errors: `require-await` on the `InMemoryTaskStore` methods (async by design, to match the `TaskStore` interface), `no-unsafe-*` on `any` from `response.json()`, and `unbound-method` on Jest mocks. Fixing them means rewriting working code or adding a Jest plugin, so I dropped the preset rather than disable rules one by one.
- **`checksVoidReturn.attributes` off in the frontend:** `onClick={() => refetch()}` in `TaskList` was the one real hit. TanStack Query's `refetch` resolves with the error instead of rejecting, so nothing is lost; this is the usual React setting.
- **Configs are `eslint.config.mjs` in both packages:** the backend is CommonJS and the frontend is ESM; `.mjs` keeps the two files the same style. JS and config files get no type-aware rules because they are outside the tsconfig.
- **The linter was checked by planting violations:** a floating promise, unused variable and explicit `any` in the backend; a floating promise and a conditional hook in the frontend. All were reported and the probe files deleted. Lint exits 0 on the real code and 1 on the probes.
- **`ecr:BatchGetImage` added to the push statement:** the first deploy pushed every layer and then failed with `403 Forbidden` on `HEAD .../manifests/sha256:...`. Docker checks the manifest before it finishes a push, and ECR treats that read as `BatchGetImage`. The minimal push list from the AWS docs (`BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`) was not enough for this runner's Docker. Still scoped to the one repository.

## Task 16: Frontend workflow

- **Two upload steps, assets first, `index.html` last:** `index.html` is the only file that names the hashed assets, so uploading it last means a visitor never gets a page that points at files not yet in the bucket. Everything except `index.html` is synced with `--delete` and `Cache-Control: public, max-age=31536000, immutable` (the names change when the content does). `index.html` is copied with `no-cache` so browsers revalidate it and pick up a new build at once.
- **`--delete` kept, so the `s3:DeleteObject` permission from Task 14 stays:** old hashed assets are removed on each deploy and the bucket does not grow. `--exclude index.html` also protects it from deletion during the first sync.
- **`--content-type "text/html"` on the `index.html` copy:** `aws s3 cp` guesses the type from the extension anyway; stated explicitly because S3 website hosting serves whatever type is stored.
- **`VITE_API_URL` comes from the `API_URL` repository variable, set only on the build step:** Vite inlines it at build time, so it is not needed at upload.
- **Same shape as the backend workflow:** one job, major-version action pins, region in `env`, Node from `.nvmrc`, own file in the path filter, `cancel-in-progress: false` (here to avoid two syncs interleaving and leaving a mix of two builds).
- **No frontend tests step:** the frontend has no test suite; the PDF's test and coverage requirements are for the backend. The gate is lint plus `tsc --noEmit` (inside `npm run build`).

## Task 18: README finish and clean-clone check

- **README AI-use section uses two entries from `docs/pushbacks.md` (tests reported complete after one mutation; confident wrong tsconfig diagnosis):** they are the clearest cases where the output was wrong and the owner caught it. The section is written in the owner's voice and is theirs to edit.
- **Scalability and observability sections describe this service, not generic advice:** the single-task limit comes from the in-memory store; observability lists what exists (JSON request lines to CloudWatch, ALB health check, rollout wait in CI) and what would be added. Nothing in those sections is claimed as built unless it is.
- **Clean-clone check ran from the public GitHub repo into the scratchpad, not from the working tree:** `npm install`, lint, test (56 pass, 89% coverage), build, `npm start` plus `curl /health` and `POST /tasks`, the frontend lint and build, `docker build` with `id` showing `node`, and `terraform validate` (`init -backend=false`, no AWS calls). The clone was made before the README edits, so it checks the commands, which did not change, not the new text.
- **Stale boxes ticked too:** B3, B5, E3, T2, F2-F5, F8, D1, D2, C2 and C3 were built and verified in earlier tasks. F9 (frontend tests, nice-to-have) stays unticked: not built.

## Task 19: CloudFront and private bucket

- **`CORS_ORIGIN` switched to the CloudFront URL in this task, not Task 20:** `ecs.tf` read the S3 website endpoint, which this task removes, so Terraform would not validate. Pointing it at CloudFront is the smallest fix. The cost is a new task definition and a rolling deploy at `apply`.
- **Managed cache and origin-request policies looked up by name (data sources):** no hardcoded policy ids. API behaviors use `Managed-CachingDisabled` and `Managed-AllViewerExceptHostHeader` (forwards `Origin` and `Content-Type`, not `Host`, which would not match the ALB's domain).
- **`PriceClass_100`:** Europe and North America edges only, the cheapest class; the users are in one region.
- **`viewer_protocol_policy = redirect-to-https` on all behaviors:** plain-HTTP requests to the CloudFront address are redirected, not served.
- **`s3_website_url` output removed:** the endpoint no longer exists. `cloudfront_url` and `cloudfront_distribution_id` replace it (the id is for Task 20).
- **README Live deployment section left for Task 20:** the CloudFront URL does not exist until the owner applies, and the spec puts the "old URLs no longer the entry point" note in Task 20.

## Task 20: Pipeline switch

- **`@fastify/cors` kept at first, then removed at the owner's request (see below):** `CORS_ORIGIN` already held the CloudFront URL from Task 19.
- **`VITE_API_URL` removed from the workflow instead of set to an empty string:** `api.ts` uses `?? ''`, so an unset variable gives same-origin paths, and there is no `.env` file that could set it. One line less, same result.
- **Invalidation of `/index.html` only, no wait:** hashed assets get new names on each build. `aws cloudfront wait` would need an extra `cloudfront:GetInvalidation` permission, and `index.html` is served with `no-cache` anyway.
- **Stale README text from Task 19 fixed here:** the "Frontend in its own public S3 bucket" design bullet and the `alb_url` output description still described the old setup.

## Task 20 follow-up: CORS plugin removed

- **Removed `@fastify/cors`, `cors.test.ts`, the `corsOrigin` option, and the `CORS_ORIGIN` env var in `server.ts` and `ecs.tf`:** the owner asked for it. The browser calls its own origin in dev (Vite proxy) and deployed (CloudFront), so the headers were never used. `AppOptions` keeps only `logger`.
- **Test-first rule not applicable:** the change deletes behavior and adds none, so there is no new failing test. The existing suite, run before and after, is the guard.
- **Left as they were, for the owner to decide:** `CLAUDE.md` (stack section) and `docs/decisions.md` still mention CORS; `docs/plan.md` and the Phase 1 task text are history and are not rewritten.

## Task 21: DynamoTaskStore

- **Contract factory may be async (`() => TaskStore | Promise<TaskStore>`):** each DynamoDB test needs a fresh table, and creating one is async. The in-memory test is unchanged.
- **Order test uses 10 tasks, and the timestamp helper pads the seconds:** a scan returns items in hash order, so with 3 tasks an unsorted store passes by chance one time in six. With 10 it almost never does. The old helper only worked up to 9.
- **`list()` is a paginated `Scan` plus a sort in code:** the table has only `id` as its key, so DynamoDB cannot order by `createdAt`. A global secondary index would need a constant partition key for no benefit at this size. The README already lists the unbounded list as a known limit.
- **Plain `<`/`>` comparison for the sort, not `localeCompare`:** ISO 8601 UTC strings sort by time as text, and collation rules could treat the punctuation differently.
- **Constructor is `(tableName, client)` with a `DynamoDBDocumentClient`:** no manual attribute marshalling, and tests pass a fake client for the pagination case.
- **Small unit test with a fake client (in `npm test`) for pagination and the table name:** a real scan only paginates above 1 MB, which is not worth building in DynamoDB Local. Everything else is tested against the real thing.
- **`create` is a plain `Put`, no condition:** the service generates random UUIDs, and the in-memory store does not reject duplicates either. Update and delete in Task 25 do need existence conditions.
- **Integration test: one table per test (`tasks-<uuid>`), deleted in `afterAll`:** tests cannot see each other's data. Dummy credentials and region `local`, because DynamoDB Local ignores them. The endpoint is `DYNAMODB_ENDPOINT`, default `http://localhost:8000`.
- **Separate `jest.integration.config.js`, standalone (no `require` of the base config):** importing the base config tripped two lint rules, and the integration run needs only three settings. `jest.config.js` ignores `*.integration.test.ts`, so `npm test` stays dependency-free.
- **`npm audit`:** 0 findings in production dependencies after adding the SDK. The 30 findings in the dev tree (Jest, typescript-eslint) are not new and I did not touch them.
- **No `waitUntilTableExists` in the integration test:** found when the test first ran against DynamoDB Local. The waiter's default poll delay is 20 s, so a 10 s maximum is rejected, and Local creates tables already active anyway. The table name is recorded for cleanup right after creation.

## Task 22: DynamoDB table, IAM and wiring

- **A new task role, separate from the execution role:** the execution role lets ECS pull the image and write logs, and the container never runs under it. App permissions go on a task role, so the app can read and write the table and nothing else.
- **Policy lists only `dynamodb:Scan` and `dynamodb:PutItem`, on the table ARN:** that is what `DynamoTaskStore` calls today. Task 25 adds `UpdateItem` and `DeleteItem` with the code that uses them.
- **`AWS_REGION` passed explicitly in the task definition:** the SDK needs a region to find DynamoDB. I did not rely on Fargate setting it, because an unset region fails at the first request, not at startup.
- **`storeFromEnv(env)` in its own file:** `server.ts` starts listening when imported, so it cannot be tested. The function takes `env` as an argument, so the test needs no environment changes. An empty `TABLE_NAME` counts as unset.
- **Checked the DynamoDB path locally before AWS:** the SDK reads `AWS_ENDPOINT_URL_DYNAMODB`, so the real server ran against DynamoDB Local with no code for it. A task created before a restart was still listed after it.
- **`desired_count` stays 1 and its comment is reworded:** more than one task is possible with DynamoDB, but scaling is not part of this task (see "Open questions").
- **README "Scalability" and the Phase 1 Assumptions text are only partly updated:** the Scalability section is rewritten in Task 29, as planned. Assumptions now says the deployed API uses DynamoDB.

## Task 22 follow-up: database design review (owner's questions)

- **Key stays `id` (partition key only, no sort key):** the operations are create, update and delete by id, which are point operations on the key, and a list. A unique random key spreads load evenly. The one weak operation is list, a full `Scan` sorted in code, which is harmless at this size. A global secondary index can be added to a live table later; the base key is the part that cannot change, so it should suit the writes.
- **`ConsistentRead: true` on the scan (found in the review):** a `Scan` is eventually consistent by default, and the UI lists right after a create, so the new task could be missing on real DynamoDB. DynamoDB Local is always consistent, so the integration test cannot show it. The unit test pins the setting on every page. It costs twice the read units.
- **Not a constant partition key, not a timestamp sort key:** a constant key would make list a `Query` but make update and delete by id awkward (the URL has no `createdAt`), and it is not a stepping stone to a per-user key. A `createdAt` sort key collides for two tasks in the same millisecond. If time is wanted in the key later, use a time-sortable id (UUIDv7 or ULID) as the sort key.
- **Multi-user, if it comes:** `userId` as the partition key and a time-sortable id as the sort key, with a table migration (scan plus put, a small script at this size) and a store, service and route change. Only the store knows DynamoDB, so the change stays in those layers. To be designed with the real access patterns when authentication is added, not built now.

## Task 23 planning: `done` and `priority` (owner's decisions)

- **`priority` is a numeric enum, `High = 0`, `Medium = 1`, `Low = 2`; `done` is a numeric enum too, `0` open and `1` done:** the owner's choice (the owner's words on `done` were short, so this is my reading: an enum like `priority`, not a bare number). Numbers sort high first without a mapping, and unlike a boolean they can be a DynamoDB index key.
- **`priority` is optional on create and defaults to Medium (the owner changed this from required):** the server fills it in, so a client that sends only `title` keeps working. A present but invalid value is still a `400`, including `null`.
- **`done` is not accepted on create (my call):** a new task is never done, so the service sets `0`, like `id` and `createdAt`. A `done` in the body is ignored, as other unknown fields are.
- **No frontend work in Task 23:** with the server default, the live form keeps working unchanged. The priority select on the create form moves into Task 27 with the list display and the done toggle. This also removes the deploy-order care the required `priority` had.
- **Plan renumbered:** new Task 23, the old 23-29 are now 24-30. Task 25 also carries the IAM change for `UpdateItem` and `DeleteItem`, which the policy comment already promised.
- **Partial `PATCH`:** a body with none of `title`, `done` and `priority` is a `400`, because there is nothing to update.

