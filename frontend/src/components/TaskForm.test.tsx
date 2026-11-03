import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeApi } from '../test/fakeApi';
import { renderWithClient } from '../test/render';
import { TaskForm } from './TaskForm';

describe('TaskForm', () => {
  let api: FakeApi;

  beforeEach(() => {
    api = new FakeApi();
    api.install();
  });

  const titleInput = () => screen.getByRole('textbox', { name: 'Task title' });
  const prioritySelect = () => screen.getByRole('combobox', { name: 'Priority' });

  it('offers High, Medium and Low, starting on Medium', () => {
    renderWithClient(<TaskForm />);

    const options = Array.from(prioritySelect().querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['High', 'Medium', 'Low']);
    expect(prioritySelect()).toHaveValue('1');
  });

  it('creates a task with Medium priority by default', async () => {
    const user = userEvent.setup();
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), 'Write the report');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    await waitFor(() => expect(api.writes).toEqual([{ method: 'POST', path: '/tasks', body: { title: 'Write the report', priority: 1 } }]));
  });

  it('creates a task with the chosen priority', async () => {
    const user = userEvent.setup();
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), 'Urgent');
    await user.selectOptions(prioritySelect(), 'High');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    await waitFor(() => expect(api.writes[0].body).toEqual({ title: 'Urgent', priority: 0 }));
  });

  it('clears the title after adding but keeps the chosen priority', async () => {
    const user = userEvent.setup();
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), 'Later');
    await user.selectOptions(prioritySelect(), 'Low');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    await waitFor(() => expect(titleInput()).toHaveValue(''));
    expect(prioritySelect()).toHaveValue('2');
  });

  it('sends nothing for a whitespace-only title and says why', async () => {
    const user = userEvent.setup();
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), '   ');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Title must not be empty.');
    expect(api.writes).toEqual([]);
  });

  it('sends one request when submitted twice while the first is pending', async () => {
    const user = userEvent.setup();
    const release = api.holdWrites();
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), 'Once');
    await user.dblClick(screen.getByRole('button', { name: 'Add task' }));
    release();

    await waitFor(() => expect(titleInput()).toHaveValue(''));
    expect(api.writes).toHaveLength(1);
  });

  it('ignores Enter pressed again while the first request is pending', async () => {
    const user = userEvent.setup();
    const release = api.holdWrites();
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), 'Once');
    await user.keyboard('{Enter}{Enter}');
    release();

    await waitFor(() => expect(titleInput()).toHaveValue(''));
    expect(api.writes).toHaveLength(1);
  });

  it('shows an alert and keeps the title when the API fails', async () => {
    const user = userEvent.setup();
    api.failNextWrite(500);
    renderWithClient(<TaskForm />);

    await user.type(titleInput(), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add task: Something went wrong');
    expect(titleInput()).toHaveValue('Keep me');
  });
});
