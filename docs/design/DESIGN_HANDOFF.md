# Design handoff: task manager UI (layout D)

This folder describes the target UI for `apps/web`. It is a spec to implement,
not code to copy.

- `tokens.css`: design tokens as CSS variables. Import once globally.
- `reference/Alt.dc.html`: interactive prototype of the main screen, layout D
  (create with priority, status tabs, search, group-by-day switch, done
  toggle, inline edit, delete with undo). Open it for exact spacing and copy.
  Its inline styles are prototype markup only: translate them to CSS Modules,
  do not port them or its runtime.
- `reference/EditorialStates.dc.html`: board of the loading, API down, empty
  and toast states. It was drawn for the previous layout: take the content,
  copy and colours from it, and fit the visuals to layout D as described in
  "States" below.

## What changed since the previous handoff (layout C → D)

If you implemented the previous version, these are the changes:

1. **No big count heading.** The `h1` is now "Tasks" (36px). Counts moved
   into the status tabs.
2. **Status filter is tabs**, not a segmented control: Open / Done / All with
   count pills, underline on the active tab. **Default tab is Open** (was All).
3. **Priority on create is a native `<select>`**, not a segmented control.
   The segmented PrioritySelect and the PriorityChip are removed.
4. **Create form is a composer card**: big input on top, a footer row with
   the priority select and "Add task".
5. **Task rows are two-line inside one list card** (was one-line separate
   cards). Priority and time move to a small meta line under the title.
6. **Done tasks sort after open tasks** within each list (visible in All).
7. **New: "By day" switch** turns day grouping on and off.
8. **Search is smaller** and sits right of the tabs; "Clear filters" became
   "Clear search" (tabs are not reset).
9. **New state "All done"** when the Open tab is empty but tasks exist.

Unchanged: tokens' colour family and fonts, delete-with-undo behaviour,
validation rules, health badge, API implications (plus nothing new).

## Implementation constraints

- Styling: **CSS Modules** (`*.module.css`) plus the global `tokens.css`.
  No Tailwind, no CSS-in-JS, no UI component libraries, no icon packages
  (icons are small inline SVGs, see below).
- Module files use `var(--…)` tokens only. No raw hex values, font names
  or radii outside `tokens.css`.
- Keep the existing data layer: hooks and `api/client.ts` keep their
  contracts. New behaviour gets new hooks where needed.
- Keep the accessibility hooks the tests rely on: `role="status"` on the
  health badge, `role="alert"` on load errors, labelled inputs,
  `aria-invalid` and `aria-describedby` on the create form.
- Keep the visible copy that tests assert on (for example "API up",
  "API down", "Checking API…", "Title is required",
  "Title must be 200 characters or fewer",
  "No tasks yet — add your first one above."). Existing tests must pass
  without edits unless a test asserts on something this document removes
  (for example the old count heading or segmented controls); then update
  that test and say so in the commit message.
- Layout must work from 360px to desktop. Every interactive target is at
  least 44×44px.

## Page layout

Single centred column, `max-width: var(--content-max)`, page padding
`48px 20px 112px` (bottom padding leaves room for the toast). Sections are
stacked with `gap: var(--space-section)`, in this order:

1. **Header**: `h1` "Tasks" on the left, HealthBadge on the right. Wraps.
2. **Composer** (create form) and its error line.
3. **Toolbar**: status tabs on the left; search and the "By day" switch on
   the right. Wraps on narrow screens.
4. **Task list** (grouped or flat), or one of the empty cards.
5. **Toast** (fixed, bottom centre), only after a delete.

## Components

Suggested split; names are a recommendation.

### HealthBadge
White pill, 1px `--color-border`, `--radius-sm`, padding `6px 10px`,
mono 12px, an 8px dot before the text.

| State   | Dot                   | Text                    | Text colour             | Border                  |
|---------|-----------------------|-------------------------|-------------------------|-------------------------|
| pending | `--color-pending-dot` | Checking API…           | `--color-muted`         | `--color-border`        |
| up      | `--color-success-dot` | API up · uptime 1h 12m  | `--color-success`       | `--color-border`        |
| down    | `--color-danger-dot`  | API down                | `--color-danger-strong` | `--color-danger-border` |

Uptime comes from `GET /health` (`uptime` in seconds), formatted `Xh Ym`
(or `Ym` under an hour). Render it in its own span so "API up" stays a
findable text for tests.

### PriorityIcon
Inline SVG 12×12, three bars like a signal meter:
`<rect x="0" y="7" width="3" height="5" rx="1"/>`,
`<rect x="4.5" y="4" width="3" height="8" rx="1"/>`,
`<rect x="9" y="1" width="3" height="11" rx="1"/>`.
Low = 1 bar filled, Medium = 2, High = 3. Filled bars use the priority
colour (`--color-priority-*`), unfilled bars `--color-bar-off`. On a done
task all filled bars use `--color-muted`.

