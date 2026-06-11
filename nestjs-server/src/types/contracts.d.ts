declare module '@coreknot/contracts' {
  import { ZodTypeAny } from 'zod';

  export const attendanceQuery: ZodTypeAny;
  export const attendanceCheckBody: ZodTypeAny;
  export const leaveRequestBody: ZodTypeAny;
  export const leaveRequestsQuery: ZodTypeAny;
  export const leaveReviewBody: ZodTypeAny;
  export const approveAttendanceBody: ZodTypeAny;
  export const upsertAttendanceBody: ZodTypeAny;
}
