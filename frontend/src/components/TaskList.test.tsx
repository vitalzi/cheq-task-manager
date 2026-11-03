import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeApi, sampleTask } from '../test/fakeApi';
import { renderWithClient } from '../test/render';
import { TaskList } from './TaskList';

describe('TaskList', () => {
  let api: FakeApi;

  beforeEach(() => {
    api = new FakeApi([sampleTask()]);
    api.install();
  });

  const doneBox = () => screen.findByRole('checkbox', { name: /as done/ });
  const prioritySelect = () => screen.findByRole('combobox', { name: /Priority of/ });

  describe('showing tasks', () => {
    it('says so when there are no tasks', async () => {
      api.tasks = [];
      renderWithClient(<TaskList />);

      expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
    });

    it('shows each task with its title, done state and priority', async () => {
      api.tasks = [
        sampleTask({ id: 'a', title: 'First', done: 0, priority: 0 }),
        sampleTask({ id: 'b', title: 'Second', done: 1, priority: 2 }),
      ];
      renderWithClient(<TaskList />);

      const [first, second] = await screen.findAllByRole('listitem');
      expect(within(first).getByText('First')).toBeInTheDocument();
      expect(within(first).getByRole('checkbox')).not.toBeChecked();
      expect(within(first).getByRole('combobox')).toHaveValue('0');
      expect(within(second).getByText('Second')).toBeInTheDocument();
      expect(within(second).getByRole('checkbox')).toBeChecked();
      expect(within(second).getByRole('combobox')).toHaveValue('2');
    });
  });

  describe('marking done', () => {
    it('sends only done: 1 when an open task is ticked, then shows it ticked', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      await user.click(await doneBox());

      await waitFor(() => expect(api.writes).toEqual([{ method: 'PATCH', path: '/tasks/id-0', body: { done: 1 } }]));
      await waitFor(async () => expect(await doneBox()).toBeChecked());
    });

    it('sends done: 0 when a done task is unticked', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ done: 1 })];
      renderWithClient(<TaskList />);

      await user.click(await doneBox());

      await waitFor(() => expect(api.writes[0].body).toEqual({ done: 0 }));
    });
  });

  describe('changing priority', () => {
    it('sends only the new priority and shows it', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      await user.selectOptions(await prioritySelect(), 'High');

      await waitFor(() => expect(api.writes).toEqual([{ method: 'PATCH', path: '/tasks/id-0', body: { priority: 0 } }]));
      await waitFor(async () => expect(await prioritySelect()).toHaveValue('0'));
    });
  });

  describe('editing the title', () => {
    const startEditing = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Edit' }));
      return screen.getByRole('textbox', { name: 'Task title' });
    };

    it('opens an input holding the current title', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      expect(await startEditing(user)).toHaveValue('Write the report');
    });

    it('sends only the new title on Save, then shows it in place of the input', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Write the final report');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Write the final report')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(api.writes).toEqual([{ method: 'PATCH', path: '/tasks/id-0', body: { title: 'Write the final report' } }]);
    });

    it('saves on Enter', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Via Enter{Enter}');

      expect(await screen.findByText('Via Enter')).toBeInTheDocument();
    });

    it('discards the change on Cancel and sends nothing', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Never saved');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('Write the report')).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('starts from the saved title when edited again after a cancel', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      const input = await startEditing(user);
      await user.type(input, ' extra');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await startEditing(user)).toHaveValue('Write the report');
    });

    it('sends nothing for a whitespace-only title, says why, and stays in edit mode', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, '   ');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Title must not be empty.');
      expect(screen.getByRole('textbox', { name: 'Task title' })).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('sends one request when Save is clicked twice while the first is pending', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderWithClient(<TaskList />);

      const input = await startEditing(user);
      await user.clear(input);
      await user.type(input, 'Once');
      await user.dblClick(screen.getByRole('button', { name: 'Save' }));
      release();

      expect(await screen.findByText('Once')).toBeInTheDocument();
      expect(api.writes).toHaveLength(1);
    });
  });

  describe('while a change is pending', () => {
    it('sends one request when Enter is pressed twice in the title input while saving', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderWithClient(<TaskList />);
      await user.click(await screen.findByRole('button', { name: 'Edit' }));

      await user.keyboard('{Enter}{Enter}');
      release();

      expect(await screen.findByText('Write the report')).toBeInTheDocument();
      expect(api.writes).toHaveLength(1);
    });

    it('disables the row controls until the API answers', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderWithClient(<TaskList />);

      await user.click(await doneBox());

      await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled());
      expect(screen.getByRole('combobox')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();

      release();
      await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    });
  });

  describe('deleting', () => {
    const deleteButton = () => screen.findByRole('button', { name: 'Delete' });

    it('asks first and sends nothing until Yes', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      await user.click(await deleteButton());

      expect(screen.getByText('Delete?')).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('sends DELETE on Yes and removes the task', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
      expect(api.writes).toEqual([{ method: 'DELETE', path: '/tasks/id-0', body: undefined }]);
    });

    it('goes back to the Delete button on No and sends nothing', async () => {
      const user = userEvent.setup();
      renderWithClient(<TaskList />);

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'No' }));

      expect(await deleteButton()).toBeInTheDocument();
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it('keeps the task and shows an alert when the delete fails', async () => {
      const user = userEvent.setup();
      api.failNextWrite(500);
      renderWithClient(<TaskList />);

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete task: Something went wrong');
      expect(screen.getByText('Write the report')).toBeInTheDocument();
    });

    it('disables the row controls while the delete is pending', async () => {
      const user = userEvent.setup();
      const release = api.holdWrites();
      renderWithClient(<TaskList />);

      await user.click(await deleteButton());
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled());
      expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();

      release();
      await waitFor(() => expect(screen.queryByText('Write the report')).not.toBeInTheDocument());
    });
  });

  describe('when the API fails', () => {
    it('shows an alert and leaves the task as it was', async () => {
      const user = userEvent.setup();
      api.failNextWrite(500);
      renderWithClient(<TaskList />);

      await user.click(await doneBox());

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not update task: Something went wrong');
      expect(await doneBox()).not.toBeChecked();
    });
  });
});
