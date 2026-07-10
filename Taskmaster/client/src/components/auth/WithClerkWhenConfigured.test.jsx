import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUseClerkAuth = vi.fn(() => ({ isLoaded: true, isSignedIn: true }));

vi.mock('@clerk/react', () => ({
  useAuth: (...args) => mockUseClerkAuth(...args),
}));

vi.mock('../../config/clerk', () => ({
  isClerkConfigured: vi.fn(() => false),
}));

import { isClerkConfigured } from '../../config/clerk';
import WithClerkWhenConfigured from './WithClerkWhenConfigured';

describe('WithClerkWhenConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isClerkConfigured.mockReturnValue(false);
  });

  it('does not call Clerk useAuth when clerk is not configured', () => {
    render(
      <WithClerkWhenConfigured>
        {({ isLoaded, isSignedIn }) => (
          <span data-testid="state">{`${isLoaded}-${isSignedIn}`}</span>
        )}
      </WithClerkWhenConfigured>,
    );

    expect(mockUseClerkAuth).not.toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent('true-false');
  });

  it('calls Clerk useAuth when clerk is configured', () => {
    isClerkConfigured.mockReturnValue(true);
    render(
      <WithClerkWhenConfigured>
        {({ isLoaded, isSignedIn }) => (
          <span data-testid="state">{`${isLoaded}-${isSignedIn}`}</span>
        )}
      </WithClerkWhenConfigured>,
    );

    expect(mockUseClerkAuth).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('state')).toHaveTextContent('true-true');
  });
});
