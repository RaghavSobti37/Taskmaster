const { calculateStats } = require('../workers/statsWorker');
const Lead = require('../models/Lead');
const { aggregateWithTenant } = require('../repositories/aggregateWithTenant');
const { getTenantId } = require('../utils/tenantContext');

jest.mock('../repositories/aggregateWithTenant');
jest.mock('../models/Lead', () => ({
  aggregate: jest.fn(),
  distinct: jest.fn(),
}));

jest.mock('../utils/tenantContext', () => ({
  ...jest.requireActual('../utils/tenantContext'),
  getTenantId: jest.fn(),
}));

describe('statsWorker.calculateStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aggregateWithTenant.mockResolvedValue([
      {
        total: [{ count: 10 }],
        connected: [{ count: 4 }],
        meaningful: [{ count: 3 }],
        warmLeads: [{ count: 2 }],
        converted: [{ count: 1 }],
        totalReps: [{ count: 2 }],
      },
    ]);
  });

  it('delegates Lead aggregation to aggregateWithTenant', async () => {
    await calculateStats({ leadStatus: 'New' });
    expect(aggregateWithTenant).toHaveBeenCalledWith(
      Lead,
      expect.arrayContaining([expect.objectContaining({ $match: { leadStatus: 'New' } })]),
    );
  });

  it('returns normalized metrics from facet result', async () => {
    const stats = await calculateStats({});
    expect(stats).toMatchObject({
      totalLeads: 10,
      convertedLeads: 1,
      warmLeads: 2,
      conversionRate: 10,
      connected: 4,
      totalReps: 2,
    });
  });
});
