# Design handoff: task manager UI (direction C, "editorial light")

This folder describes the target UI for `apps/web`. It is a spec to implement,
not code to copy.

- `tokens.css`: design tokens as CSS variables. Import once globally.
- `reference/Editorial.dc.html`: interactive prototype of the main screen
  (create, edit, delete with undo, done toggle, filter). Open it for exact
  spacing and copy. Its inline styles are prototype markup only: translate
  them to CSS Modules, do not port them.
- `reference/EditorialStates.dc.html`: static board of the remaining states
  (loading, API down, editing with an error, no matches, deleted toast, empty).

## Implementation constraints

- Styling: **CSS Modules** (`*.module.css`) plus the global `tokens.css`.
  No Tailwind, no CSS-in-JS, no UI component libraries, no icon packages
  (icons are small inline SVGs, see below).
- Module files use `var(--…)` tokens only. No raw hex values, font names
  or radii outside `tokens.css`.
- Keep the existing data layer: hooks and `api/client.ts` keep their
  contracts. New behaviour gets new hooks (`useUpdateTask`, `useDeleteTask`).
- Keep the accessibility hooks the tests rely on: `role="status"` on the
  health badge, `role="alert"` on load errors, labelled inputs,
  `aria-invalid` and `aria-describedby` on the create form.
- Keep the existing visible copy that tests assert on (for example
  "API up", "API down", "Checking API…", "Title is required",
  "Title must be 200 characters or fewer",
  "No tasks yet — add your first one above."). Existing tests must pass
  without edits; add tests for new behaviour.
- Layout must work from 360px to desktop. Every interactive target is at
  least 44×44px.

## Page layout

Single centred column, `max-width: var(--content-max)`, page padding
`48px 20px 112px` (bottom padding leaves room for the toast). Sections are
stacked with `gap: var(--space-section)`, in this order:

1. **Header row**: left, mono uppercase label "Task manager"
   (`--text-label`, `--color-muted`); right, the health badge. Wraps on
   narrow screens.
2. **Count heading** (`h1`, `--text-display`, weight 600).
3. **Create form.**
4. **Filter bar.**
5. **Task groups**, or the empty / no-match card.
6. **Toast** (fixed, bottom centre), only after a delete.

## Components

Suggested split; names are a recommendation.

### HealthBadge
White pill with a 1px `--color-border`, `--radius-sm`, padding `6px 10px`,
mono 12px, an 8px dot before the text.

| State   | Dot                   | Text                         | Text colour             | Border                 |
|---------|-----------------------|------------------------------|-------------------------|------------------------|
| pending | `--color-pending-dot` | Checking API…                | `--color-muted`         | `--color-border`       |
| up      | `--color-success-dot` | API up · uptime 1h 12m       | `--color-success`       | `--color-border`       |
| down    | `--color-danger-dot`  | API down                     | `--color-danger-strong` | `--color-danger-border`|

Uptime comes from `GET /health` (`uptime` in seconds), formatted as
`Xh Ym` (or `Ym` under an hour). If showing uptime breaks an existing test
that expects exactly "API up", render the uptime in a separate span so
the text "API up" is still found.

### CountHeading
- No tasks: "No tasks yet"
- Filter active (query or status not "All"): "2 of 5 tasks"
- Otherwise by open count: "All done", "1 open task", "3 open tasks"

### CreateTaskForm
- Visible label "New task" (mono uppercase label style).
- Input: height `--control-lg`, `--radius-lg`, white, `--color-border`,
  placeholder "Type a task and press Enter".
- Submit button "Add": accent background, `--color-on-accent` text,
  weight 600, same height.
- Row wraps on narrow screens (input `flex: 1 1 300px`).
- Client validation exactly as today (trimmed, required, max 200);
  error shown below in `--color-danger`, 13px.

### FilterBar (`role="search"`)
- Search input (type `search`, `aria-label="Filter tasks by title"`,
  placeholder "Filter by title"), height 44px, `--radius-md`, search icon
  inside on the left (padding-left 40px). Case-insensitive substring
  match on title.
- Segmented control (`role="group"`, `aria-label="Status"`):
  All / Open / Done. Track `--color-subtle`, padding 4px, gap 4px,
  `--radius-md`. Buttons 36px high, mono 13px, `aria-pressed`.
  Pressed: white background, `--color-text`, `--shadow-pressed`.
  Unpressed: transparent, `--color-muted`.
- Filtering is client-side; no API change.

### TaskGroup
Tasks are grouped by local calendar day of `createdAt`, newest first:
"Today", "Yesterday", "Earlier". Group heading is an `h2` in the mono
uppercase label style. Empty groups are not rendered.

