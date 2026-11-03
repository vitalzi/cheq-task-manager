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
      sampleTask({ id: 'a', title: 'Write the README', done: 0 }),
      sampleTask({ id: 'b', title: 'Record a demo', done: 0 }),
      sampleTask({ id: 'c', title: 'Sketch the key design', done: 1 }),
    ]);
    api.install();
    server.use(http.get(`${import.meta.env.VITE_API_URL}/health`, () => HttpResponse.json({ status: 'ok', uptime: 60 })));
  });

  const heading = () => screen.findByRole('heading', { level: 1 });
  const filterInput = () => screen.getByRole('searchbox', { name: 'Filter tasks by title' });
  const status = (name: string) => within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name });

  it('headlines the number of open tasks', async () => {
    renderWithClient(<App />);

    expect(await screen.findByText('2 open tasks')).toBeInTheDocument();
    expect(await heading()).toHaveTextContent('2 open tasks');
  });

  it('filters by title and says how many of the total are shown', async () => {
    const user = userEvent.setup();
    renderWithClient(<App />);
    await screen.findByText('Write the README');

    await user.type(filterInput(), 'readme');

    expect(screen.getByText('Write the README')).toBeInTheDocument();
    expect(screen.queryByText('Record a demo')).not.toBeInTheDocument();
    expect(await heading()).toHaveTextContent('1 of 3 tasks');
  });

  it('filters by status and marks the pressed button', async () => {
    const user = userEvent.setup();
    renderWithClient(<App />);
    await screen.findByText('Write the README');
    expect(status('All')).toHaveAttribute('aria-pressed', 'true');

    await user.click(status('Done'));

    expect(status('Done')).toHaveAttribute('aria-pressed', 'true');
    expect(status('All')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Sketch the key design')).toBeInTheDocument();
    expect(screen.queryByText('Write the README')).not.toBeInTheDocument();
  });

  it('says nothing matches and clears the filters with one button', async () => {
    const user = userEvent.setup();
    renderWithClient(<App />);
    await screen.findByText('Write the README');

    await user.type(filterInput(), 'zzz');
    expect(screen.getByText('No tasks match your filter.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(filterInput()).toHaveValue('');
    expect(status('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Write the README')).toBeInTheDocument();
  });

  it('puts tasks created today under a Today heading', async () => {
    api.tasks = [sampleTask({ createdAt: new Date().toISOString() })];
    renderWithClient(<App />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument();
  });
});
