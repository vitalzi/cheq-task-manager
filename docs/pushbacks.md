# Pushbacks

Every time the owner corrected the agent or scrutinized its output and asked for a change. Kept for the final walkthrough: what the agent did, what the owner challenged, what changed, and what the agent should do differently.

**Entry format:** a short title naming what was challenged (with the task number where one applies), then the four fields below. The date is in the session heading. Newest entries at the bottom of their session.

## Session: Tasks 2-8 (2026-11-01)

### 1. Agent decisions mixed into the approved decisions log

- **What the agent did:** while building Task 2, appended two small implementation decisions (TypeScript pin, Jest `cookie` transform) to `docs/decisions.md`
- **Pushback:** the owner wants decisions they approved beforehand kept apart from decisions the agent makes while implementing
- **Outcome:**
  - Entries moved to a new `docs/agent-decisions.md`
  - `docs/decisions.md` restored to its committed state
  - `CLAUDE.md` updated: agent decisions go to `agent-decisions.md`, and `decisions.md` is never edited without approval
- **Lesson:** the agent followed the old CLAUDE.md line literally. A log that mixes approved and unapproved decisions is useless for defending them later.

### 2. Test tooling questioned after two workarounds

- **What the agent did:** worked around two problems (TypeScript 7 incompatibility, ESM-only `cookie` in Jest) without questioning the tooling
- **Pushback:** the owner asked whether two workarounds mean the tool is a bad fit and a change is due
- **Outcome:**
  - The agent checked the PDF: Jest is a stated requirement (Step 1, Testing row, final checklist), so Vitest is out
  - Only the TypeScript pin is ts-jest's fault; the `cookie` problem is Jest's CommonJS runtime and would hit any transformer
  - Kept Jest + ts-jest; the workarounds total about three lines of config
- **Lesson:** when the owner asks "is this the right tool", check the requirement source first and separate which workaround belongs to which tool, before comparing alternatives.

### 3. Node version presented as a decision without a reason

- **What the agent did:** wrote "Requires Node 22+" in the README, copied from the owner's local default, as if it were a decision
- **Pushback:** the owner asked whether there was a reason
- **Outcome:**
  - There was none; the agent said so plainly
  - Switched to Node 24 (active LTS): `.nvmrc`, `engines` in `package.json`, README line
  - The agent hoped Node 24 would remove the `cookie` workaround; tested it, and it did not (the test only passed with an experimental flag that prints a warning every run), so the workaround stayed
  - The owner asked that the Node choice not be logged as a decision: treat it as if 24 was chosen from the start
- **Lesson:** a version number in a doc is a decision. Do not present a default as a choice, and test a hoped-for simplification before promising it.

### 4. Store tests reported complete without a full mutation check (Task 3)

- **What the agent did:** reported the store tests complete after breaking the code only once (the array-copy test)
- **Pushback:** the owner doubted the test set was sufficient
- **Outcome:**
  - The agent admitted it had verified only one of four tests, then broke the store four more ways; all were caught
- **Lesson:** "tests pass" is not "tests are good". Run a mutation check on every test before claiming coverage.

### 5. Service written as a factory function instead of a class (Task 4)

- **What the agent did:** wrote the service as a factory function (`createTaskService(store)`), following the task list's interface line
- **Pushback:** the owner finds classes more readable and prefers them wherever they fit
- **Outcome:**
  - Service rewritten as `class TaskService` with the store in the constructor; tests changed first, then code
  - `docs/tasks/phase-1.md` (Tasks 4 and 5) updated to the class
  - New rule in `CLAUDE.md`: prefer classes, except stateless helpers and framework-shaped functions such as `buildApp` and React components
- **Lesson:** the agent followed the plan without flagging that "factory vs class" was an open style choice. Surface style choices that the plan fixes by accident.

### 6. Editor type errors returned after an unverified config simplification (Task 5)

- **What the agent did:** told the owner the test files were red in VS Code because `tsconfig.json` excluded them, as a fact and not a guess. When that did not fix it, it found the real cause (VS Code bundles TypeScript 6, which no longer loads `@types/*` automatically; fixed with `"types": ["node", "jest"]`). It then tried to simplify by deleting the second tsconfig and putting the `exclude` back, and trusted an empty result from the VS Code diagnostics tool as proof it worked
- **Pushback:** the owner said the red underlines were back
- **Outcome:**
  - Reverted to the setup that worked: tests in `tsconfig.json`, `tsconfig.build.json` excludes them for `npm run build`
  - Learned that the diagnostics tool can return an empty list for a file it has not re-checked
  - `docs/agent-decisions.md` records the failed simplification
