# Working agreement

This is a hiring task. The goal is to show good engineering judgment, and the
owner must understand and be able to defend every line. The task description is
in the PDF in this folder.

## How to work

- Work in small steps. Finish one task, then STOP and wait for my "next".
- Before writing code for a task, say in 2-4 sentences what you will do and
  which files you will create or change.
- After each task: run the code or tests and show the result, then give a short
  walkthrough of each new or changed file (what it is, why it exists, how it
  connects to the rest).
- One task = one commit, with a clear message. Only commit when I say so.
- Write a failing test first for core logic, then the minimal code to pass it.

## Scope and simplicity

- Build only what the PDF requires. If you think something extra is valuable,
  propose it in one sentence and wait. Default answer is no.
- Prefer the simplest solution that works. No abstractions, layers, or config
  for hypothetical future needs.
- No new dependencies without asking. Say why it is needed and what the
  alternative is.
- Match the existing style. Keep files small and names clear. Comment only
  where the "why" is not obvious.

## Questions and decisions

- Ask at most 1-2 questions at a time, and always include your recommended
  default so I can just say "yes".
- Make small decisions yourself and append them to `docs/decisions.md`
  (one line: decision, reason). Ask me only for choices that are hard to
  reverse (stack, database, cloud provider, framework).
- If the PDF is ambiguous, list the ambiguity and your proposed interpretation
  instead of silently choosing.

## Documents

- `docs/requirements.md`: checklist derived from the PDF (must / nice-to-have /
  ambiguous). Source of truth for scope.
- `docs/tasks.md`: small tasks, each tied to a requirement, each with a clear
  "done" check.
- `docs/decisions.md`: running decision log.
- `README.md`: how to run, how to test, key decisions, trade-offs, what I would
  do with more time. Keep it updated as we go, not at the end.

## Order of work

1. Requirements checklist from the PDF (no code).
2. One-page plan: stack, folder layout, main components, and what we are
   explicitly NOT building.
3. Task list (8-15 small tasks).
4. Build task by task, local first.
5. CI and deployment only if the PDF requires them, as separate tasks, last.
6. Final check: clone into a clean folder and follow the README from scratch.
