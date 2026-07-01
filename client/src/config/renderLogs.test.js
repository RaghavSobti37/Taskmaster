import { describe, expect, it } from 'vitest';
import { getRenderLogTarget, RENDER_SERVICE_ID_DEFAULTS } from './renderLogs';

describe('getRenderLogTarget', () => {
  it('resolves production API logs from built-in service id fallback', () => {
    const target = getRenderLogTarget('production-api');
    expect(target).not.toBeNull();
    expect(target.url).toBe(
      `https://dashboard.render.com/web/${RENDER_SERVICE_ID_DEFAULTS.production}/logs`,
    );
    expect(target.label).toBe('Production API');
  });

  it('resolves staging nest from built-in fallback', () => {
    const target = getRenderLogTarget('staging-nest');
    expect(target?.serviceName).toBe('coreknot-nest-staging');
    expect(target?.url).toContain(RENDER_SERVICE_ID_DEFAULTS.stagingNest);
  });
});