### TaskItem: view mode
Row: white, 1px `--color-border-row`, `--radius-lg`, padding 6px, flex row,
gap 4px, items centred. Left to right:
1. **Done checkbox**: native `<input type="checkbox">` 20×20 with
   `accent-color: var(--color-text)`, wrapped in a 44×44 `<label>`.
   `aria-label` "Mark as done: {title}" / "Mark as not done: {title}".
2. **Title**: 16px, grows, wraps long words (`overflow-wrap: anywhere`).
   Done: `--color-muted` + `text-decoration: line-through`.
3. **Time**: `<time dateTime>`, mono 13px muted. Today and Yesterday show
   `HH:mm`; Earlier shows a short date ("Oct 31").
4. **Edit** icon button (pencil) and **Delete** icon button (trash):
   44×44, transparent, `--color-muted`, `--radius-md`,
   `aria-label` "Edit {title}" / "Delete {title}".

### TaskItem: edit mode
The row border turns `--color-text`; its content becomes a form:
- Input (`aria-label="Edit task title"`), prefilled with the title,
  focused on open, 44px, `--radius-sm`.
- "Save" (submit): `--color-text` background, white text.
- "Cancel": transparent, 1px `--color-border`.
- Hint line, mono 12px muted: "Enter to save · Esc to cancel".
- Same validation as create; error under the input, input gets
  `aria-invalid="true"` and a `--color-danger-dot` border.
- Enter saves, Esc cancels. Only one row is in edit mode at a time.

### Delete with undo (Toast)
- Delete removes the task from the list immediately (optimistic) and shows
  a toast: dark pill fixed at bottom centre (24px from the bottom),
  `role="status"`, text "Task deleted", action button "Undo"
  (mono 13px, `--color-toast-action`, 44px high).
- **Decision: deferred delete.** The `DELETE` request is sent only when the
  toast expires (6s). Undo cancels the pending delete and restores the task
  in its original position; no request is ever sent for an undone delete.
  (Rejected alternative: delete immediately and re-create on Undo, which
  would give the task a new id and `createdAt`.) Document this in the README.
- Edge cases the implementation must handle:
  - **Refetch while a delete is pending.** A refetch of `GET /tasks`
    (window focus, invalidation after a create) still returns the task.
    Keep pending-delete ids in state and filter them out of the rendered
    list until the delete commits or is undone.
  - **A second delete while one is pending.** Commit the first immediately
    (send its `DELETE`), then start a new 6s window for the second. Only one
    toast is shown at a time.
  - **The tab closes or reloads during the window.** On `pagehide`, send
    any pending delete with `fetch(url, { method: 'DELETE', keepalive: true })`.
    If that fails, the task reappears on next load, which is acceptable;
    note it in the README.
  - **The `DELETE` fails after the toast is gone.** Restore the task and
    show an error ("Couldn’t delete the task") in a `role="alert"` message.
  - **Timers are cleaned up** on unmount; tests use fake timers
    (`vi.useFakeTimers()`) to cover expire, undo and the second-delete case.
- No confirmation dialog.

### Empty, no-match and error states
- **Empty** (zero tasks, no filter): dashed card (`--color-border-dashed`),
  centred muted text "No tasks yet — add your first one above."
- **No matches** (filter hides everything): dashed card, "No tasks match
  your filter." and a secondary button "Clear filters" that resets the
  query and status.
- **Load error**: `role="alert"` box (`--color-danger-bg`,
  `--color-danger-border`, `--color-danger-text`), bold line
  "Couldn’t load tasks", the error message below, and a white "Retry"
  button on the right that refetches.
- **Loading**: three skeleton rows (white rows with `--color-skeleton`
  bars), `aria-busy="true"`.
- **Mutation errors** (create, update, delete): show the server message
  next to the action that failed; for a failed delete, restore the task.

## Data and API implications

- Task shape gains `done: boolean` (default `false`).
- `PATCH /tasks/:id` with `{ title?, done? }`: at least one field required
  (empty body → 400), same title rules, unknown id → 404, returns the
  updated task.
- `DELETE /tasks/:id`: 204, unknown id → 404.
- The frontend only knows `id`. If the store's primary key is not `id`
  alone, update and delete need a way to resolve it; decide this in the
  backend before building the endpoints.
- Filtering (search and status) stays on the client.

## Suggested prompt for Claude Code

> Implement the UI described in `docs/design/DESIGN_HANDOFF.md` in
> `apps/web`, using CSS Modules and `docs/design/tokens.css`. Use the files in
> `docs/design/reference/` only as a visual reference: do not port their
> inline styles or runtime. Keep existing hooks, `api/client.ts`, ARIA roles
> and the visible copy that tests use; all existing tests must pass without
> editing them. Add tests for edit, delete with undo, the done toggle and
> filtering. Don't add features beyond this document, and don't add
> dependencies without asking. Start with a short plan listing the
> components and CSS module files you will create.
