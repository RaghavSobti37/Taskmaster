import { describe, it, expect, vi, afterEach } from 'vitest';
import { isStagingPreviewOnProdDb, pointsAtProductionApi } from './stagingPreview';

describe('stagingPreview', () => {
  const env = import.meta.env;

  afterEach(() => {
    vi.unstubAllGlobals();
    env.VITE_API_URL = '';
  });

  it('detects production API URL', () => {
    env.VITE_API_URL = 'https://coreknot-api.onrender.com';
    expect(pointsAtProductionApi()).toBe(true);
  });

  it('is false for localhost API', () => {
    env.VITE_API_URL = 'http://localhost:5000';
    expect(pointsAtProductionApi()).toBe(false);
  });

  it('is true on vercel.app with prod API', () => {
    env.VITE_API_URL = 'https://coreknot-api.onrender.com';
    vi.stubGlobal('window', {
      location: { hostname: 'taskmaster-git-staging.vercel.app' },
    });
    expect(isStagingPreviewOnProdDb()).toBe(true);
  });

  it('is false on production app host', () => {
    env.VITE_API_URL = 'https://coreknot-api.onrender.com';
    vi.stubGlobal('window', {
      location: { hostname: 'tsccoreknot.com' },
    });
    expect(isStagingPreviewOnProdDb()).toBe(false);
  });
});
