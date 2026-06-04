const { getDbNameFromUri } = require('../config/database');

describe('trackingUrls local DB mismatch warning', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.resetModules();
  });

  test('warns when MONGODB_URI uses taskmaster_local with public tracking', () => {
    process.env.MONGODB_URI = 'mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/';
    process.env.MONGODB_URI_PROD = 'mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/';
    process.env.TRACKING_BASE_URL = 'https://YOUR-RENDER-SERVICE.onrender.com';
    delete process.env.MAIL_USE_PROD_DB;

    const { getTrackingDbMismatchWarning } = require('../utils/trackingUrls');
    const warning = getTrackingDbMismatchWarning();

    expect(warning).toMatch(/local DB/i);
    expect(warning).toMatch(/taskmaster-jfw0|render\.com/i);
  });

  test('returns null when MAIL_USE_PROD_DB sync is enabled', () => {
    process.env.MONGODB_URI = 'mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/';
    process.env.MONGODB_URI_PROD = 'mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/';
    process.env.TRACKING_BASE_URL = 'https://YOUR-RENDER-SERVICE.onrender.com';
    process.env.MAIL_USE_PROD_DB = 'true';

    const { getTrackingDbMismatchWarning } = require('../utils/trackingUrls');
    expect(getTrackingDbMismatchWarning()).toBeNull();
  });

  test('isLocalDevMongoUri recognizes legacy and current local names', () => {
    const { isLocalDevMongoUri } = require('../utils/trackingUrls');
    expect(isLocalDevMongoUri('mongodb://localhost:27017/taskmaster_local')).toBe(true);
    expect(isLocalDevMongoUri('mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/')).toBe(true);
    expect(isLocalDevMongoUri('mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/')).toBe(false);
    expect(getDbNameFromUri('mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/')).toBe('taskmaster_local');
  });
});
