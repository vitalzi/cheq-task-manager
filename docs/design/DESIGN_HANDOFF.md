# Design handoff: task manager UI (layout D, v2)

This folder describes the target UI for `apps/web`. It is a spec to implement,
not code to copy.

- `tokens.css`: design tokens as CSS variables. Import once globally.
- `reference/Alt.dc.html`: interactive prototype of the main screen
  (create with priority, status and priority filters, search, group-by-day
  switch, done toggle, inline edit, delete with inline confirmation). Open it
  for exact spacing and copy. Its inline styles are prototype markup only:
  translate them to CSS Modules, do not port them or its runtime.
- `reference/States.dc.html`: static board of every state for this layout:
  toolbar default and with active filters, both filter dropdowns open,
  delete confirmation (default with focus on Cancel, request in flight,
  failed), edit and create validation, loading, API down, empty, all done,
  no matches. The open dropdowns show content, order and styling intent
  only: the filters are native `<select>` elements, so the open menu is
  drawn by the browser or OS. Do not build a custom listbox.

## What changed since the previous handoff

**Since layout D v1** (status tabs, delete with undo toast):
1. **Status tabs are replaced by a Status dropdown** (Open / Done / All with
   counts in the option text). Default is still Open.
2. **New Priority filter dropdown** (Any / High / Medium / Low).
3. **Delete uses an inline confirmation in the row** (Cancel / Delete).
   The undo toast, the deferred delete, the 6s timer, pending-delete
   filtering and the `pagehide` flush are all **removed**.
4. "Clear search" became **"Clear filters"** (clears search and priority).
5. The toolbar has no bottom border any more; search is 44px high.

**Since layout C** (if you never built D v1), additionally:
1. The `h1` is "Tasks" (36px); the big count heading is removed.
2. Priority on create and edit is a native `<select>`; the segmented
   priority control and the priority chip are removed.
3. Create form is a composer card (input on top, footer with priority and
   "Add task").
4. Task rows are two-line inside one list card; priority and time sit in a
   meta line under the title.
5. Done tasks sort after open tasks within each list.
6. "By day" switch turns day grouping on and off.
7. New "All done" state when the Open view is empty but tasks exist.

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
  (count heading, segmented controls, tabs, undo toast); then update or
  delete that test and say so in the commit message.
- Layout must work from 360px to desktop. Every interactive target is at
  least 44×44px.

## Page layout

Single centred column, `max-width: var(--content-max)`, page padding
`48px 20px 80px`. Sections are stacked with `gap: var(--space-section)`:

1. **Header**: `h1` "Tasks" on the left, HealthBadge on the right. Wraps.
2. **Composer** (create form) and its error line.
3. **Toolbar**: Status and Priority dropdowns on the left; search and the
   "By day" switch on the right. Wraps on narrow screens.
4. **Task list** (grouped or flat), or one of the empty cards.

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

### Select (shared styling for all dropdowns)
Native `<select>` with `appearance: none`, 44px high, `--radius-md`, white,
1px `--color-border`, a chevron-down icon inside on the right (12px in,
`pointer-events: none`, `aria-hidden`), right padding 34px. Text style and
left padding depend on the use below.

### PrioritySelect (input)
`<select>` with options "Low", "Medium", "High" (values `low`, `medium`,
`high`) inside a `<label>` whose visible text "Priority" sits before the
control (mono 12px, uppercase, letter-spacing 0.08em, `--color-muted`,
gap 10px).
- Mono 13px; text colour is the selected priority's colour.
- PriorityIcon inside on the left (12px in, `aria-hidden`), reflecting the
  current value; left padding 32px.
