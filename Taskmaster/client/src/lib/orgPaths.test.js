import { describe, expect, it } from 'vitest';
import { isReservedOrgSlug, LEGACY_ORG_APP_PATHS } from './orgPaths';

describe('orgPaths legacy workspace routes', () => {
  it('keeps flat workspace settings URLs out of org slug lookup', () => {
    expect(isReservedOrgSlug('workspaces')).toBe(true);
    expect(LEGACY_ORG_APP_PATHS).toContain('/workspaces');
  });
});
