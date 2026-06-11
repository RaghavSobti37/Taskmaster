const { isAttendanceExcluded, isExcludedEmail } = require('../../shared/attendanceExcludedUsers');
const { isAttendanceExcluded: isAttendanceExcludedServer } = require('../utils/attendanceUsers');

describe('attendanceExcludedUsers', () => {
  const opsUser = {
    _id: 'ops1',
    name: 'Ops Lead',
    email: 'ops@theshakticollective.in',
    departmentId: { slug: 'operations', name: 'Operations' },
  };

  const activeStaff = {
    _id: 'staff1',
    name: 'Deepank Soni',
    email: 'deepank@theshakticollective.in',
    departmentId: { slug: 'sales', name: 'Sales' },
  };

  it('does not exclude operations department staff', () => {
    expect(isAttendanceExcluded(opsUser)).toBe(false);
  });

  it('excludes seeded E2E test users by email', () => {
    expect(isExcludedEmail('e2e-dept-ops@test.coreknot.local')).toBe(true);
    expect(isAttendanceExcluded({
      name: 'E2E Operations',
      email: 'e2e-dept-ops@test.coreknot.local',
    })).toBe(true);
  });

  it('excludes QA and fixture test inboxes', () => {
    expect(isExcludedEmail('test@example.com')).toBe(true);
    expect(isExcludedEmail('qa-notify@test.coreknot.local')).toBe(true);
    expect(isExcludedEmail('qa-sweep@example.com')).toBe(true);
    expect(isExcludedEmail('exly-test-campaign@example.com')).toBe(true);
  });

  it('excludes legacy demo display names', () => {
    expect(isAttendanceExcluded({ name: 'QA Tester', email: 'someone@company.com' })).toBe(true);
    expect(isAttendanceExcluded({ name: '[E2E] Sandbox', email: 'x@company.com' })).toBe(true);
  });

  it('keeps real staff visible', () => {
    expect(isAttendanceExcluded(activeStaff)).toBe(false);
  });

  it('server wrapper also checks platform-configured user id lists', () => {
    const platformExcluded = {
      _id: '64b2fc63f1a2b3c4d5e6f789',
      name: 'Configured Exclusion',
      email: 'real.person@theshakticollective.in',
    };
    const original = process.env.ATTENDANCE_EXCLUDED_USER_IDS;
    process.env.ATTENDANCE_EXCLUDED_USER_IDS = '64b2fc63f1a2b3c4d5e6f789';
    try {
      expect(isAttendanceExcludedServer(platformExcluded)).toBe(true);
      expect(isAttendanceExcludedServer(activeStaff)).toBe(false);
    } finally {
      if (original == null) delete process.env.ATTENDANCE_EXCLUDED_USER_IDS;
      else process.env.ATTENDANCE_EXCLUDED_USER_IDS = original;
    }
  });
});