- **Lesson:** call a diagnosis a hypothesis until it is confirmed. Do not undo a working setup on evidence from a tool that cannot see what the owner sees; ask the owner to confirm in their editor first.

### 7. Logging test that asserted nothing about logging (Task 6)

- **What the agent did:** wrote a test named "logs nothing when no logger is configured" that only checked for a `200`, so it proved nothing about logging. It also ran no mutation check on the logging tests until the owner asked how they were verified
- **Pushback:** the owner asked how the tests are verified and agreed the weak one should go
- **Outcome:**
  - The agent broke the code four ways: the four real assertions caught all four
  - The weak test was deleted
- **Lesson:** this repeats lesson 4. Before writing a test, name the production change that would make it fail; if there is none, do not write it. Run the mutation check before reporting, not when asked.

### 8. Browser tool called without explanation (Task 8)

- **What the agent did:** to finish the "badge turns red" check it loaded the Chrome tools and called one without saying why, so the owner saw an unexplained permission prompt
- **Pushback:** the owner rejected the call and asked what it was
- **Outcome:** the agent explained (it needed a browser to see the badge), listed what was already verified, and the owner then allowed it. Badge seen green with the API up and red ("API: down") after the API was stopped
- **Lesson:** say in one sentence why a tool is needed before the call, especially for tools the owner has not seen used yet (browser, network, anything outside the repo).

## Session: Tasks 14-15 (2026-11-01)

### 9. Deployment stability check missing from the CI plan (Task 14)

- **What the agent did:** left `ecs:DescribeServices` out of the CI role because the task list only mentioned `update-service`, and wrote the gap down as a "Task 15 may need this" note
- **Pushback:** the owner said waiting for the service to become stable is common practice and Task 15 should do it
- **Outcome:**
  - `ecs:DescribeServices` added to the role before the Task 14 apply, so no second apply is needed
  - Task 15 in `docs/tasks/phase-1.md` now includes `aws ecs wait services-stable`, and its "done when" requires a healthy rollout
  - Without the wait, a pipeline goes green while a broken image is still failing health checks
- **Lesson:** the agent followed the task list literally and deferred a known gap instead of asking. When the plan leaves out a standard step, such as verifying a deploy, propose it in one sentence at the time.

### 10. No linter in the project (Task 15)

- **What the agent did:** built nine tasks of backend, frontend, Dockerfile, Terraform and the CI workflow without adding or proposing a linter, because the PDF does not list one and the working agreement says build only what it requires
- **Pushback:** the owner pointed out there was no linter and asked for one, inside the current task, with nothing committed or pushed until it was tested
- **Outcome:**
  - ESLint with `typescript-eslint` added to both packages, run in the backend workflow before the tests
  - The first config (full type-checked preset) produced 37 errors on working code; it was narrowed to the standard rules plus three async rules
  - The linter was proved by planting violations, not just by seeing a clean run
- **Lesson:** "only what the PDF requires" does not cover basic engineering hygiene a senior reviewer expects. Propose the one-sentence addition early, as the agreement says, instead of waiting to be asked. Also: a clean run proves nothing about a linter; plant a violation.

### 11. Database key chosen without a design pass (Task 21-22)

- **What the agent did:** implemented `DynamoTaskStore` and the table with `id` as the only key, because the task text said so, and never wrote down the access patterns, the key's trade-offs or the consistency model. The Scan used the default eventually consistent read.
- **Pushback:** the owner said the database design phase had been skipped and asked whether a separate partition per task was a good call, then asked about a constant key, a per-user key, and a timestamp sort key.
- **Outcome:**
  - The key stays `id`, now with the reasons recorded in `docs/agent-decisions.md`: point operations on the key, even load, and a list that can get a secondary index later
  - The review found a real bug: the scan could miss a task created a moment earlier on real DynamoDB. DynamoDB Local cannot show it. Fixed with `ConsistentRead: true`, test first
  - The owner's new fields (`done`, `priority`) were designed in at the same time, as a new Task 23, before any data exists
