import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/authNavigation', () => ({
  navigateAfterAuth: vi.fn(),
}));

import { navigateAfterAuth } from '../utils/authNavigation';
import { navigateOnce, resetNavigateGuard } from './postLoginRedirect';

describe('postLoginRedirect navigateOnce', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigateGuard();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates on first call', () => {
    navigateOnce(navigate, '/dashboard');
    expect(navigateAfterAuth).toHaveBeenCalledWith(navigate, '/dashboard');
  });

  it('blocks duplicate navigation within TTL', () => {
    navigateOnce(navigate, '/dashboard');
    navigateOnce(navigate, '/tasks');
    expect(navigateAfterAuth).toHaveBeenCalledTimes(1);
  });

  it('allows navigation again after TTL expires', () => {
    navigateOnce(navigate, '/dashboard');
    vi.advanceTimersByTime(5001);
    navigateOnce(navigate, '/tasks');
    expect(navigateAfterAuth).toHaveBeenCalledTimes(2);
    expect(navigateAfterAuth).toHaveBeenLastCalledWith(navigate, '/tasks');
  });

  it('resetNavigateGuard clears the block immediately', () => {
    navigateOnce(navigate, '/dashboard');
    resetNavigateGuard();
    navigateOnce(navigate, '/tasks');
    expect(navigateAfterAuth).toHaveBeenCalledTimes(2);
  });
});
