import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueryErrorBanner, { getQueryErrorMessage } from './QueryErrorBanner.jsx';

describe('getQueryErrorMessage', () => {
  it('prefers API error field', () => {
    expect(getQueryErrorMessage({ response: { data: { error: 'Denied' } } })).toBe('Denied');
  });

  it('falls back to message then default', () => {
    expect(getQueryErrorMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(getQueryErrorMessage(null)).toBe('Failed to load data');
    expect(getQueryErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });

  it('shows refresh even when no local retry handler is provided', () => {
    render(React.createElement(QueryErrorBanner, { message: 'Failed to load tasks' }));

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('uses the local retry handler when provided', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(React.createElement(QueryErrorBanner, { message: 'Failed to load tasks', onRetry }));

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
