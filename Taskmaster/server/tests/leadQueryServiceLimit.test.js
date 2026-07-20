jest.mock('../domains/crm/models/Lead', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
}));

const Lead = require('../domains/crm/models/Lead');
const { fetchLeadsPaginated } = require('../domains/crm/services/leadQueryService');

describe('leadQueryService list limits', () => {
  it('clamps excessive lead list limits', async () => {
    await fetchLeadsPaginated({ role: 'admin' }, { limit: '10000', page: '1' });
    const pipeline = Lead.aggregate.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $limit: 100 });
  });
});
