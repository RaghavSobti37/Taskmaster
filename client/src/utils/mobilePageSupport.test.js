import { describe, it, expect } from 'vitest';
import {
  getMobilePageSupport,
  shouldShowMobileBanner,
  isNavDesktopOnly,
  MOBILE_PAGE_LEVEL,
} from './mobilePageSupport';

const APP_PATHS = [
  '/admin/console',
  '/admin/users',
  '/emails',
  '/emails/create',
  '/workflows',
  '/components',
  '/campaign/test-id',
  '/projects/abc123/analytics',
  '/office-assets',
  '/features',
  '/projects/new',
  '/workspaces/ws-1',
  '/schedule',
  '/dashboard',
  '/todo',
  '/management',
  '/management?tab=finance',
  '/projects/proj-1',
  '/artists/artist-1',
];

describe('mobilePageSupport', () => {
  it('treats all app routes as fully mobile-supported', () => {
    for (const raw of APP_PATHS) {
      const [pathname, search = ''] = raw.includes('?') ? raw.split('?') : [raw, ''];
      const support = getMobilePageSupport(pathname, search ? `?${search}` : '');
      expect(support.level, raw).toBe(MOBILE_PAGE_LEVEL.FULL);
      expect(support.autoBanner, raw).toBe(false);
    }
  });

  it('never shows desktop-recommended banners', () => {
    expect(shouldShowMobileBanner('/admin/users')).toBe(false);
    expect(shouldShowMobileBanner('/emails')).toBe(false);
    expect(shouldShowMobileBanner('/dashboard')).toBe(false);
  });

  it('isNavDesktopOnly is always false', () => {
    expect(isNavDesktopOnly('/emails')).toBe(false);
    expect(isNavDesktopOnly('/admin/console')).toBe(false);
  });
});
