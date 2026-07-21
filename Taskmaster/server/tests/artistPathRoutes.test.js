const Person = require('../models/Person');
const PersonHubView = require('../models/PersonHubView');
const PersonIdentifier = require('../models/PersonIdentifier');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const Tenant = require('../models/Tenant');
const { runWithContext } = require('../utils/tenantContext');
const { getPerson } = require('../domains/artists/pathRoutes.handlers');

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Artist Path detail route', () => {
  test('returns default-tenant person details and mapped Artist Path answers inside org context', async () => {
    const defaultTenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'default@example.com',
      status: 'active',
    });
    const orgTenant = await Tenant.create({
      name: 'Org Tenant',
      contactEmail: 'org@example.com',
      status: 'active',
    });

    const person = await Person.create({
      tenantId: defaultTenant._id,
      canonicalName: 'Artist Path One',
      nameKey: 'artistpathone',
      city: 'Mumbai',
    });
    await PersonIdentifier.create({
      tenantId: defaultTenant._id,
      personId: person._id,
      type: 'email',
      valueNormalized: 'artist@example.com',
    });
    await PersonIdentifier.create({
      tenantId: defaultTenant._id,
      personId: person._id,
      type: 'phone',
      valueNormalized: '+919999999999',
    });
    await PersonHubView.create({
      tenantId: defaultTenant._id,
      personId: person._id,
      name: 'Artist Path One',
      email: 'artist@example.com',
      phone: '+919999999999',
      inArtistPath: true,
    });
    await ArtistPathResponse.create({
      tenantId: defaultTenant._id,
      personId: person._id,
      answers: { source: 'sheet' },
      rawRow: {
        FullName: 'Artist Path One',
        Email: 'ARTIST@EXAMPLE.COM',
        Mobile: '+91 99999 99999',
        Place: 'Mumbai',
        ArtistIdentity: 'Singer-songwriter',
        CoreSkills: 'Vocals, guitar',
        AspirationalGoal: 'Tour internationally',
      },
    });

    const res = mockResponse();
    await runWithContext({ tenantId: orgTenant._id.toString() }, () => getPerson({
      params: { personId: person._id.toString() },
    }, res));

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.person.canonicalName).toBe('Artist Path One');
    expect(payload.identifiers).toHaveLength(2);
    expect(payload.email).toBe('artist@example.com');
    expect(payload.phone).toBe('+919999999999');
    expect(payload.responses[0].answers).toMatchObject({
      name: 'Artist Path One',
      email: 'artist@example.com',
      phone: '+919999999999',
      city: 'Mumbai',
      artistIdentity: 'Singer-songwriter',
      coreSkills: 'Vocals, guitar',
      aspirationalGoal: 'Tour internationally',
      source: 'sheet',
    });
  });
});
