const fs = require('fs');
const path = require('path');

describe('campaignApiController list admin scope', () => {
  const controllerPath = path.join(__dirname, '../domains/mail/controllers/campaignApiController.js');
  const source = fs.readFileSync(controllerPath, 'utf8');
  const listBlock = source.split('exports.list = async')[1]?.split('exports.uploadAttachment')[0] || '';

  it('skips createdBy filter for admin users', () => {
    expect(listBlock).toMatch(/isAdminUser\(req\.user\)\s*\?\s*\[\]\s*:\s*\[\{\s*\$match:\s*\{\s*createdBy:\s*userId\s*\}\s*\}\]/);
  });

  it('does not always match createdBy for every user', () => {
    expect(listBlock).not.toMatch(/\{\s*\$match:\s*\{\s*createdBy:\s*userId\s*\}\s*\},\s*\n\s*\{\s*\$addFields/);
  });
});
