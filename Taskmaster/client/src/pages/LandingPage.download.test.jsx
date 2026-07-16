import { describe, expect, it } from 'vitest';
import { DESKTOP_BETA_RELEASE_URL } from './LandingPage.jsx';

describe('LandingPage desktop beta download', () => {
  it('links to the GitHub desktop beta release', () => {
    expect(DESKTOP_BETA_RELEASE_URL).toContain('github.com');
    expect(DESKTOP_BETA_RELEASE_URL).toContain('v1.0.8-beta.2');
  });
});
