const fs = require('fs');
const path = require('path');

describe('campaignApiController list access', () => {
  const controllerPath = path.join(__dirname, '../domains/mail/controllers/campaignApiController.js');
  const source = fs.readFileSync(controllerPath, 'utf8');
  const listBlock = source.split('exports.list = async')[1]?.split('exports.uploadAttachment')[0] || '';

  it('lists all org campaigns without createdBy filter', () => {
    expect(listBlock).not.toMatch(/createdBy/);
    expect(listBlock).toMatch(/\$addFields:\s*\{\s*recipientCount/);
  });

  it('allows any authenticated user to access a campaign', () => {
    expect(source).toMatch(/assertCampaignAccess = \(campaign, user\) => Boolean\(campaign && user\)/);
  });
});
