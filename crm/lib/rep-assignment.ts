import { getLeads } from "@/lib/csv-store";
import { USERS, normalizeAssignedRepToId } from "@/lib/users";

type LeadLike = Record<string, string>;

export const SDR_IDS = USERS.filter((u) => u.role === "sales_rep").map((u) => u.id);

function isValidSdrId(id: string): boolean {
  return SDR_IDS.includes(id);
}

function pickLeastLoadedRep(counts: Record<string, number>): string {
  return SDR_IDS
    .slice()
    .sort((a, b) => {
      const diff = (counts[a] ?? 0) - (counts[b] ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    })[0];
}

export function resolveAssignedRepId(raw: string): string | null {
  const normalized = normalizeAssignedRepToId(raw || "");
  return isValidSdrId(normalized) ? normalized : null;
}

export function createRepAutoAssigner(existingLeads?: LeadLike[]) {
  const baseLeads = existingLeads ?? getLeads();
  const counts: Record<string, number> = {};
  SDR_IDS.forEach((id) => {
    counts[id] = 0;
  });

  for (const lead of baseLeads) {
    const repId = resolveAssignedRepId(lead.assigned_rep_id || "");
    if (repId) counts[repId] = (counts[repId] ?? 0) + 1;
  }

  return {
    getCurrentCounts(): Record<string, number> {
      return { ...counts };
    },
    assign(rawAssignedRepId?: string): { repId: string; autoAssigned: boolean } {
      const direct = resolveAssignedRepId(rawAssignedRepId || "");
      if (direct) {
        counts[direct] = (counts[direct] ?? 0) + 1;
        return { repId: direct, autoAssigned: false };
      }

      const repId = pickLeastLoadedRep(counts);
      counts[repId] = (counts[repId] ?? 0) + 1;
      return { repId, autoAssigned: true };
    },
  };
}

