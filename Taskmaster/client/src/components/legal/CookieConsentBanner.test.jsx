import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import CookieConsentBanner from './CookieConsentBanner.jsx';
import { readCookieConsent } from '../../lib/cookieConsent';

const CONSENT_KEY = 'coreknot_cookie_consent_v1';

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${CONSENT_KEY}=; path=/; max-age=0`;
  });

  it('stays hidden when unified cookie consent already exists', () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      version: 1,
      necessary: true,
      analytics: false,
      updatedAt: '2026-06-01T00:00:00.000Z',
    }));

    render(<CookieConsentBanner />);

    expect(screen.queryByText(/uses cookies/i)).not.toBeInTheDocument();
  });

  it('writes unified cookie consent when accepted', async () => {
    render(<CookieConsentBanner />);

    await userEvent.click(screen.getByRole('button', { name: /accept/i }));

    expect(readCookieConsent()?.analytics).toBe(true);
    expect(localStorage.getItem(CONSENT_KEY)).toContain('"analytics":true');
    expect(screen.queryByText(/uses cookies/i)).not.toBeInTheDocument();
  });
});
