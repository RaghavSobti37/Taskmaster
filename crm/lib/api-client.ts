"use client";

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const u = new URL(path, typeof window !== "undefined" ? window.location.origin : "");
  if (params) {
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  }
  const res = await fetch(u.toString(), { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export async function apiPatch<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export async function apiDelete(path: string, params?: Record<string, string>): Promise<void> {
  const u = new URL(path, typeof window !== "undefined" ? window.location.origin : "");
  if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u.toString(), { method: "DELETE", credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}
