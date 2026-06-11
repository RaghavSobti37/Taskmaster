export type TimeRecord = {
  systemTimestamp?: Date | string;
  manualTimestamp?: string;
  workMode?: string;
  isApproved?: boolean;
  approvedBy?: string;
  checkInIp?: string;
  checkOutIp?: string;
  verificationMethod?: string;
};

export function asTimeRecord(value: unknown): TimeRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as TimeRecord;
}
