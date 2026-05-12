/**
 * Parse next follow-up from lead fields (local timezone).
 * Date: YYYY-MM-DD from <input type="date">; time: HH:mm or empty (defaults 09:00).
 */
export function parseFollowupAt(lead: Record<string, string>): Date | null {
  const d = (lead.next_followup_date ?? "").trim();
  if (!d) return null;
  const t = (lead.next_followup_time ?? "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  const hh = m ? Math.min(23, parseInt(m[1], 10)) : 9;
  const mm = m ? Math.min(59, parseInt(m[2], 10)) : 0;
  const parts = d.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  if (!y || !mo || !da) return null;
  return new Date(y, mo - 1, da, hh, mm, 0, 0);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const IST = "Asia/Kolkata";

/** Calendar date YYYY-MM-DD for an instant in IST. */
export function calendarDayKeyIST(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

/**
 * Interpret stored date + time as Asia/Kolkata (IST), returning an absolute Date.
 * Matches how SDRs think about "follow-up on this day at this time".
 */
export function parseFollowupAtInIST(lead: Record<string, string>): Date | null {
  const d = (lead.next_followup_date ?? "").trim();
  if (!d) return null;
  const t = (lead.next_followup_time ?? "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  const hh = m ? Math.min(23, parseInt(m[1], 10)) : 9;
  const mm = m ? Math.min(59, parseInt(m[2], 10)) : 0;
  const parts = d.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  if (!y || !mo || !da) return null;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  return new Date(iso + "+05:30");
}

export type FollowupBucket = "overdue" | "today" | "upcoming" | "unscheduled";

export function followupBucketIST(
  lead: Record<string, string>,
  now: Date = new Date()
): FollowupBucket {
  const at = parseFollowupAtInIST(lead);
  if (!at) return "unscheduled";
  if (at.getTime() < now.getTime()) return "overdue";
  if (calendarDayKeyIST(at) === calendarDayKeyIST(now)) return "today";
  return "upcoming";
}
