/** Admin Users ribbon — shared metric helpers */

export const ADMIN_RIBBON_QUERY_OPTS = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
  refetchOnMount: 'always',
};

export const ADMIN_DATA_HUB_FOLDER_OPTS = {
  staleTime: 2 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchInterval: false,
};

export function getTeamConversionPercent(crmStats) {
  const rate = crmStats?.conversionRate;
  if (rate == null || Number.isNaN(Number(rate))) return 0;
  return Number(rate);
}

export function getTotalDataRecords(folderData, crmStats) {
  const hubTotal = folderData?.counts?.all;
  if (typeof hubTotal === 'number' && hubTotal >= 0) return hubTotal;
  return crmStats?.totalLeads ?? 0;
}

export function normalizeRepSummaryPayload(data) {
  if (!data) return { reps: [], avgConversion: 0 };
  if (!Array.isArray(data)) {
    return {
      reps: data.reps || [],
      avgConversion: data.avgConversion ?? 0,
    };
  }
  const totalCount = data.reduce((s, r) => s + (r.count || 0), 0);
  const totalConv = data.reduce((s, r) => s + (r.conv || 0), 0);
  const avgConversion =
    totalCount > 0 ? Math.round((totalConv / totalCount) * 10) / 10 : 0;
  return { reps: data, avgConversion };
}
