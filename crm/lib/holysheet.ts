const getBaseUrl = () =>
  process.env.HOLYSHEET_BASE_URL?.replace(/\/$/, "") ||
  "https://holysheet.soneshjain.com";
const getApiKey = () => process.env.HOLYSHEET_API_KEY || "";

export interface HolysheetGetResponse {
  data: Record<string, string>[];
  count: number;
  timestamp: string;
}

export async function holysheetGet(
  sheet?: string,
  query?: string[]
): Promise<HolysheetGetResponse> {
  const base = getBaseUrl();
  const key = getApiKey();
  if (!key) throw new Error("HOLYSHEET_API_KEY not set");
  const u = new URL(`${base}/api/v1/${key}/rows`);
  if (sheet) u.searchParams.set("sheet", sheet);
  query?.forEach((q) => u.searchParams.append("query", q));
  const res = await fetch(u.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function holysheetPost(
  sheet: string,
  rows: (string | number)[][]
): Promise<{ success: boolean; appended: number }> {
  const base = getBaseUrl();
  const key = getApiKey();
  if (!key) throw new Error("HOLYSHEET_API_KEY not set");
  const res = await fetch(`${base}/api/v1/${key}/rows?sheet=${encodeURIComponent(sheet)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function holysheetPatch(
  rowIndex: number,
  values: Record<string, string | number>,
  sheet?: string
): Promise<{ success: boolean; updated: number }> {
  const base = getBaseUrl();
  const key = getApiKey();
  if (!key) throw new Error("HOLYSHEET_API_KEY not set");
  const body: Record<string, unknown> = { rowIndex, values };
  if (sheet) body.sheet = sheet;
  const res = await fetch(`${base}/api/v1/${key}/rows`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