- Used in the composer (default **Medium**, resets to Medium after a
  successful create) and in edit mode (preset to the task's priority).

### Composer (create form)
White card, 1px `--color-border`, `--radius-xl`, flex column.
- Input: visually hidden `<label>` "New task" (`.sr-only`), placeholder
  "Add a task…", height `--control-composer`, no border, transparent,
  padding `0 18px`, `--text-composer`.
- Footer row: top border 1px `--color-divider`, padding `8px 8px 8px 18px`,
  space-between, wraps. Left: PrioritySelect. Right: hint "Enter ↵"
  (mono 12px muted, `aria-hidden`) and the "Add task" submit button (44px,
  padding 0 20px, `--radius-md`, accent background, `--color-on-accent`,
  weight 600).
- Validation as today (trimmed, required, max 200). When invalid, the card
  border becomes `--color-danger-dot`, the input gets `aria-invalid="true"`,
  and the error text sits below the card, 13px `--color-danger`, linked via
  `aria-describedby`.

### Toolbar
Flex row, space-between, centred, wraps (gap 12px 16px). No border.

**Filters** (`role="group"`, `aria-label="Filters"`, gap 8px, wraps): two
FilterSelects. A FilterSelect is a `<label>` wrapping a Select, with the
label text drawn inside the control on the left: mono 11px, uppercase,
letter-spacing 0.08em, `--color-muted`, positioned 12px in,
`pointer-events: none`. The select's own text is sans 14px, weight 500.

| Filter   | Label text | Left padding | Options (value: text)                                  | Default |
|----------|------------|--------------|--------------------------------------------------------|---------|
| Status   | STATUS     | 70px         | `open`: "Open · 3", `done`: "Done · 2", `all`: "All · 5" | `open`  |
| Priority | PRIORITY   | 82px         | `all`: "Any", `high`: "High", `medium`: "Medium", `low`: "Low" | `all`   |

- Counts in the status options are totals per status; they ignore search
  and the priority filter.
- **Active filter cue:** when a filter is not at its default, its border
  becomes `--color-text`.
- The Priority filter's text takes the chosen priority's colour; "Any" is
  `--color-text`.

**Search + switch** (`role="search"`, gap 12px):
- Search input: type `search`, `aria-label="Filter tasks by title"`,
  placeholder "Search", width 200px (max 100%), 44px high, `--radius-md`,
  search icon inside on the left (padding-left 34px), `--text-search`.
  Case-insensitive substring match on title.
- **By day switch**: `<button type="button" role="switch" aria-checked>`,
  44px high, mono 12px label "By day" after the track. Track 32×18px,
  radius 999px: on `--color-text`, off `--color-switch-off`. Knob 14px
  white circle, `--shadow-knob`, left 16px when on, 2px when off,
  `transition: left .15s`. Default **on**.

All filters combine (AND): status, priority, search.

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

Each row (`<li>`) is in exactly one of three modes: view, edit or confirm
delete. Only one row can be in edit or confirm mode at a time; entering one
cancels the other.

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
   "Edit {title}" / "Delete {title}". Delete opens confirm mode; it does
   not delete.

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

### TaskItem: confirm delete mode
The row background becomes `--color-danger-bg` with
`box-shadow: var(--ring-danger)`. Content (`role="group"`,
`aria-label="Confirm deleting {title}"`, flex, space-between, wraps,
padding `6px 6px 6px 18px`, min-height 56px):
- Text, 15px, `--color-danger-text`, wraps: `Delete <strong>{title}</strong>?`
  (title weight 600).
- Buttons, gap 8px, both 44px, `--radius-sm`:
  - "Cancel": white, 1px `--color-danger-border-strong`, `--color-text`.
    **Receives focus when confirm mode opens**, so Enter or Space on a
    double tap never deletes by accident.
  - "Delete": `--color-danger-solid` background, white, weight 600.
- Esc cancels. Clicking Delete sends `DELETE /tasks/:id`:
  - While the request is in flight both buttons are disabled (Cancel at
    55% opacity, Delete at 70%), the group has `aria-busy="true"`, and
    "Delete" reads "Deleting…".
  - On success the row is removed (invalidate or update the tasks query).
  - On failure the row returns to confirm mode and shows the server message
    below the text in `--color-danger`, `role="alert"`.
- After a successful delete, move focus to the next row's checkbox, or to
  the previous one if it was the last row, or to the composer input if the
  list is now empty.

## States

Every state below is drawn in `reference/States.dc.html`.

Dashed cards use 1px dashed `--color-border-dashed`, `--radius-xl`,
padding `40px 24px`, centred 16px text.

- **Loading:** one list card with three skeleton rows (each row: a 20px
  square where the checkbox goes, a title bar ~50% wide and a short meta bar
  under it, all `--color-skeleton`, radius 6px), `aria-busy="true"`. Badge
  shows "Checking API…". Status options show no counts until data arrives.
- **API down / load error:** badge "API down"; in place of the list a
  `role="alert"` box (`--color-danger-bg`, 1px `--color-danger-border`,
  `--radius-xl`, `--color-danger-text`): bold "Couldn’t load tasks", the
  error message below, and a white "Retry" button (44px) on the right that
  refetches.
- **Empty** (zero tasks): dashed card, muted text
  "No tasks yet — add your first one above."
- **All done** (status Open, priority Any, no search, tasks exist but none
  open): dashed card, muted text "Nothing open. Everything is done."
- **No matches** (filters hide everything): dashed card,
  "No tasks match your filters." and a secondary "Clear filters" button that
  clears the search and resets priority to Any (status is kept).
- **Mutation errors** (create, update, toggle): show the server message
  next to the action that failed; for a failed toggle, restore the checkbox.
  Delete errors: see confirm delete mode.

## Data and API implications

- Task shape: `done: boolean` (default `false`) and
  `priority: 'low' | 'medium' | 'high'` (default `'medium'`; any other value
  → 400 on create and update).
- `PATCH /tasks/:id` with `{ title?, done?, priority? }`: at least one field
  required (empty body → 400), same title rules, unknown id → 404, returns
  the updated task.
- `DELETE /tasks/:id`: 204, unknown id → 404. Called only after the user
  confirms.
- The frontend only knows `id`. If the store's primary key is not `id`
  alone, update and delete need a way to resolve it; decide this in the
  backend before building the endpoints.
- Search, both filters, grouping and ordering are client-side.

## Suggested prompt for Claude Code

> The design changed. Read `docs/design/DESIGN_HANDOFF.md` from the start
> (it replaces the previous version; "What changed since the previous
> handoff" lists the differences) and implement it in `apps/web` using
> CSS Modules and `docs/design/tokens.css`. Use `docs/design/reference/`
> only as a visual reference: do not port its inline styles or runtime.
> Keep existing hooks, `api/client.ts`, ARIA roles and the visible copy
> that tests use. Remove code the document no longer uses (status tabs,
> undo toast and deferred-delete logic, segmented priority control,
> priority chip, count heading) instead of leaving it unused, along with
> its tests. Add tests for: the Status and Priority filters and their
> combination with search, status counts, the default Open view and the
> All done state, the By day switch, ordering of done tasks, priority on
> create and edit, inline edit, the done toggle, and delete confirmation
> (open, cancel with button and Esc, focus on Cancel, confirm, in-flight
> state, failure). Don't add features beyond this document and don't add
> dependencies without asking. Start with a short plan: which components
> and CSS module files you will create, change or delete.
