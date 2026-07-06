const { corsOptions } = require('../app/cors');

describe('cors allowedHeaders', () => {
  it('allows auth session probe headers from cross-origin desktop clients', () => {
    const allowed = corsOptions.allowedHeaders.map((h) => h.toLowerCase());
    expect(allowed).toContain('x-silent-auth-probe');
    expect(allowed).toContain('x-skip-toast');
  });
});