- **Lesson:** a key choice cannot be changed later, so write the access patterns and the trade-offs down before building the store, even when the task text already names the key. A local emulator behaves differently from the real service (consistency here), so list the differences instead of trusting a green integration test.


### 12. Validation structure in Task 23 (three attempts)

- **What the agent did:** put the title and priority rules inside `TaskService.create`, then, when asked to separate them, moved them into a `TaskValidator` class that also trimmed and cast the value, and then proposed (and built, after the owner chose it) a `preValidation` hook to trim, because a JSON Schema cannot clean a value. Along the way the agent called the Zod question a dependency matter and defended the split of loose schema plus strict service.
- **Pushback:** the owner said the service held validation that should be separate; that a "validator" which trims and casts is not a validator; that Fastify's built-in validation should be used where it gives simple options; and that the hook looked ugly and would need copying into `PATCH`. The owner pointed to `ajv-keywords` as the declarative option.
- **Outcome:** the rules are in the route's JSON Schema in one place, the trim is the `transform` keyword (`ajv-keywords`, approved), the service takes typed input, and `TaskValidator` and `ValidationError` are gone. The hook was built and removed within the same task.
- **Lesson:** when the framework has a declarative mechanism, show that option first, with its real cost, instead of leading with a hand-rolled layer. Judge a design by what the next task will have to copy (the hook would have been duplicated in `PATCH`), and name classes for what they do (a class that normalises input is a parser, not a validator).

### 13. Frontend tests skipped, then added; Task 27 redone test first (Task 27)

- **What the agent did:** built Task 27 (priority, edit, done toggle) and checked it only by hand in a browser, citing the Phase 1 decision that frontend tests were skipped, and flagged "no red/green" as a conflict instead of proposing tests as the way to meet the agreement.
- **Pushback:** the owner asked for frontend tests, approved all the dependencies, and asked to redo the task with TDD properly.
- **Outcome:** the implementation was deleted, Vitest and Testing Library were added, 24 tests were written and watched fail (18 red for the right reasons), then the components were rebuilt from them. Five mutation checks showed two guards were dead code (a disabled submit button already blocks Enter), so they were removed. CI now runs the tests before deploying the frontend.
- **Lesson:** when a rule the owner set ("test first for application code") collides with an earlier "skip it" decision, the later and stricter rule wins; raise the missing tooling as a proposal up front instead of working around it. And a passing test proves little until a mutation shows it can fail.

### 14. A hand-rolled fake API for the frontend tests (Task 27)

- **What the agent did:** wrote `FakeApi`, an in-memory class that stubbed `fetch` and reimplemented part of the API's contract, without saying that the common practice is to mock the network with MSW.
- **Pushback:** the owner asked whether a whole fake API was needed, whether it is common practice, and whether there is a better approach.
- **Outcome:** switched to MSW (the owner chose it over keeping the class or slimming it). The handlers and state stay in `FakeApi`, the interception is MSW's, and the 24 tests did not change. Along the way `tsc` showed that MSW 3 renamed the unhandled-request option, so the first setting was silently ignored; fixed and proven with a wrong-URL mutation.
- **Lesson:** when building test infrastructure by hand, say what the standard tool is and why you did not use it before writing it. A renamed option can fail silently: run the type-checker over the test setup, and check that a "fail on unexpected request" setting really fails.

### 15. An undo-toast delete queue nobody needed (Task 29b)

- **What the agent did:** the new design handoff described delete with an undo toast. The owner asked for it on top of the existing Yes/No step. The agent built it in full: a `DeleteQueue` class with timers, a provider, a toast, filtering of pending ids in `useTasks`, a `pagehide` send with `keepalive`, 15 queue tests and more component tests, and README text. About a dozen files, and it changed how every list reads its data.
- **Pushback:** the owner said the delete queue adds too much complexity and asked to remove it and keep only the Yes/No confirmation.
- **Outcome:** removed it all (queue, provider, toast, the hidden-ids filter, the `keepalive` helper, their tests and docs) and restored the Task 28 row-level delete. The delete tests were rewritten first and failed against the queue code, then passed once it was gone. A mutation check showed that nothing asserted the row returning to the Delete button after a failure; that assertion was added.
- **Lesson:** when a handoff adds a feature that overlaps one just approved (here, a confirmation and an undo for the same delete), say what the extra step costs before building it, and offer the small version first. A feature with five listed edge cases is a signal that it is large, not just that it is specified.
