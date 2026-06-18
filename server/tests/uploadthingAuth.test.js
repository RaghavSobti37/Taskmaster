const { protectUploadthingClient } = require('../middleware/uploadthingAuth');
const { protect } = require('../middleware/authMiddleware');

jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((_req, _res, next) => next()),
}));

describe('protectUploadthingClient', () => {
  beforeEach(() => {
    protect.mockClear();
  });

  test('skips protect for UploadThing callback hooks', () => {
    const req = { headers: { 'uploadthing-hook': 'callback' } };
    const next = jest.fn();
    protectUploadthingClient(req, {}, next);
    expect(protect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('delegates to protect for client upload requests', () => {
    const req = { headers: {} };
    const res = {};
    const next = jest.fn();
    protectUploadthingClient(req, res, next);
    expect(protect).toHaveBeenCalledWith(req, res, next);
  });
});
