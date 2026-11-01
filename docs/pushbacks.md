# Pushbacks

Every time the owner corrected the agent or scrutinized its output and asked for a change. Kept for the final walkthrough: what the agent did, what the owner challenged, what changed, and what the agent should do differently.

**Entry format:** date, session and task, then the four fields below. Newest entries at the bottom of their session.

## Session: Tasks 2-4 (2026-11-01)

### 1. Agent's decisions mixed into the approved decisions log

- **What the agent did:** while building Task 2, appended two small implementation decisions (TypeScript pin, Jest `cookie` transform) to `docs/decisions.md`
- **Pushback:** the owner wants decisions they approved beforehand kept apart from decisions the agent makes while implementing
- **Outcome:**
  - Entries moved to a new `docs/agent-decisions.md`
  - `docs/decisions.md` restored to its committed state
  - `CLAUDE.md` updated: agent decisions go to `agent-decisions.md`, and `decisions.md` is never edited without approval
- **Lesson:** the agent followed the old CLAUDE.md line literally. A log that mixes approved and unapproved decisions is useless for defending them later.

### 2. "Is Jest with ts-jest really the best way?"

- **What the agent did:** worked around two problems (TypeScript 7 incompatibility, ESM-only `cookie` in Jest) without questioning the tooling
- **Pushback:** the owner asked whether two workarounds mean the tool is a bad fit and a change is due
- **Outcome:**
  - The agent checked the PDF: Jest is a stated requirement (Step 1, Testing row, final checklist), so Vitest is out
  - Only the TypeScript pin is ts-jest's fault; the `cookie` problem is Jest's CommonJS runtime and would hit any transformer
  - Kept Jest + ts-jest; the workarounds total about three lines of config
- **Lesson:** when the owner asks "is this the right tool", check the requirement source first and separate which workaround belongs to which tool, before comparing alternatives.

### 3. "Why Node 22 and not 24?"

- **What the agent did:** wrote "Requires Node 22+" in the README, copied from the owner's local default, as if it were a decision
- **Pushback:** the owner asked whether there was a reason
- **Outcome:**
  - There was none; the agent said so plainly
  - Switched to Node 24 (active LTS): `.nvmrc`, `engines` in `package.json`, README line
  - The agent hoped Node 24 would remove the `cookie` workaround; tested it, and it did not (the test only passed with an experimental flag that prints a warning every run), so the workaround stayed
  - The owner asked that the Node choice not be logged as a decision: treat it as if 24 was chosen from the start
- **Lesson:** a version number in a doc is a decision. Do not present a default as a choice, and test a hoped-for simplification before promising it.

### 4. "Are you sure these are all the tests needed?" (Task 3)

- **What the agent did:** reported the store tests complete after breaking the code only once (the array-copy test)
- **Pushback:** the owner doubted the test set was sufficient
- **Outcome:**
  - The agent admitted it had verified only one of four tests, then broke the store four more ways; all were caught
  - It also found a real gap: tasks are stored by reference, so mutating a listed task changes the store
  - The owner chose to leave the gap as is; it goes in the README trade-offs
- **Lesson:** "tests pass" is not "tests are good". Run a mutation check on every test before claiming coverage, and name known limitations.

### 5. "createTaskService? This looks so strange. Why not classes?" (Task 4)

- **What the agent did:** wrote the service as a factory function (`createTaskService(store)`), following the task list's interface line
- **Pushback:** the owner finds classes more readable and prefers them wherever they fit
- **Outcome:**
  - Service rewritten as `class TaskService` with the store in the constructor; tests changed first, then code
  - `docs/tasks.md` (Tasks 4 and 5) updated to the class
  - New rule in `CLAUDE.md`: prefer classes, except stateless helpers and framework-shaped functions such as `buildApp` and React components
- **Lesson:** the agent followed the plan without flagging that "factory vs class" was an open style choice. Surface style choices that the plan fixes by accident.

### 6. "The red underlines are back" (Task 5, editor setup)

- **What the agent did:** told the owner the test files were red in VS Code because `tsconfig.json` excluded them, as a fact and not a guess. When that did not fix it, it found the real cause (VS Code bundles TypeScript 6, which no longer loads `@types/*` automatically; fixed with `"types": ["node", "jest"]`). It then tried to simplify by deleting the second tsconfig and putting the `exclude` back, and trusted an empty result from the VS Code diagnostics tool as proof it worked
- **Pushback:** the owner said the red underlines were back
- **Outcome:**
  - Reverted to the setup that worked: tests in `tsconfig.json`, `tsconfig.build.json` excludes them for `npm run build`
  - Learned that the diagnostics tool can return an empty list for a file it has not re-checked
  - `docs/agent-decisions.md` records the failed simplification
- **Lesson:** call a diagnosis a hypothesis until it is confirmed. Do not undo a working setup on evidence from a tool that cannot see what the owner sees; ask the owner to confirm in their editor first.

### 7. "Remove the unnecessary test" (Task 6)

- **What the agent did:** wrote a test named "logs nothing when no logger is configured" that only checked for a `200`, so it proved nothing about logging. It also ran no mutation check on the logging tests until the owner asked how they were verified
- **Pushback:** the owner asked how the tests are verified and agreed the weak one should go
- **Outcome:**
  - The agent broke the code four ways: the four real assertions caught all four
  - The weak test was deleted
- **Lesson:** this repeats lesson 4. Before writing a test, name the production change that would make it fail; if there is none, do not write it. Run the mutation check before reporting, not when asked.

### 8. "What is this?" (Task 8)

- **What the agent did:** to finish the "badge turns red" check it loaded the Chrome tools and called one without saying why, so the owner saw an unexplained permission prompt
- **Pushback:** the owner rejected the call and asked what it was
- **Outcome:** the agent explained (it needed a browser to see the badge), listed what was already verified, and the owner then allowed it. Badge seen green with the API up and red ("API: down") after the API was stopped
- **Lesson:** say in one sentence why a tool is needed before the call, especially for tools the owner has not seen used yet (browser, network, anything outside the repo).

## Session: Task 14 (2026-11-01)

### 9. "Task 15 should wait for the service to be stable"

- **What the agent did:** left `ecs:DescribeServices` out of the CI role because the task list only mentioned `update-service`, and wrote the gap down as a "Task 15 may need this" note
- **Pushback:** the owner said waiting for the service to become stable is common practice and Task 15 should do it
- **Outcome:**
  - `ecs:DescribeServices` added to the role before the Task 14 apply, so no second apply is needed
  - Task 15 in `docs/tasks.md` now includes `aws ecs wait services-stable`, and its "done when" requires a healthy rollout
  - Without the wait, a pipeline goes green while a broken image is still failing health checks
- **Lesson:** the agent followed the task list literally and deferred a known gap instead of asking. When the plan leaves out a standard step, such as verifying a deploy, propose it in one sentence at the time.
