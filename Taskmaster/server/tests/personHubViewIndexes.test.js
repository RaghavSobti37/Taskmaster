const PersonHubView = require('../models/PersonHubView');

function indexByName(name) {
  return PersonHubView.schema.indexes().find(([, options]) => options?.name === name);
}

describe('PersonHubView identity indexes', () => {
  it('uses partial unique email/phone indexes so null identities do not collide', () => {
    const emailIndex = indexByName('tenantId_1_email_1');
    const phoneIndex = indexByName('tenantId_1_phone_1');

    expect(emailIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { email: { $exists: true, $type: 'string', $gt: '' } },
    });
    expect(phoneIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { phone: { $exists: true, $type: 'string', $gt: '' } },
    });
  });
});
