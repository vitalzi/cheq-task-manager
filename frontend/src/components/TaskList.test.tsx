import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Filters } from '../filters';
import { FakeApi, sampleTask } from '../test/fakeApi';
import { renderWithClient } from '../test/render';
import { server } from '../test/server';
import { TaskList } from './TaskList';

const ALL: Filters = { query: '', status: 'all' };
const renderList = (filters: Filters = ALL, byDay = true) =>
  renderWithClient(<TaskList filters={filters} byDay={byDay} onClearSearch={() => {}} />);

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

    it('asks first and sends nothing until Yes', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());

      expect(screen.getByText('Delete?')).toBeInTheDocument();
      expect(screen.getByText('Write the report')).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('sends DELETE on Yes and removes the task', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      expect(await screen.findByText('No tasks yet — add your first one above.')).toBeInTheDocument();
      expect(api.writes).toEqual([{ method: 'DELETE', path: '/tasks/id-0', body: undefined }]);
    });

    it('goes back to the Delete button on No and sends nothing', async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'No' }));

      expect(await deleteButton()).toBeInTheDocument();
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('keeps the task and shows an alert when the delete fails', async () => {
      const user = userEvent.setup();
      api.failNextWrite(500);
      renderList();

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete task: Something went wrong');
      expect(screen.getByText('Write the report')).toBeInTheDocument();
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument(); // back to the Delete button
      expect(screen.getByRole('button', { name: /^Delete / })).toBeInTheDocument();
    });

    it('disables the row controls while the delete is pending', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderList();

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled());
      expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();

      release();
      await waitFor(() => expect(screen.queryByText('Write the report')).not.toBeInTheDocument());
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
