const fs = require('fs');
const path = require('path');

describe('announcement email telemetry boundary', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/announcementRoutes.js'), 'utf8');

  test('does not inject CoreKnot open pixels into announcement emails', () => {
    expect(source).not.toContain('/api/announcements/track/open');
    expect(source).not.toContain('width="1" height="1"');
  });

  test('keeps the retired open endpoint as a moved contract', () => {
    expect(source).toContain("router.get('/track/open/:announcementId/:recipientId'");
    expect(source).toContain('Announcement open tracking moved to Auto-Mailer telemetry');
    expect(source).toContain("service: 'auto-mailer'");
  });
});
