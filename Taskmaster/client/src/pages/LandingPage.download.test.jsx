import { describe, expect, it } from 'vitest';
import { DESKTOP_BETA_INSTALLERS } from './LandingPage.jsx';

describe('LandingPage desktop beta download', () => {
  it('links directly to Windows and Mac setup files', () => {
    expect(DESKTOP_BETA_INSTALLERS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          os: 'Windows',
          label: 'Download for Windows',
          fileName: 'CoreKnot-Beta-win-x64.exe',
          href: expect.stringContaining('/releases/download/coreknot-beta/CoreKnot-Beta-win-x64.exe'),
        }),
        expect.objectContaining({
          os: 'Mac',
          label: 'Download for Mac',
          fileName: 'CoreKnot-Beta-mac-arm64.dmg',
          href: expect.stringContaining('/releases/download/coreknot-beta/CoreKnot-Beta-mac-arm64.dmg'),
        }),
      ]),
    );
    expect(DESKTOP_BETA_INSTALLERS).toHaveLength(2);
    expect(DESKTOP_BETA_INSTALLERS.map((installer) => installer.href)).not.toContain('/releases/tag/');
  });
});
