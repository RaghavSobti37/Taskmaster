const fs = require('fs');
const path = require('path');
const {
  UPLOAD_DIR,
  resolveRemoteUrl,
  loadCampaignAttachments,
} = require('../utils/campaignAttachments');

describe('campaignAttachments', () => {
  describe('resolveRemoteUrl', () => {
    it('prefers storageUrl over storageKey', () => {
      expect(resolveRemoteUrl({
        storageUrl: 'https://utfs.io/f/abc',
        storageKey: 'local-key',
      })).toBe('https://utfs.io/f/abc');
    });

    it('returns null when no remote url', () => {
      expect(resolveRemoteUrl({ storageKey: 'disk-file.pdf' })).toBeNull();
    });
  });

  describe('loadCampaignAttachments', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('fetches buffer from storageUrl', async () => {
      const payload = Buffer.from('pdf-bytes');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => payload.buffer.slice(
          payload.byteOffset,
          payload.byteOffset + payload.byteLength,
        ),
      });

      const rows = await loadCampaignAttachments([{
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        storageKey: 'ut-key',
        storageUrl: 'https://utfs.io/f/ut-key',
      }]);

      expect(global.fetch).toHaveBeenCalledWith('https://utfs.io/f/ut-key', expect.any(Object));
      expect(rows).toHaveLength(1);
      expect(rows[0].filename).toBe('doc.pdf');
      expect(rows[0].buffer.toString()).toBe('pdf-bytes');
    });

    it('reads legacy local disk attachment when no storageUrl', async () => {
      const storageKey = `test_${Date.now()}_legacy.pdf`;
      const filePath = path.join(UPLOAD_DIR, storageKey);
      await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.promises.writeFile(filePath, 'local-bytes');

      try {
        const rows = await loadCampaignAttachments([{
          filename: 'legacy.pdf',
          contentType: 'application/pdf',
          storageKey,
        }]);
        expect(rows).toHaveLength(1);
        expect(rows[0].buffer.toString()).toBe('local-bytes');
      } finally {
        await fs.promises.unlink(filePath).catch(() => {});
      }
    });
  });
});
