import { describe, it, expect } from 'vitest';
import {
  buildShareMessage,
  buildWhatsAppShareUrl,
  buildEmailShareUrl,
  resolveArtistShareUrl,
} from './artistShareLinks';

describe('artistShareLinks', () => {
  it('builds share message with artist name and url', () => {
    const msg = buildShareMessage('Nova Ray', 'https://app.test/artist/nova-ray');
    expect(msg).toContain('Nova Ray');
    expect(msg).toContain('https://app.test/artist/nova-ray');
  });

  it('builds WhatsApp url with encoded message', () => {
    const url = buildWhatsAppShareUrl('Hello world');
    expect(url).toBe('https://wa.me/?text=Hello%20world');
  });

  it('builds mailto url with subject and body', () => {
    const url = buildEmailShareUrl('Artist profile', 'Line one\nLine two');
    expect(url).toMatch(/^mailto:\?/);
    expect(url).toContain('subject=Artist%20profile');
    expect(url).toContain('body=Line%20one');
  });

  it('prefers api url over slug fallback', () => {
    const url = resolveArtistShareUrl({
      origin: 'https://app.test',
      artistId: 'abc',
      artistSlug: 'nova-ray',
      apiUrl: 'https://app.test/preview/artist/abc?token=xyz',
    });
    expect(url).toBe('https://app.test/preview/artist/abc?token=xyz');
  });

  it('falls back to public slug when api url missing', () => {
    const url = resolveArtistShareUrl({
      origin: 'https://app.test',
      artistId: 'abc',
      artistSlug: 'nova-ray',
    });
    expect(url).toBe('https://app.test/artist/nova-ray');
  });
});
