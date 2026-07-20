import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostHogAnalytics from './PostHogAnalytics.jsx';

const capturePostHogEvent = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../../config/posthog', () => ({
  isPostHogConfigured: () => true,
}));

vi.mock('../../lib/posthog', () => ({
  capturePostHogEvent: (...args) => capturePostHogEvent(...args),
  clearPostHogUser: vi.fn(),
  ensurePostHogForConsent: vi.fn(),
  isPostHogEnabled: () => true,
  setPostHogUser: vi.fn(),
}));

describe('PostHogAnalytics', () => {
  beforeEach(() => {
    capturePostHogEvent.mockClear();
  });

  it('does not manually capture pageviews because PostHog auto-captures route changes', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route path="*" element={<PostHogAnalytics />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(capturePostHogEvent).not.toHaveBeenCalledWith('$pageview', expect.anything());
  });
});
