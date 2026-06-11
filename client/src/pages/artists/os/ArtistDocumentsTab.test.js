import { describe, it, expect } from 'vitest';
import { getArtistDocumentsDescription } from './ArtistDocumentsTab.jsx';

describe('getArtistDocumentsDescription', () => {
  it('uses artist name when provided', () => {
    const copy = getArtistDocumentsDescription('Yugm');
    expect(copy).toMatch(/Yugm/);
    expect(copy).toMatch(/coming soon/i);
    expect(copy).not.toMatch(/this artist/);
  });

  it('falls back to generic artist copy', () => {
    expect(getArtistDocumentsDescription()).toMatch(/this artist/);
    expect(getArtistDocumentsDescription(null)).toMatch(/this artist/);
    expect(getArtistDocumentsDescription('')).toMatch(/this artist/);
    expect(getArtistDocumentsDescription()).toMatch(/coming soon/i);
  });
});
