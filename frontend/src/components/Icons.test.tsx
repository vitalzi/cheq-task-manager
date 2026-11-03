import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Priority } from '../api';
import { PriorityIcon } from './Icons';

const filledBars = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('rect')).filter((bar) => /(^|_)on(_|$)/.test(bar.getAttribute('class') ?? '')).length;

describe('PriorityIcon', () => {
  it.each<[Priority, number, string]>([
    [2, 1, 'Low priority'],
    [1, 2, 'Medium priority'],
    [0, 3, 'High priority'],
  ])('priority %i fills %i bar(s)', (priority, bars, label) => {
    const { container } = render(<PriorityIcon priority={priority} label={label} />);

    expect(filledBars(container)).toBe(bars);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('is hidden from screen readers when it has no label', () => {
    const { container } = render(<PriorityIcon priority={1} />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
