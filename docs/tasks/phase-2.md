# Tasks: Phase 2

Phase 2 is the owner's own extras on top of the finished PDF MVP (`docs/tasks/phase-1.md`, Tasks 1-18). Nothing here is graded by the PDF. Scope and reasons come from `docs/requirements.md` (Phase 2 section) and `docs/decisions.md`.

**Rules**

- **Same working agreement as Phase 1:** one task = one commit, made only when the owner says so; stop after each task and wait for "next"; core logic test-first; README updated in the task that changes behavior
- **Numbering continues from Phase 1** so commit messages stay unambiguous (`Task 19: ...`)
- **Order:** top to bottom; each task assumes the ones above it are done
- **Status:** `[ ]` todo · `[~]` in progress · `[x]` done
- **Apply by the owner:** every Terraform change is planned by the agent and applied by the owner, as in Phase 1
- **New dependencies:** none without asking. Known ones are listed under "Open questions"

## Global constraints

- **Stack:** unchanged from `CLAUDE.md`; no new dependency without approval
- **Goal of the phase:** HTTPS for users, data that survives a deploy, and a task list the user can edit and delete from; then the look of the UI
- **Task shape:** `{ id, title, createdAt }` stays as is; update changes `title` only
- **Errors:** every error response stays `{ "error": "<message>" }`
- **Do not break the live site:** each infrastructure task ends with the live URLs still working

## Tracker

| # | Task | Area | Status |
|---|------|------|--------|
| 19 | CloudFront: private bucket and distribution (Terraform) | Infra | [x] |
| 20 | CloudFront: switch the pipeline and live check | CI, frontend | [ ] |
| 21 | `DynamoTaskStore` and integration test | Backend | [ ] |
| 22 | DynamoDB table, IAM and wiring (Terraform) | Infra, backend | [ ] |
| 23 | Store `update` and `delete`: interface, in-memory, contract test | Backend | [ ] |
| 24 | `update` and `delete` in `DynamoTaskStore` | Backend | [ ] |
| 25 | Update and delete: service and routes | Backend | [ ] |
| 26 | Frontend: edit a task | Frontend | [ ] |
| 27 | Frontend: delete a task | Frontend | [ ] |
| 28 | Styling from the owner's mocks | Frontend | [ ] |
| 29 | README update and clean-clone re-check | Docs | [ ] |

## HTTPS (CloudFront)

The goal is HTTPS for the user without buying a domain: CloudFront's free `https://<id>.cloudfront.net` address has a valid certificate. The hop from CloudFront to the ALB stays plain HTTP inside AWS, which the owner has accepted.

### 19. CloudFront: private bucket and distribution (Terraform)

- **What:** `infra/cloudfront.tf`: a distribution with two origins, the S3 bucket (through Origin Access Control) and the ALB (HTTP). Default behavior serves the site; `/tasks*` and `/health` go to the ALB with caching off, all methods allowed, and the `Origin`/`Content-Type` headers forwarded as needed. The bucket becomes private (Block Public Access on, public-read policy replaced by an OAC policy, website hosting removed). Outputs: distribution URL, distribution id
- **Care:** the bucket moves from the S3 website endpoint to the REST endpoint, so `index.html` as the default root object must be set on the distribution; the site has no client-side router, so no 404 fallback is needed. Do not break the current site until Task 20 has switched the pipeline
- **README:** how the site is served and why the bucket is private
- **Done when:** `terraform validate` and `terraform plan` look right and the owner reviews the plan; **`apply` is run by the owner**; `curl -I https://<id>.cloudfront.net/health` returns `200` from the API and the root returns the site once a build is uploaded

### 20. CloudFront: switch the pipeline and live check

- **What:**
  - **CI permission:** add `cloudfront:CreateInvalidation` on the one distribution to the CI role (Terraform, applied by the owner)
  - **Frontend workflow:** after `aws s3 sync`, create an invalidation for `/index.html`; the build gets an empty `VITE_API_URL` so the app calls its own origin
  - **GitHub variables:** set the new distribution id; `API_URL` is no longer used by the frontend build
  - **API:** `CORS_ORIGIN` already points at the CloudFront URL (done in Task 19, because `ecs.tf` read the removed website endpoint). What is left is the decision to keep or remove the CORS plugin (see "Open questions")