### PrioritySelect
A native `<select>` (options "Low", "Medium", "High"; values `low`,
`medium`, `high`) inside a `<label>` whose visible text is "Priority"
(mono 12px, uppercase, `--color-muted`, gap 10px).
- 44px high, `--radius-md`, white, 1px `--color-border`,
  `appearance: none`, padding `0 34px 0 32px`, mono 13px.
- Text colour is the selected priority's colour.
- PriorityIcon positioned inside on the left (12px in), reflecting the
  current value; a chevron-down icon inside on the right (12px in). Both
  `pointer-events: none`, `aria-hidden="true"`.
- Used in the composer and in edit mode.

### Composer (create form)
White card, 1px `--color-border`, `--radius-xl`, flex column.
- Input: `id` with a visually hidden `<label>` "New task" (`.sr-only`),
  placeholder "Add a task…", height `--control-composer`, no border,
  transparent, padding `0 18px`, `--text-composer`.
- Footer row: top border 1px `--color-divider`, padding `8px 8px 8px 18px`,
  space-between, wraps. Left: PrioritySelect (default **Medium**, resets to
  Medium after a successful create). Right: hint "Enter ↵" (mono 12px muted,
  `aria-hidden`) and the "Add task" submit button (44px, padding 0 20px,
  `--radius-md`, accent background, `--color-on-accent`, weight 600).
- Validation as today (trimmed, required, max 200). Error text below the
  card, 13px `--color-danger`, linked via `aria-describedby`.

### Toolbar
Flex row, space-between, `align-items: flex-end`, wraps (gap 12px 20px),
bottom border 1px `--color-border-list`.

**StatusTabs** (`<nav aria-label="Status">`, gap 20px): three
`<button type="button" aria-pressed>`: Open, Done, All, in that order.
- 44px high, padding 0 2px, transparent, `--text-control`; a 2px bottom
  border that overlaps the toolbar line (`margin-bottom: -1px`).
- Active: `--color-text`, weight 600, bottom border `--color-text`.
  Inactive: `--color-muted`, weight 400, transparent border.
- After the label, a count pill: mono 12px, weight 500, min-width 20px,
  padding `1px 6px`, radius 999px, `--color-subtle` background,
  `--color-text-count` text. Counts are totals per status, not affected by
  search.
- Default tab: **Open**.

**Search + switch** (`role="search"`, right side, gap 12px, padding-bottom 8px):
- Search input: type `search`, `aria-label="Filter tasks by title"`,
  placeholder "Search", width 220px (max 100%), height `--control-search`,
  `--radius-md`, search icon inside on the left (padding-left 34px),
  `--text-search`. Case-insensitive substring match on title, applied
  within the current tab.
- **By day switch**: `<button type="button" role="switch" aria-checked>`,
  44px high, mono 12px label "By day" after the track. Track 32×18px,
  radius 999px: on `--color-text`, off `--color-switch-off`. Knob 14px
  white circle, `--shadow-knob`, left 16px when on, 2px when off,
  `transition: left .15s`. Default **on**.

### Task list
- **Grouped (By day on):** one section per local calendar day of
  `createdAt`: "Today", "Yesterday", "Earlier", newest first; empty groups
  hidden. Each section: `h2` label (mono 12px uppercase muted, margin 0 4px)
  above its own list card. Sections stacked with `--space-group`.
- **Flat (By day off):** one list card, no headings, newest first.
- **List card:** `<ul>`, white rows separated by 1px `--color-divider`
  lines, outline 1px `--color-border-list`, `--radius-xl`,
  `overflow: hidden`.
- **Ordering inside a list:** open tasks first, then done tasks; each part
  newest first.

### TaskItem: view mode
Row: flex, `align-items: flex-start`, gap 4px, padding 6px. Left to right:
1. **Done checkbox**: native checkbox 20×20, `accent-color: var(--color-text)`,
   in a 44×44 `<label>`. `aria-label` "Mark as done: {title}" /
   "Mark as not done: {title}".
2. **Text block** (grows, `min-width: 0`, padding `9px 0 6px`):
   - Title: 16px, line-height 1.4, `overflow-wrap: anywhere`. Done:
     `--color-muted` + line-through.
   - Meta line (margin-top 4px, mono 12px, `--color-muted`, gap 8px):
     PriorityIcon + short label ("Low" / "Med" / "High") in the priority
     colour (muted when done), a "·" separator, then `<time dateTime>`.
     The icon carries `role="img"` and `aria-label="Medium priority"` (etc.);
     the short label and the separator are `aria-hidden="true"`.
   - Time: grouped view shows `HH:mm` for Today and Yesterday, a short date
     ("Oct 31") for Earlier. Flat view shows "Today, 09:30",
     "Yesterday, 18:05", or the short date.
