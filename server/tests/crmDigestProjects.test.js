const {
  getCrmDigestSegmentForProject,
  normalizePlanValues,
  CRM_DIGEST_SEGMENTS,
} = require('../../shared/crmDigestProjects');

describe('crmDigestProjects', () => {
  test('getCrmDigestSegmentForProject matches TSC Academy and Films', () => {
    expect(getCrmDigestSegmentForProject({ name: 'TSC Academy', workspace: 'General' })?.key).toBe('academy');
    expect(getCrmDigestSegmentForProject({ name: 'Tsc Films', workspace: 'TSC FILMS' })?.key).toBe('films');
    expect(getCrmDigestSegmentForProject({ name: 'TSC Academy AI POP STAR' })).toBeNull();
  });

  test('normalizePlanValues keeps only known plan keys', () => {
    expect(normalizePlanValues({ 'One-Time': 50000, '3 Mo': 45000, bogus: 1 })).toEqual({
      'One-Time': 50000,
      '3 Mo': 45000,
      '6 Mo': 0,
      '9 Mo': 0,
    });
  });

  test('getCrmDigestSegmentForWorkspace matches TSC workspaces', () => {
    const { getCrmDigestSegmentForWorkspace } = require('../../shared/crmDigestProjects');
    expect(getCrmDigestSegmentForWorkspace('TSC ACADEMY')?.key).toBe('academy');
    expect(getCrmDigestSegmentForWorkspace('TSC FILMS')?.key).toBe('films');
    expect(getCrmDigestSegmentForWorkspace('GENERAL')).toBeNull();
  });

  test('segments define sales vs artist CRM types', () => {
    expect(CRM_DIGEST_SEGMENTS.academy.crmType).toBe('sales');
    expect(CRM_DIGEST_SEGMENTS.films.crmType).toBe('artist');
  });
});
