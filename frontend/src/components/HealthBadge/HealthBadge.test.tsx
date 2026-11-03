import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient } from '../../test/render';
import { server } from '../../test/server';
import { HealthBadge } from './HealthBadge';

const health = (respond: () => Response) => server.use(http.get(`${import.meta.env.VITE_API_URL}/health`, respond));

describe('HealthBadge', () => {
  it('says it is checking before the API answers', () => {
    health(() => HttpResponse.json({ status: 'ok', uptime: 1 }));
    renderWithClient(<HealthBadge />);

    expect(screen.getByRole('status')).toHaveTextContent('Checking API…');
  });

  it('shows the uptime as hours and minutes when the API is up', async () => {
    health(() => HttpResponse.json({ status: 'ok', uptime: 4320 }));
    renderWithClient(<HealthBadge />);

    expect(await screen.findByText('API up')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('API up · uptime 1h 12m');
  });

  it('shows minutes only under an hour', async () => {
    health(() => HttpResponse.json({ status: 'ok', uptime: 300 }));
    renderWithClient(<HealthBadge />);

    await screen.findByText('API up');
    expect(screen.getByRole('status')).toHaveTextContent('uptime 5m');
  });

  it('says the API is down when the call fails', async () => {
    health(() => HttpResponse.error());
    renderWithClient(<HealthBadge />);

    expect(await screen.findByText('API down')).toBeInTheDocument();
  });

  it('turns to down when a later poll fails', async () => {
    // shouldAdvanceTime lets MSW and findBy* run; the 5 s poll is skipped by hand
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let calls = 0;
      health(() => (++calls === 1 ? HttpResponse.json({ status: 'ok', uptime: 60 }) : HttpResponse.error()));
      renderWithClient(<HealthBadge />);
      await screen.findByText('API up');

      await vi.advanceTimersByTimeAsync(5000);

      expect(await screen.findByText('API down')).toBeInTheDocument();
      expect(screen.getByRole('status')).not.toHaveTextContent('uptime');
    } finally {
      vi.useRealTimers();
    }
  });
});
