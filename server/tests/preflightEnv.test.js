/**
 * Pre-flight script contract — retired host detection.
 */
describe('preflightEnv retired hosts', () => {
  const runChecks = (envOverrides = {}) => {
    const errors = [];
    const RETIRED = ['YOUR-RENDER-SERVICE.onrender.com'];
    const check = (label, url) => {
      if (!url) return;
      const lower = url.toLowerCase();
      for (const bad of RETIRED) {
        if (lower.includes(bad)) errors.push(`${label} uses retired host`);
      }
    };
    const env = (k) => (envOverrides[k] || '').trim();
    check('TRACKING_BASE_URL', env('TRACKING_BASE_URL'));
    check('SERVER_URL', env('SERVER_URL'));
    return errors;
  };

  test('flags retired tracking host', () => {
    const errors = runChecks({
      TRACKING_BASE_URL: 'https://YOUR-RENDER-SERVICE.onrender.com',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('allows env-configured API host', () => {
    const errors = runChecks({
      TRACKING_BASE_URL: 'https://api.example.test',
      SERVER_URL: 'https://api.example.test',
    });
    expect(errors).toHaveLength(0);
  });
});
