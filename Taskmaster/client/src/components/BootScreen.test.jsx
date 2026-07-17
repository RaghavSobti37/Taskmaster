import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BootScreen from './BootScreen.jsx';

vi.mock('../lib/systemLogBridge', () => ({
  useToast: () => ({
    success: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('BootScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows shared AppErrorPage after boot timeout', async () => {
    render(
      <MemoryRouter>
        <BootScreen timeoutMs={1000} onRefresh={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: /connection timed out/i })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByRole('heading', { name: /connection timed out/i })).toBeInTheDocument();
    expect(screen.getByText(/loading is taking too long/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Ref CK-/)).toBeInTheDocument();
  });
});