3. **Edit** (pencil) and **Delete** (trash) icon buttons: 44×44,
   transparent, `--color-muted`, `--radius-md`, `aria-label`
   "Edit {title}" / "Delete {title}".

### TaskItem: edit mode
The row gets `box-shadow: var(--ring-editing)`; its content becomes a form
(padding `10px 10px 10px 14px`, column, gap 8px):
1. Title input, full width, 44px, `--radius-sm`, `aria-label="Edit task title"`,
   prefilled, focused on open.
2. Error line if invalid (13px `--color-danger`); input gets
   `aria-invalid="true"` and a `--color-danger-dot` border.
3. Footer row (space-between, wraps): PrioritySelect preset to the task's
   priority on the left; on the right the hint "Esc to cancel" (mono 12px
   muted, `aria-hidden`), "Cancel" (transparent, 1px `--color-border`) and
   "Save" (submit, `--color-text` background, white, weight 600). Both 44px,
   `--radius-sm`.
- Enter saves, Esc cancels; Save sends title and priority together.
  Only one row is in edit mode at a time.

### Delete with undo (Toast)
- Delete removes the task from the list immediately and shows a toast:
  dark pill fixed at bottom centre (24px from the bottom), `role="status"`,
  text "Task deleted", action button "Undo" (mono 13px,
  `--color-toast-action`, 44px high), `--shadow-toast`.
- **Decision: deferred delete.** The `DELETE` request is sent only when the
  toast expires (6s). Undo cancels the pending delete and restores the task
  in its original position; no request is ever sent for an undone delete.
  (Rejected alternative: delete immediately and re-create on Undo, which
  would give the task a new id and `createdAt`.) Document this in the README.
- Edge cases the implementation must handle:
  - **Refetch while a delete is pending.** A refetch of `GET /tasks`
    (window focus, invalidation after a create) still returns the task.
    Keep pending-delete ids in state and filter them out of the rendered
    list until the delete commits or is undone. Tab counts exclude them too.
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

## States

Dashed cards use 1px dashed `--color-border-dashed`, `--radius-xl`,
padding `40px 24px`, centred 16px text.

- **Loading:** one list card with three skeleton rows (each row: a 20px
  square where the checkbox goes, a title bar ~50% wide and a short meta bar
  under it, all `--color-skeleton`, radius 6px), `aria-busy="true"`. The
  badge shows "Checking API…". Tabs show no counts until data arrives.
- **API down / load error:** badge "API down"; in place of the list a
  `role="alert"` box (`--color-danger-bg`, 1px `--color-danger-border`,
  `--radius-xl`, `--color-danger-text`): bold "Couldn’t load tasks", the
  error message below, and a white "Retry" button (44px) on the right that
  refetches.
- **Empty** (zero tasks): dashed card, muted text
  "No tasks yet — add your first one above."
- **All done** (Open tab, no search, tasks exist but none open): dashed card,
  muted text "Nothing open. Everything is done."
- **No matches** (search hides everything in the current tab): dashed card,
  "No tasks match your filter." and a secondary "Clear search" button that
  clears the query only.
- **Mutation errors** (create, update, toggle, delete): show the server
  message next to the action that failed; for a failed toggle or delete,
  restore the previous state.

## Data and API implications

- Task shape: `done: boolean` (default `false`) and
  `priority: 'low' | 'medium' | 'high'` (default `'medium'`; any other value
  → 400 on create and update).
- `PATCH /tasks/:id` with `{ title?, done?, priority? }`: at least one field
  required (empty body → 400), same title rules, unknown id → 404, returns
  the updated task.
- `DELETE /tasks/:id`: 204, unknown id → 404.
- The frontend only knows `id`. If the store's primary key is not `id`
  alone, update and delete need a way to resolve it; decide this in the
  backend before building the endpoints.
- Search, status tabs, grouping and ordering are client-side.

## Suggested prompt for Claude Code

> The design changed. Read `docs/design/DESIGN_HANDOFF.md` from the start
> (it replaces the previous version; "What changed since the previous
> handoff" lists the differences) and implement layout D in `apps/web`
> using CSS Modules and `docs/design/tokens.css`. Use
> `docs/design/reference/` only as a visual reference: do not port its
> inline styles or runtime. Keep existing hooks, `api/client.ts`, ARIA roles
> and the visible copy that tests use. Remove components the document no
> longer uses (segmented priority control, priority chip, count heading)
> instead of leaving them unused. Add tests for: status tabs and counts,
> default Open tab and the All done state, search, the By day switch,
> ordering of done tasks, priority on create and edit, inline edit, the
> done toggle, and delete with undo including the edge cases. Don't add
> features beyond this document and don't add dependencies without asking.
> Start with a short plan: which components and CSS module files you will
> create, change or delete.
