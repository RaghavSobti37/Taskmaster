const { assertProdDataTarget } = require('../utils/assertProdDataTarget');
const { isProdLikeDbName } = require('../config/database');

describe('assertProdDataTarget', () => {
  it('allows production-like database names', () => {
    expect(() => assertProdDataTarget({ name: 'taskmaster_production' })).not.toThrow();
    expect(isProdLikeDbName('taskmaster_production')).toBe(true);
  });

  it('blocks local/test databases', () => {
    expect(() => assertProdDataTarget({ name: 'taskmaster_local' })).toThrow(/production-only/);
    expect(() => assertProdDataTarget({ name: 'testing' })).toThrow(/PROD_DATA_REQUIRED|production-only/);
  });
});
