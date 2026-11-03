import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Filters } from '../../lib/filters';
import { FakeApi, sampleTask } from '../../test/fakeApi';
import { renderWithClient } from '../../test/render';
import { server } from '../../test/server';
import { TaskList } from './TaskList';

const ALL: Filters = { query: '', status: 'all', priority: 'any' };
const renderList = (filters: Filters = ALL, byDay = true, onEmptied = () => {}) =>
  renderWithClient(<TaskList filters={filters} byDay={byDay} onClearFilters={() => {}} onEmptied={onEmptied} />);

describe('TaskList', () => {
  let api: FakeApi;

  beforeEach(() => {
    api = new FakeApi([sampleTask()]);
    api.install();
  });

  const doneBox = () => screen.findByRole('checkbox', { name: /Mark as (not )?done/ });
  const editButton = () => screen.findByRole('button', { name: /^Edit / });

  describe('showing tasks', () => {
    it('says so when there are no tasks', async () => {
      api.tasks = [];
      renderList();

      expect(await screen.findByText('No tasks yet — add your first one above.')).toBeInTheDocument();
    });

    it('shows each task with its title, done state and priority', async () => {
      api.tasks = [
        sampleTask({ id: 'a', title: 'First', done: 0, priority: 0 }),
        sampleTask({ id: 'b', title: 'Second', done: 1, priority: 2 }),
      ];
      renderList();

      const [first, second] = await screen.findAllByRole('listitem');
      expect(within(first).getByText('First')).toBeInTheDocument();
      expect(within(first).getByRole('checkbox')).not.toBeChecked();
      expect(within(first).getByRole('img', { name: 'High priority' })).toBeInTheDocument();
      expect(within(second).getByText('Second')).toBeInTheDocument();
      expect(within(second).getByRole('checkbox')).toBeChecked();
      expect(within(second).getByRole('img', { name: 'Low priority' })).toBeInTheDocument();
    });

    it('lists done tasks after open ones', async () => {
      api.tasks = [
        sampleTask({ id: 'a', title: 'Done and newest', done: 1, createdAt: '2026-11-02T10:00:00.000Z' }),
        sampleTask({ id: 'b', title: 'Open and older', done: 0, createdAt: '2026-11-02T09:00:00.000Z' }),
      ];
      renderList();

      const rows = await screen.findAllByRole('listitem');
      expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining('Open and older'), expect.stringContaining('Done and newest')]);
    });

    it('groups by day with a heading each, or shows one list without headings', async () => {
      api.tasks = [sampleTask({ createdAt: new Date().toISOString() })];
      const { unmount } = renderList(ALL, true);
      expect(await screen.findByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument();
      unmount();

      renderList(ALL, false);
      await screen.findByText('Write the report');
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
      expect(screen.getByText(/^Today, \d\d:\d\d$/)).toBeInTheDocument();
    });
  });

  describe('marking done', () => {
    it('sends only done: 1 when an open task is ticked, then shows it ticked', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await doneBox());

      await waitFor(() => expect(api.writes).toEqual([{ method: 'PATCH', path: '/tasks/id-0', body: { done: 1 } }]));
      await waitFor(async () => expect(await doneBox()).toBeChecked());
    });

    it('sends done: 0 when a done task is unticked', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ done: 1 })];
      renderList();

      await user.click(await doneBox());

      await waitFor(() => expect(api.writes[0].body).toEqual({ done: 0 }));
    });

    it('names the checkbox after what it will do', async () => {
      api.tasks = [sampleTask({ done: 1 })];
      renderList();

      expect(await screen.findByRole('checkbox', { name: 'Mark as not done: Write the report' })).toBeInTheDocument();
    });
  });

  describe('editing', () => {
    const startEditing = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await editButton());
      return screen.getByRole('textbox', { name: 'Edit task title' });
    };
    const prioritySelect = () => screen.getByRole('combobox', { name: 'Priority' });

    it('opens an input holding the current title and a priority select holding the current priority', async () => {
      const user = userEvent.setup();
      renderList();

      expect(await startEditing(user)).toHaveValue('Write the report');
      expect(prioritySelect()).toHaveValue('1');
    });

    it('sends the title and the priority together on Save, then shows the new title', async () => {
      const user = userEvent.setup();
      renderList();

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Write the final report');
      await user.selectOptions(prioritySelect(), 'High');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Write the final report')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(api.writes).toEqual([{ method: 'PATCH', path: '/tasks/id-0', body: { title: 'Write the final report', priority: 0 } }]);
      expect(await screen.findByRole('img', { name: 'High priority' })).toBeInTheDocument();
    });

    it('saves on Enter', async () => {
      const user = userEvent.setup();
      renderList();

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Via Enter{Enter}');

      expect(await screen.findByText('Via Enter')).toBeInTheDocument();
    });

    it('discards the change on Cancel and sends nothing', async () => {
      const user = userEvent.setup();
      renderList();

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Never saved');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('Write the report')).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('starts from the saved title and priority when edited again after a cancel', async () => {
      const user = userEvent.setup();
      renderList();

      const input = await startEditing(user);
      await user.type(input, ' extra');
      await user.selectOptions(prioritySelect(), 'Low');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await startEditing(user)).toHaveValue('Write the report');
      expect(prioritySelect()).toHaveValue('1');
    });

    it('cancels with Escape and sends nothing', async () => {
      const user = userEvent.setup();
      renderList();

      await startEditing(user);
      await user.keyboard(' extra{Escape}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Write the report')).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('explains how to cancel', async () => {
      const user = userEvent.setup();
      renderList();

      await startEditing(user);

      expect(screen.getByText('Esc to cancel')).toBeInTheDocument();
    });

    it('sends nothing for a whitespace-only title, says why, marks the input invalid and stays in edit mode', async () => {
      const user = userEvent.setup();
      renderList();

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, '   ');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Title must not be empty.');
      expect(input).toBeInvalid();
      expect(input).toHaveAccessibleDescription(expect.stringContaining('Title must not be empty.'));
      expect(api.writes).toEqual([]);
    });

    it('sends one request when Save is clicked twice while the first is pending', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderList();

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Once');
      await user.dblClick(screen.getByRole('button', { name: 'Save' }));
      release();

      expect(await screen.findByText('Once')).toBeInTheDocument();
      expect(api.writes).toHaveLength(1);
    });

    it('sends one request when Enter is pressed twice in the title input while saving', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderList();
      await user.click(await editButton());

      await user.keyboard('{Enter}{Enter}');
      release();

      expect(await screen.findByText('Write the report')).toBeInTheDocument();
      expect(api.writes).toHaveLength(1);
    });
  });

  describe('while a change is pending', () => {
    it('disables the row controls until the API answers', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderList();

      await user.click(await doneBox());

      await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled());
      expect(screen.getByRole('button', { name: /^Edit / })).toBeDisabled();

      release();
      await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    });
  });

  describe('deleting', () => {
    const deleteButton = () => screen.findByRole('button', { name: /^Delete / });
    const confirmGroup = () => screen.getByRole('group', { name: 'Confirm deleting Write the report' });
    const confirmDelete = () => within(confirmGroup()).getByRole('button', { name: /^Delet/ });

    it('asks first, with focus on Cancel, and sends nothing until Delete', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());

      expect(confirmGroup()).toHaveTextContent('Delete Write the report?');
      expect(within(confirmGroup()).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      expect(api.writes).toEqual([]);
    });

    it('does not delete when Enter is pressed straight after opening the confirmation', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());
      await user.keyboard('{Enter}');

      expect(await deleteButton()).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('sends DELETE on Delete and removes the task', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());
      await user.click(confirmDelete());

      expect(await screen.findByText('No tasks yet — add your first one above.')).toBeInTheDocument();
      expect(api.writes).toEqual([{ method: 'DELETE', path: '/tasks/id-0', body: undefined }]);
    });

    it('goes back to the Delete button on Cancel and sends nothing', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await deleteButton()).toBeInTheDocument();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('goes back on Escape and sends nothing', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());
      await user.keyboard('{Escape}');

      expect(await deleteButton()).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('stays in the confirmation and shows the server message when the delete fails', async () => {
      const user = userEvent.setup();
      api.failNextWrite(500);
      renderList();

      await user.click(await deleteButton());
      await user.click(confirmDelete());

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
      expect(confirmGroup()).toBeInTheDocument();
      expect(screen.getByText('Write the report')).toBeInTheDocument();
      expect(within(confirmGroup()).getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    it('shows Deleting… and disables both buttons while the delete is pending', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderList();

      await user.click(await deleteButton());
      await user.click(confirmDelete());

      expect(await within(confirmGroup()).findByRole('button', { name: 'Deleting…' })).toBeDisabled();
      expect(within(confirmGroup()).getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(confirmGroup()).toHaveAttribute('aria-busy', 'true');

      release();
      await waitFor(() => expect(screen.queryByText('Write the report')).not.toBeInTheDocument());
    });

    describe('with several rows', () => {
      beforeEach(() => {
        api.tasks = [
          sampleTask({ id: 'a', title: 'First', createdAt: '2026-11-03T12:00:00.000Z' }),
          sampleTask({ id: 'b', title: 'Second', createdAt: '2026-11-03T11:00:00.000Z' }),
          sampleTask({ id: 'c', title: 'Third', createdAt: '2026-11-03T10:00:00.000Z' }),
        ];
      });
      const confirmFor = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
        await user.click(await screen.findByRole('button', { name: `Delete ${title}` }));
        await user.click(within(screen.getByRole('group')).getByRole('button', { name: 'Delete' }));
      };

      it('moves focus to the next row\'s checkbox after a delete', async () => {
        const user = userEvent.setup();
        renderList();

        await confirmFor(user, 'Second');

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark as done: Third' })).toHaveFocus());
      });

      it('moves focus to the previous row when the last row was deleted', async () => {
        const user = userEvent.setup();
        renderList();

        await confirmFor(user, 'Third');

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark as done: Second' })).toHaveFocus());
      });

      it('asks the page to focus the composer when the list is empty afterwards', async () => {
        const user = userEvent.setup();
        let emptied = 0;
        api.tasks = [sampleTask()];
        renderList(ALL, true, () => emptied++);

        await confirmFor(user, 'Write the report');

        await waitFor(() => expect(emptied).toBe(1));
      });

      it('has only one row in confirm mode at a time', async () => {
        const user = userEvent.setup();
        renderList();

        await user.click(await screen.findByRole('button', { name: 'Delete First' }));
        await user.click(screen.getByRole('button', { name: 'Delete Second' }));

        expect(screen.getAllByRole('group')).toHaveLength(1);
        expect(screen.getByRole('group')).toHaveAccessibleName('Confirm deleting Second');
        expect(screen.getByRole('button', { name: 'Delete First' })).toBeInTheDocument();
      });

      it('closes a confirmation when another row goes into edit mode, and the other way round', async () => {
        const user = userEvent.setup();
        renderList();

        await user.click(await screen.findByRole('button', { name: 'Delete First' }));
        await user.click(screen.getByRole('button', { name: 'Edit Second' }));
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Edit task title' })).toHaveValue('Second');

        await user.click(screen.getByRole('button', { name: 'Delete Third' }));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('group')).toHaveAccessibleName('Confirm deleting Third');
      });
    });
  });

  describe('loading and failing to load', () => {
    it('shows a busy skeleton while the tasks load', async () => {
      renderList();

      expect(screen.getByLabelText('Loading tasks')).toHaveAttribute('aria-busy', 'true');
      // Let the request finish so it cannot leak into the next test.
      await screen.findByText('Write the report');
    });

    it('shows the error with a Retry that loads again', async () => {
      const user = userEvent.setup();
      let calls = 0;
      server.use(
        http.get(`${import.meta.env.VITE_API_URL}/tasks`, () =>
          ++calls === 1 ? HttpResponse.json({ error: 'Cannot reach the API' }, { status: 500 }) : HttpResponse.json([sampleTask()]),
        ),
      );
      renderList();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Couldn’t load tasks');
      expect(alert).toHaveTextContent('Cannot reach the API');
      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('Write the report')).toBeInTheDocument();
    });
  });

  describe('when the API fails', () => {
    it('shows an alert and leaves the task as it was', async () => {
      const user = userEvent.setup();
      api.failNextWrite(500);
      renderList();

      await user.click(await doneBox());

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not update task: Something went wrong');
      expect(await doneBox()).not.toBeChecked();
    });
  });
});
