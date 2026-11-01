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
