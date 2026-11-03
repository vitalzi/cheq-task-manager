import { screen, within } from '@testing-library/react';
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

  const tabs = () => within(screen.getByRole('navigation', { name: 'Status' }));
  const search = () => screen.getByRole('searchbox', { name: 'Filter tasks by title' });
  const byDay = () => screen.getByRole('switch', { name: 'By day' });

  it('has a plain Tasks heading', () => {
    renderWithClient(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
  });

  describe('status tabs', () => {
    it('opens on the Open tab and shows only open tasks', async () => {
      renderWithClient(<App />);

      expect(await screen.findByText('Write the README')).toBeInTheDocument();
      expect(screen.getByText('Record a demo')).toBeInTheDocument();
      expect(screen.queryByText('Sketch the key design')).not.toBeInTheDocument();
      expect(tabs().getByRole('button', { name: /^Open/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows a count on each tab once the tasks have loaded', async () => {
      renderWithClient(<App />);

      expect(tabs().getByRole('button', { name: 'Open' })).toBeInTheDocument(); // no counts while loading
      expect(await tabs().findByRole('button', { name: 'Open 2' })).toBeInTheDocument();
      expect(tabs().getByRole('button', { name: 'Done 1' })).toBeInTheDocument();
      expect(tabs().getByRole('button', { name: 'All 3' })).toBeInTheDocument();
    });

    it('switches to the Done and All tabs', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');

      await user.click(tabs().getByRole('button', { name: /^Done/ }));
      expect(screen.getByText('Sketch the key design')).toBeInTheDocument();
      expect(screen.queryByText('Write the README')).not.toBeInTheDocument();
      expect(tabs().getByRole('button', { name: /^Done/ })).toHaveAttribute('aria-pressed', 'true');
      expect(tabs().getByRole('button', { name: /^Open/ })).toHaveAttribute('aria-pressed', 'false');

      await user.click(tabs().getByRole('button', { name: /^All/ }));
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('lists the done task last on the All tab even though it is the newest', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');

      await user.click(tabs().getByRole('button', { name: /^All/ }));

      const rows = screen.getAllByRole('listitem').map((row) => row.textContent ?? '');
      expect(rows[2]).toContain('Sketch the key design');
    });

    it('says everything is done when the Open tab is empty but tasks exist', async () => {
      api.tasks = [sampleTask({ done: 1 })];
      renderWithClient(<App />);

      expect(await screen.findByText('Nothing open. Everything is done.')).toBeInTheDocument();
    });

    it('says nothing is done yet when the Done tab is empty', async () => {
      const user = userEvent.setup();
      api.tasks = [sampleTask({ done: 0 })];
      renderWithClient(<App />);
      await screen.findByText('Write the report');

      await user.click(tabs().getByRole('button', { name: /^Done/ }));

      expect(screen.getByText('Nothing done yet.')).toBeInTheDocument();
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
      expect(tabs().getByRole('button', { name: 'Open 2' })).toBeInTheDocument();
    });

    it('says nothing matches and clears only the search, keeping the tab', async () => {
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText('Write the README');
      await user.click(tabs().getByRole('button', { name: /^Done/ }));

      await user.type(search(), 'zzz');
      expect(screen.getByText('No tasks match your filter.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear search' }));

      expect(search()).toHaveValue('');
      expect(tabs().getByRole('button', { name: /^Done/ })).toHaveAttribute('aria-pressed', 'true');
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
      await tabs().findByRole('button', { name: 'Open 2' });

      await user.click(await screen.findByRole('button', { name: 'Delete Write the README' }));
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      expect(await tabs().findByRole('button', { name: 'Open 1' })).toBeInTheDocument();
      expect(tabs().getByRole('button', { name: 'All 2' })).toBeInTheDocument();
    });
  });
});
