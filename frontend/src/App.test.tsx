import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { FakeApi, sampleTask } from './test/fakeApi';
import { renderWithClient } from './test/render';
import { server } from './test/server';

describe('App', () => {
  let api: FakeApi;

  beforeEach(() => {
    api = new FakeApi([
      sampleTask({ id: 'a', title: 'Write the README', done: 0, createdAt: '2026-11-02T09:00:00.000Z' }),
      sampleTask({ id: 'b', title: 'Record a demo', done: 0, createdAt: '2026-11-02T08:00:00.000Z' }),
      sampleTask({ id: 'c', title: 'Sketch the key design', done: 1, createdAt: '2026-11-02T10:00:00.000Z' }),
    ]);
    api.install();
    server.use(http.get(`${import.meta.env.VITE_API_URL}/health`, () => HttpResponse.json({ status: 'ok', uptime: 60 })));
  });

  const status = () => screen.getByRole('combobox', { name: 'Status' });
  const priority = () => screen.getByRole('combobox', { name: 'Priority filter' });
  const option = (select: HTMLElement, name: string) => within(select).getByRole('option', { name });
  const search = () => screen.getByRole('searchbox', { name: 'Filter tasks by title' });
  const byDay = () => screen.getByRole('switch', { name: 'By day' });

  it('has a plain Tasks heading', () => {
    renderWithClient(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
  });

  describe('status filter', () => {
    it('opens on Open and shows only open tasks', async () => {
      renderWithClient(<App />);

      expect(await screen.findByText('Write the README')).toBeInTheDocument();
      expect(screen.getByText('Record a demo')).toBeInTheDocument();
      expect(screen.queryByText('Sketch the key design')).not.toBeInTheDocument();
      expect(status()).toHaveValue('open');
    });

    it('shows a count in each option once the tasks have loaded', async () => {
      renderWithClient(<App />);

      expect(option(status(), 'Open')).toBeInTheDocument(); // no counts while loading
      expect(await within(status()).findByRole('option', { name: 'Open · 2' })).toBeInTheDocument();
      expect(option(status(), 'Done · 1')).toBeInTheDocument();
      expect(option(status(), 'All · 3')).toBeInTheDocument();
    });

    it('switches to Done and All', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');

      await user.selectOptions(status(), 'done');
      expect(screen.getByText('Sketch the key design')).toBeInTheDocument();
      expect(screen.queryByText('Write the README')).not.toBeInTheDocument();

      await user.selectOptions(status(), 'all');
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('lists the done task last on All even though it is the newest', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');

      await user.selectOptions(status(), 'all');

      const rows = screen.getAllByRole('listitem').map((row) => row.textContent ?? '');
      expect(rows[2]).toContain('Sketch the key design');
    });

    it('says everything is done when Open is empty but tasks exist', async () => {
      api.tasks = [sampleTask({ done: 1 })];
      renderWithClient(<App />);

      expect(await screen.findByText('Nothing open. Everything is done.')).toBeInTheDocument();
    });

    it('says nothing is done yet when Done is empty', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ done: 0 })];
      renderWithClient(<App />);
      await screen.findByText('Write the report');

      await user.selectOptions(status(), 'done');

      expect(screen.getByText('Nothing done yet.')).toBeInTheDocument();
    });
  });

  describe('priority filter', () => {
    beforeEach(() => {
      api.tasks = [
        sampleTask({ id: 'h', title: 'High one', priority: 0 }),
        sampleTask({ id: 'm', title: 'Medium one', priority: 1 }),
        sampleTask({ id: 'l', title: 'Low one', priority: 2 }),
      ];
    });

    it('starts on Any, offering Any, High, Medium and Low', async () => {
      renderWithClient(<App />);
      await screen.findByText('High one');

      expect(priority()).toHaveValue('any');
      expect(within(priority()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Any', 'High', 'Medium', 'Low']);
    });

    it('shows only the chosen priority, and leaves the status counts alone', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('High one');

      await user.selectOptions(priority(), 'High');

      expect(screen.getByText('High one')).toBeInTheDocument();
      expect(screen.queryByText('Medium one')).not.toBeInTheDocument();
      expect(option(status(), 'Open · 3')).toBeInTheDocument();
    });

    it('says nothing matches when only the priority hides everything', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ priority: 0 })];
      renderWithClient(<App />);
      await screen.findByText('Write the report');

      await user.selectOptions(priority(), 'Low');

      expect(screen.getByText('No tasks match your filters.')).toBeInTheDocument();
    });

    it('combines with the search', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('High one');

      await user.selectOptions(priority(), 'Medium');
      await user.type(search(), 'high');

      expect(screen.getByText('No tasks match your filters.')).toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('filters by title within the current tab, and leaves the tab counts alone', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');

      await user.type(search(), 'readme');

      expect(screen.getByText('Write the README')).toBeInTheDocument();
      expect(screen.queryByText('Record a demo')).not.toBeInTheDocument();
      expect(option(status(), 'Open · 2')).toBeInTheDocument();
    });

    it('says nothing matches and Clear filters resets search and priority, keeping the status', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');
      await user.selectOptions(status(), 'done');

      await user.selectOptions(priority(), 'High');
      await user.type(search(), 'zzz');
      expect(screen.getByText('No tasks match your filters.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(search()).toHaveValue('');
      expect(priority()).toHaveValue('any');
      expect(status()).toHaveValue('done');
      expect(screen.getByText('Sketch the key design')).toBeInTheDocument();
    });
  });

  describe('By day switch', () => {
    it('is on by default, with a heading per day', async () => {
      api.tasks = [sampleTask({ createdAt: new Date().toISOString() })];
      renderWithClient(<App />);

      expect(byDay()).toHaveAttribute('aria-checked', 'true');
      expect(await screen.findByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument();
    });

    it('turns the headings off and on', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ createdAt: new Date().toISOString() })];
      renderWithClient(<App />);
      await screen.findByRole('heading', { level: 2, name: 'Today' });

      await user.click(byDay());
      expect(byDay()).toHaveAttribute('aria-checked', 'false');
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
      expect(screen.getByText('Write the report')).toBeInTheDocument();

      await user.click(byDay());
      expect(screen.getByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    it('updates the tab counts after a delete', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await within(status()).findByRole('option', { name: 'Open · 2' });

      await user.click(await screen.findByRole('button', { name: 'Delete Write the README' }));
      await user.click(within(screen.getByRole('group', { name: 'Confirm deleting Write the README' })).getByRole('button', { name: 'Delete' }));

      expect(await within(status()).findByRole('option', { name: 'Open · 1' })).toBeInTheDocument();
      expect(option(status(), 'All · 2')).toBeInTheDocument();
    });

    it('moves focus to the composer when the last task is deleted', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ title: 'Only one' })];
      renderWithClient(<App />);

      await user.click(await screen.findByRole('button', { name: 'Delete Only one' }));
      await user.click(within(screen.getByRole('group', { name: 'Confirm deleting Only one' })).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'New task' })).toHaveFocus());
    });
  });
});
