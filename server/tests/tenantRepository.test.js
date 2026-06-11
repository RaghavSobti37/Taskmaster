const { tenantIdFilter } = require('../utils/mongoId');
const { withTenantFilter } = require('../repositories/tenantQuery');
const { createTenantRepository } = require('../repositories/createTenantRepository');
const { aggregateWithTenant } = require('../repositories/aggregateWithTenant');
const { getTenantId } = require('../utils/tenantContext');

jest.mock('../utils/tenantContext', () => ({
  ...jest.requireActual('../utils/tenantContext'),
  getTenantId: jest.fn(),
}));

describe('createTenantRepository', () => {
  const mockModel = {
    find: jest.fn(() => ({ setOptions: jest.fn().mockReturnThis() })),
    findOne: jest.fn(() => ({ setOptions: jest.fn().mockReturnThis() })),
    countDocuments: jest.fn(() => ({ setOptions: jest.fn().mockReturnThis() })),
    aggregate: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(() => ({ setOptions: jest.fn().mockReturnThis() })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges tenant filter on find', () => {
    const repo = createTenantRepository(mockModel);
    repo.find({ status: 'open' }, { tenantId: 'abc' });
    expect(mockModel.find).toHaveBeenCalledWith(
      withTenantFilter({ status: 'open' }, { tenantId: 'abc' }),
    );
  });

  it('prepends tenant $match on aggregate when scoped', () => {
    const repo = createTenantRepository(mockModel);
    repo.aggregate([{ $group: { _id: null } }], { tenantId: 'abc' });
    expect(mockModel.aggregate).toHaveBeenCalledWith([
      { $match: tenantIdFilter('abc') },
      { $group: { _id: null } },
    ]);
  });
});

describe('aggregateWithTenant', () => {
  const mockModel = {
    aggregate: jest.fn(() => ({ option: jest.fn().mockReturnThis() })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getTenantId.mockReturnValue(null);
  });

  it('prepends tenant $match from AsyncLocalStorage context', async () => {
    getTenantId.mockReturnValue('tenant-ctx');
    await aggregateWithTenant(mockModel, [{ $count: 'n' }]);
    expect(mockModel.aggregate).toHaveBeenCalledWith([
      { $match: tenantIdFilter('tenant-ctx') },
      { $count: 'n' },
    ]);
  });

  it('skips tenant match when bypass is true', async () => {
    await aggregateWithTenant(mockModel, [{ $count: 'n' }], { bypass: true, reason: 'test' });
    expect(mockModel.aggregate).toHaveBeenCalledWith([{ $count: 'n' }]);
  });
});
