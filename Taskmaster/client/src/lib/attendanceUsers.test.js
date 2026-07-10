import { describe, it, expect } from 'vitest';
import { isAttendanceExcluded } from '../utils/attendanceUsers';

describe('attendanceUsers', () => {
  it('shows operations department on roster', () => {
    expect(isAttendanceExcluded({
      name: 'Ops Lead',
      email: 'ops@theshakticollective.in',
      departmentId: { slug: 'operations' },
    })).toBe(false);
  });

  it('hides E2E and QA automation accounts', () => {
    expect(isAttendanceExcluded({
      name: 'E2E Sales',
      email: 'e2e-dept-sales@test.coreknot.local',
    })).toBe(true);
    expect(isAttendanceExcluded({
      name: 'Fixture',
      email: 'test@example.com',
    })).toBe(true);
  });
});