- **Findings from Task 19 to act on:**
  - **Order matters:** (1) owner applies the CI role change (`cloudfront:CreateInvalidation`), (2) owner sets the `CLOUDFRONT_DISTRIBUTION_ID` variable, (3) only then push `frontend/`. Otherwise the workflow fails at the invalidation step
  - **Degraded gap:** from the Task 19 `apply` until this task's deploy, the live site shows the old build, which calls the ALB over plain HTTP from an HTTPS page. The browser blocks that (mixed content), so the task list does not load. This task closes the gap; do it right after Task 19
  - **Empty `VITE_API_URL`:** check that `frontend/src/api.ts` builds same-origin paths (`/tasks`, `/health`) when it is empty, and that the Vite dev proxy still works locally, before relying on it
  - **README, four places:** "Live deployment" (frontend and API URLs become the CloudFront address; `.../health` for the API; the ALB and S3 website URLs noted as no longer the entry point), the Infrastructure "Wiring" bullet (it says the build still takes the ALB URL as `VITE_API_URL`), the "GitHub variables" bullet (add the distribution id, drop `API_URL` from the frontend build), and the "plain HTTP" sentence under Live deployment
  - **Missing files:** with the private bucket and an OAC policy that grants only `s3:GetObject`, a missing key returns `403`, not `404`. Harmless here (no router); it matters only if a 404 page is added later
  - **Caching:** the default behavior uses the managed `CachingOptimized` policy (up to a day for anything without `Cache-Control`). Hashed assets get new names on each build, so only `/index.html` needs the invalidation
- **Done when:** a push touching `frontend/` runs green; the site opens over `https://` with no browser warning; badge is green; a task created in the UI is still there after a reload; the old S3 website URL and plain-HTTP ALB paths are noted in the README as no longer the entry point

## Persistence (DynamoDB)

### 21. `DynamoTaskStore` and integration test

- **What:** `dynamoTaskStore.ts` implementing `TaskStore` (`list`, `create`) on a DynamoDB table with `id` as the key; list returns oldest first by `createdAt`. The shared `describeTaskStore` contract test runs against it using DynamoDB Local, as a separate `npm run test:integration` script so `npm test` stays dependency-free
- **Interfaces:** consumes `TaskStore`; takes the table name and a client in its constructor (a class, per the working agreement)
- **Test first:** the contract test against the new store: empty list, create then list, order, no leaking of internal state
- **README:** how to run the integration test (DynamoDB Local through Docker)
- **Done when:** `npm test` is unchanged and green with coverage ≥ 80%; `npm run test:integration` passes against DynamoDB Local; lint is clean

### 22. DynamoDB table, IAM and wiring (Terraform)

- **What:** `infra/dynamodb.tf`: an on-demand table (`id` hash key); least-privilege permissions on the ECS task role (only the table, only the actions the store uses); the table name passed to the container as `TABLE_NAME`. `server.ts` uses `DynamoTaskStore` when `TABLE_NAME` is set and `InMemoryTaskStore` otherwise, so local development still needs nothing
- **README:** the store choice, local versus deployed, and that data now survives a deploy
- **Done when:** `plan` reviewed and applied by the owner; after the backend workflow deploys, a task created through the live site is still listed after a forced new deployment

## API: update and delete

### 23. Store `update` and `delete`: interface, in-memory, contract test

- **What:** extend `TaskStore` with `update(id, title)` and `delete(id)`; both return a signal for "not found" (for example `undefined` or `false`, decided in the task and logged). `InMemoryTaskStore` replaces the stored object instead of editing it. Contract test extended
- **Test first:** update changes the title and keeps `id` and `createdAt`; update and delete of an unknown id report not found; delete removes the task from `list()`; **a task object obtained earlier from `list()` stays unchanged after `update`** (this is the reason the store replaces, and the case the owner expects to be caught here)
- **Done when:** contract test passes against `InMemoryTaskStore`; `DynamoTaskStore` is temporarily failing or skipped in the integration script, and Task 24 fixes it

### 24. `update` and `delete` in `DynamoTaskStore`

- **What:** implement both methods on DynamoDB: update with a condition that the item exists (so an unknown id is "not found", not an upsert); delete likewise
- **Test first:** the same contract test, now run against DynamoDB Local
- **Done when:** `npm run test:integration` and `npm test` are green; lint is clean

### 25. Update and delete: service and routes

