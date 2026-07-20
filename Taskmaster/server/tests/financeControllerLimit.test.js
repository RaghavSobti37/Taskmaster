jest.mock('../models/FinanceDocument', () => ({
  collection: { name: 'financedocuments' },
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]),
  find: jest.fn(),
}));

jest.mock('../models/Project', () => ({}));
jest.mock('../utils/financeOcr', () => ({ scheduleFinanceDocumentOcr: jest.fn() }));
jest.mock('../services/backgroundQueue', () => ({ queueGamificationEvent: jest.fn() }));
jest.mock('../services/financeReferenceService', () => ({
  getNextReferenceNumbers: jest.fn(),
  createReferenceAllocator: jest.fn(),
}));
jest.mock('../utils/uploadthingServer', () => ({
  utapi: {},
  handleUploadFilesManyRequest: jest.fn(),
  handleUploadSingleRequest: jest.fn(),
}));
jest.mock('../utils/financeDiskSync', () => ({ syncFolderPlacementFromDisk: jest.fn() }));
jest.mock('../utils/financeFileProxy', () => ({
  isAllowedFinanceFileUrl: jest.fn(),
  downloadFinanceFile: jest.fn(),
  sendInlineFile: jest.fn(),
}));
jest.mock('../utils/documentParser', () => ({ parseDocument: jest.fn() }));
jest.mock('../utils/financeOcrLimits', () => ({ getOcrMaxBytes: jest.fn(), shouldRunOcr: jest.fn() }));

const FinanceDocument = require('../models/FinanceDocument');
const { getDocuments } = require('../controllers/financeController');

describe('financeController list limits', () => {
  it('clamps excessive document list limits', async () => {
    const req = { query: { limit: '10000', page: '1' } };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getDocuments(req, res);

    const idPipeline = FinanceDocument.aggregate.mock.calls[1][0];
    expect(idPipeline).toContainEqual({ $limit: 100 });
  });
});
