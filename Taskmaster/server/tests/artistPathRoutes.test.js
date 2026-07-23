const Person = require('../models/Person');
const PersonHubView = require('../models/PersonHubView');
const PersonIdentifier = require('../models/PersonIdentifier');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const Tenant = require('../models/Tenant');
const { runWithContext } = require('../utils/tenantContext');
const { getPerson, listResponses } = require('../domains/artists/pathRoutes.handlers');
const { buildArtistPathSheetRow, parseCsvRows, sheetValuesToRows } = require('../domains/artists/services/artistPathImportService');

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

  test('lists individual responses with mapped answers for the admin responses view', async () => {
    const defaultTenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'default@example.com',
      status: 'active',
    });
    const person = await Person.create({
      tenantId: defaultTenant._id,
      canonicalName: 'Second Artist',
      nameKey: 'secondartist',
      city: 'Delhi',
    });
    await ArtistPathResponse.create({
      tenantId: defaultTenant._id,
      personId: person._id,
      rawRow: {
        Timestamp: '10/7/2026, 7:30:00 pm',
        FullName: 'Second Artist',
        Email: 'SECOND@EXAMPLE.COM',
        Mobile: '+91 88888 88888',
        Place: 'Delhi',
        StageName: 'Second Stage',
        CoreSkills: 'Production',
      },
    });

    const res = mockResponse();
    await listResponses({ query: { page: '1', limit: '25', search: 'second' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(1);
    expect(payload.data[0].answers).toMatchObject({
      name: 'Second Artist',
      email: 'second@example.com',
      phone: '+918888888888',
      city: 'Delhi',
      stageName: 'Second Stage',
      coreSkills: 'Production',
    });
  });

  test('builds Google Sheet rows in the historical Artist Path column order', () => {
    const row = buildArtistPathSheetRow({
      firstName: 'Asha',
      lastName: 'Rao',
      stageName: 'Asha R',
      place: 'Mumbai',
      mobile: '+91 99999 99999',
      email: 'asha@example.com',
      artistIdentity: 'Singer-songwriter',
      coreSkills: 'Vocals',
      aspirationalGoal: 'Release an EP',
    }, new Date('2026-07-10T14:00:00.000Z'));

    expect(row).toHaveLength(27);
    expect(row.slice(1, 10)).toEqual([
      'Asha Rao',
      'Asha R',
      'Mumbai',
      '',
      '',
      '',
      '+91 99999 99999',
      'asha@example.com',
      'Singer-songwriter',
    ]);
    expect(row[11]).toBe('Vocals');
    expect(row[25]).toBe('Release an EP');
  });

  test('maps Google Sheet values into keyed Artist Path row objects', () => {
    const rows = sheetValuesToRows([
      ['Timestamp', 'FullName', 'Email', 'Mobile', 'CoreSkills'],
      ['10/7/2026, 7:30:00 pm', 'Sheet Artist', 'sheet@example.com', '+91 77777 77777', 'Vocals'],
      ['', '', '', '', ''],
    ]);

    expect(rows).toEqual([{
      Timestamp: '10/7/2026, 7:30:00 pm',
      FullName: 'Sheet Artist',
      Email: 'sheet@example.com',
      Mobile: '+91 77777 77777',
      CoreSkills: 'Vocals',
    }]);
  });

  test('parses public Google Sheet CSV rows with quoted commas', async () => {
    const rows = await parseCsvRows([
      'Timestamp,FullName,Email,ArtistIdentity',
      '"2/5/2026, 6:42:49 PM",CSV Artist,csv@example.com,"Singer, songwriter"',
    ].join('\n'));

    expect(rows).toEqual([{
      Timestamp: '2/5/2026, 6:42:49 PM',
      FullName: 'CSV Artist',
      Email: 'csv@example.com',
      ArtistIdentity: 'Singer, songwriter',
    }]);
  });
});