- **What:**
  - **Routes:** `PATCH /tasks/:id` with body `{ title }`, and `DELETE /tasks/:id`; JSON Schema checks the body type and the id parameter
  - **Service:** `TaskService.update(id, title)` reuses the existing title rule (trim, 1-200 characters); `delete(id)`
  - **Status codes:** `200` with the task on update; `204` on delete; `404` `{ error }` for an unknown id; `400` for an invalid title or body, as for `POST`
- **Test first:** service unit tests with a mocked store (trimming and rejections as for create, not-found handling); HTTP tests through `app.inject()` for each status and for odd bodies (`null`, array, empty, wrong content type)
- **README:** the two new endpoints with example `curl` calls
- **Done when:** all tests pass with coverage ≥ 80%; manual `curl` of both endpoints works locally; after the backend workflow runs, they work on the live API

## Frontend: update and delete

### 26. Frontend: edit a task

- **What:** `api.ts` gets `updateTask(id, title)`; each list row gets an edit action: the title becomes an input with save and cancel; the same client-side rule as the create form (not empty, not whitespace-only) blocks the request; save uses a mutation (disabled while pending, the list refreshes on success, an error alert on failure)
- **Done when:** invalid input sends no request; a double-click on save sends one request; an edited title shows after save and after a reload; stopping the API shows the alert

### 27. Frontend: delete a task

- **What:** `api.ts` gets `deleteTask(id)`; each row gets a delete action with a confirmation step (no browser `confirm()` dialog; an inline "Delete? Yes / No"); the list refreshes on success; an error alert on failure; deleting the last task shows the empty state
- **Done when:** a deleted task is gone after a reload; deleting the only task shows "no tasks yet"; a failed delete (API stopped) shows the alert and keeps the task listed

## Styling and wrap-up

### 28. Styling from the owner's mocks

- **What:** the owner brings mocks from Claude Design. Restyle the existing components in their `.module.css` files (no styling library): colors and spacing as CSS variables in one place, typography, button and input states (hover, focus, disabled), clearer loading, empty and error states, and the edit and delete controls from Tasks 26-27; works at about 375 px and at desktop width
- **Before starting:** the agent reads the mocks and lists, in a few lines, what will change and what will not; the owner confirms
- **Done when:** the screens match the mocks at both widths; keyboard focus is visible; no behavior changed (lint and build still pass)

### 29. README update and clean-clone re-check

- **What:** update the README for everything Phase 2 changed (HTTPS address, private bucket, DynamoDB, new endpoints, edit and delete in the UI, the scalability section, which can now say a second task is possible once the store is DynamoDB); then re-run the clean-clone check on the final commit, by a subagent with no context, following the README literally
- **Done when:** the README matches the live deployment; the clean-clone report passes every runnable step, with anything it could not run listed as not verified

## Open questions (to settle when the task comes up)

- **Task 21, new dependencies:** the AWS SDK for DynamoDB (`@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`) is needed for the store; the alternative is none (the REST API by hand), which is worse. DynamoDB Local runs as a Docker image, so it adds no npm dependency. Needs the owner's approval
- **Task 20, CORS:** after CloudFront the browser calls its own origin, so CORS is not needed. Keep `@fastify/cors` for local use and direct API calls, or remove the plugin and its tests?
- **Task 25, `PATCH` or `PUT`:** `PATCH` with only `title` fits a partial update; `PUT` would replace the whole task. Proposed: `PATCH`
- **Task 22, more than one task:** once the store is DynamoDB, `desired_count` could go above 1 and auto scaling could be added. Not in this phase unless the owner asks
- **Unknown paths and the 404 fallback (Task 19 / Task 20):** the distribution has no `custom_error_response`, so a missing file on the site (for example `/foo`) shows S3's raw error page. The bucket is private with an OAC policy that grants only `s3:GetObject`, so a missing key returns `403`, not `404`. No fallback is needed today: the site has one page and no client-side router, so every real URL is a real file or an API path. If a router is added, map both `403` and `404` to `/index.html` with status `200` in `cloudfront.tf`. Open choice if no router comes: leave S3's error page, or map `403`/`404` to a small custom `404.html` served with a `404` status. Proposed: leave as is
- **Optional hardening, not scheduled:** limit the ALB's security group to CloudFront's address range so the plain-HTTP ALB address stops answering directly
