"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api-base";

type Lead = Record<string, string> & { row_index?: number };

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { user?: { id: string } }) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
      fetch(`${API_BASE}/api/leads`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setLeads(d.data || []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const total = leads.length;
  const converted = leads.filter((l) => l.lead_status === "Converted").length;
  const hot = leads.filter((l) => l.lead_status === "Hot").length;
  const warm = leads.filter((l) => l.lead_status === "Warm").length;
  const rate = total ? ((converted / total) * 100).toFixed(1) : "0";

  // Group by webinar_dates
  const byWebinar = leads.reduce<Record<string, Lead[]>>((acc, l) => {
    const w = (l.webinar_dates || "").trim() || "(none)";
    if (!acc[w]) acc[w] = [];
    acc[w].push(l);
    return acc;
  }, {});
  const webinarList = Object.entries(byWebinar).sort(([a], [b]) => a.localeCompare(b));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
        {error}. Ensure demo login and HOLYSHEET_API_KEY are set.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total Leads" value={total} />
        <Card title="Converted" value={converted} />
        <Card title="Hot / Warm" value={`${hot} / ${warm}`} />
        <Card title="Conversion Rate" value={`${rate}%`} />
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leads"
            className="inline-flex items-center px-4 py-3 min-h-[44px] rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
          >
            View all leads →
          </Link>
          {user?.id === "sr05" && (
            <button
              onClick={async () => {
                setSyncing(true);
                setSyncResult(null);
                try {
                  const r = await fetch(`${API_BASE}/api/sync/leads?delay=150`, { method: "POST", credentials: "include" });
                  const d = await r.json();
                  if (r.ok) {
                    const parts = [];
                    if (d.appended) parts.push(`${d.appended} new`);
                    if (d.updated) parts.push(`${d.updated} updated`);
                    if (d.skipped != null && d.skipped) parts.push(`${d.skipped} unchanged`);
                    if (d.updateFailed) parts.push(`${d.updateFailed} failed`);
                    setSyncResult(parts.length ? `Synced: ${parts.join(", ")}` : "Synced (no changes)");
                  } else setSyncResult(d.error || "Sync failed");
                } catch {
                  setSyncResult("Sync failed");
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing}
              className="inline-flex items-center px-4 py-3 min-h-[44px] rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync to Sheet"}
            </button>
          )}
        </div>
        {syncResult && (
          <p className={`text-sm ${syncResult.startsWith("Synced") ? "text-green-600" : "text-amber-600"}`}>
            {syncResult}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">Stats by webinar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-3 pr-4 font-medium">Webinar</th>
                <th className="pb-3 pr-4 font-medium text-right">Leads</th>
                <th className="pb-3 pr-4 font-medium text-right">Converted</th>
                <th className="pb-3 pr-4 font-medium text-right">Hot</th>
                <th className="pb-3 pr-4 font-medium text-right">Warm</th>
                <th className="pb-3 font-medium text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {webinarList.map(([webinar, list]) => {
                const n = list.length;
                const c = list.filter((l) => l.lead_status === "Converted").length;
                const h = list.filter((l) => l.lead_status === "Hot").length;
                const w = list.filter((l) => l.lead_status === "Warm").length;
                const r = n ? ((c / n) * 100).toFixed(1) : "0";
                return (
                  <tr key={webinar} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{webinar}</td>
                    <td className="py-3 pr-4 text-right">{n}</td>
                    <td className="py-3 pr-4 text-right text-green-600">{c}</td>
                    <td className="py-3 pr-4 text-right text-orange-600">{h}</td>
                    <td className="py-3 pr-4 text-right text-amber-600">{w}</td>
                    <td className="py-3 text-right">{r}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
