import { describe, it, expect } from 'vitest';
import {
  getMobilePageSupport,
  shouldShowMobileBanner,
  isNavDesktopOnly,
  MOBILE_PAGE_LEVEL,
} from './mobilePageSupport';

const FORMER_DESKTOP_PATHS = [
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
];

describe('mobilePageSupport', () => {
  it('never returns DESKTOP level for any known route', () => {
    const paths = [
      ...FORMER_DESKTOP_PATHS,
      '/dashboard',
      '/todo',
      '/management',
      '/management?tab=finance',
      '/projects/proj-1',
      '/artists/artist-1',
    ];

    for (const raw of paths) {
      const [pathname, search = ''] = raw.includes('?') ? raw.split('?') : [raw, ''];
      const support = getMobilePageSupport(pathname, search ? `?${search}` : '');
      expect(support.level, raw).not.toBe(MOBILE_PAGE_LEVEL.DESKTOP);
    }
  });

  it('allows admin and email routes as LIMITED or FULL', () => {
    expect(getMobilePageSupport('/admin/console').level).toBe(MOBILE_PAGE_LEVEL.FULL);
    expect(getMobilePageSupport('/admin/users').level).toBe(MOBILE_PAGE_LEVEL.LIMITED);
    expect(getMobilePageSupport('/emails').level).toBe(MOBILE_PAGE_LEVEL.LIMITED);
  });

  it('finance hub tab is LIMITED but not hidden', () => {
    const support = getMobilePageSupport('/management', '?tab=finance');
    expect(support.level).toBe(MOBILE_PAGE_LEVEL.LIMITED);
  });

  it('shouldShowMobileBanner respects autoBanner flag', () => {
    expect(shouldShowMobileBanner('/emails')).toBe(false);
    expect(shouldShowMobileBanner('/admin/users')).toBe(true);
    expect(shouldShowMobileBanner('/dashboard')).toBe(false);
  });

  it('isNavDesktopOnly is always false', () => {
    expect(isNavDesktopOnly('/emails')).toBe(false);
    expect(isNavDesktopOnly('/admin/console')).toBe(false);
  });
});
