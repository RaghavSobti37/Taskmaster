"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api-base";
import { followupBucketIST } from "@/lib/followup-utils";
import { USERS, getRepDisplayName, normalizeAssignedRepToId } from "@/lib/users";

type Lead = Record<string, string> & { row_index?: number };

// ─── Time window helpers ──────────────────────────────────────────────────────

type Period = "all" | "yesterday" | "this_week" | "last_week" | "last_month";

const PERIOD_LABELS: Record<Period, string> = {
  all: "All Time",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  last_month: "Last Month",
};

function istMidnight(date: Date): Date {
  const s = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Date(s + "T00:00:00+05:30");
}

function getWindowIST(period: Period): { from: Date; to: Date } | null {
  if (period === "all") return null;
  const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const today = istMidnight(new Date());

  if (period === "yesterday") {
    const from = new Date(today.getTime() - 86400_000);
    return { from, to: today };
  }
  if (period === "this_week") {
    const dow = nowIst.getDay(); // 0=Sun
    const daysSinceMon = (dow + 6) % 7;
    const from = new Date(today.getTime() - daysSinceMon * 86400_000);
    return { from, to: new Date(today.getTime() + 86400_000) };
  }
  if (period === "last_week") {
    const dow = nowIst.getDay();
    const daysSinceMon = (dow + 6) % 7;
    const thisMonday = new Date(today.getTime() - daysSinceMon * 86400_000);
    const lastMonday = new Date(thisMonday.getTime() - 7 * 86400_000);
    return { from: lastMonday, to: thisMonday };
  }
  if (period === "last_month") {
    const y = nowIst.getFullYear();
    const m = nowIst.getMonth();
    // handle jan edge case
    const from2 = m === 0
      ? new Date(`${y - 1}-12-01T00:00:00+05:30`)
      : new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00+05:30`);
    const to = new Date(`${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00+05:30`);
    return { from: from2, to };
  }
  return null;
}

function inWindow(lead: Lead, window: { from: Date; to: Date } | null): boolean {
  if (!window) return true;
  const raw = lead.updated_at || lead.created_at || "";
  if (!raw) return false;
  const t = new Date(raw).getTime();
  return t >= window.from.getTime() && t < window.to.getTime();
}

// ─── Metric computation ───────────────────────────────────────────────────────

interface SdrMetrics {
  id: string;
  name: string;
  total: number;
  touched: number;
  connected: number;
  meaningful: number;
  cold: number;
  warm: number;
  hot: number;
  tokenReceived: number;
  converted: number;
  scheduled: number;
  overdue: number;
  unscheduled: number;
  lastUpdated: string | null;
}

function computeMetrics(leads: Lead[], repId: string, name: string, now: Date): SdrMetrics {
  const total = leads.length;
  const touched = leads.filter((l) => l.call_status && l.call_status !== "").length;
  const connected = leads.filter((l) => l.call_status === "Connected").length;
  const meaningful = leads.filter((l) => l.meaningful_connect === "YES").length;
  const cold = leads.filter((l) => l.lead_status === "Cold").length;
  const warm = leads.filter((l) => l.lead_status === "Warm").length;
  const hot = leads.filter((l) => l.lead_status === "Hot").length;
  const tokenReceived = leads.filter((l) => l.lead_status === "Token Received").length;
  const converted = leads.filter((l) => l.lead_status === "Converted").length;

  let scheduled = 0, overdue = 0, unscheduled = 0;
  for (const l of leads) {
    const b = followupBucketIST(l, now);
    if (b === "unscheduled") unscheduled++;
    else if (b === "overdue") overdue++;
    else scheduled++;
  }

  const timestamps = leads.map((l) => l.updated_at || "").filter(Boolean).sort();
  const lastUpdated = timestamps.at(-1) ?? null;

  return { id: repId, name, total, touched, connected, meaningful, cold, warm, hot, tokenReceived, converted, scheduled, overdue, unscheduled, lastUpdated };
}

// ─── SDR IDs to show ─────────────────────────────────────────────────────────

const SDR_USERS = USERS.filter((u) => u.role === "sales_rep");

// ─── Components ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "slate" }: { label: string; value: string | number; sub?: string; color?: "slate" | "green" | "sky" | "amber" | "orange" | "red" }) {
  const colors: Record<string, string> = {
    slate: "text-slate-800",
    green: "text-green-600",
    sky: "text-sky-600",
    amber: "text-amber-600",
    orange: "text-orange-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-slate-600 text-right shrink-0">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-16 text-xs text-slate-700 tabular-nums">
        {value} <span className="text-slate-400">({pct}%)</span>
      </div>
    </div>
  );
}

function DrillDown({ metrics, leads }: { metrics: SdrMetrics; leads: Lead[] }) {
  const rate = metrics.total ? ((metrics.converted / metrics.total) * 100).toFixed(1) : "0";
  const touchRate = metrics.total ? ((metrics.touched / metrics.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Assigned" value={metrics.total} />
        <StatCard label="Touched" value={metrics.touched} sub={`${touchRate}% touch rate`} color="sky" />
        <StatCard label="Connected" value={metrics.connected} color="sky" />
        <StatCard label="Meaningful Connect" value={metrics.meaningful} color="sky" />
        <StatCard label="Warm" value={metrics.warm} color="amber" />
        <StatCard label="Hot" value={metrics.hot} color="orange" />
        <StatCard label="Converted" value={metrics.converted} sub={`${rate}% conv. rate`} color="green" />
        <StatCard label="Token Received" value={metrics.tokenReceived} color="green" />
      </div>

      {/* Funnel */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold text-slate-800">Funnel</h3>
        <div className="space-y-2">
          <FunnelBar label="Total" value={metrics.total} max={metrics.total} color="bg-slate-400" />
          <FunnelBar label="Touched" value={metrics.touched} max={metrics.total} color="bg-sky-400" />
          <FunnelBar label="Connected" value={metrics.connected} max={metrics.total} color="bg-sky-500" />
          <FunnelBar label="Meaningful" value={metrics.meaningful} max={metrics.total} color="bg-indigo-400" />
          <FunnelBar label="Cold" value={metrics.cold} max={metrics.total} color="bg-slate-400" />
          <FunnelBar label="Warm" value={metrics.warm} max={metrics.total} color="bg-amber-400" />
          <FunnelBar label="Hot" value={metrics.hot} max={metrics.total} color="bg-orange-500" />
          <FunnelBar label="Token Received" value={metrics.tokenReceived} max={metrics.total} color="bg-emerald-400" />
          <FunnelBar label="Converted" value={metrics.converted} max={metrics.total} color="bg-green-500" />
        </div>
      </div>

      {/* Follow-up health */}
      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Follow-up Health</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-center">
            <div className="text-2xl font-bold text-sky-700">{metrics.scheduled}</div>
            <div className="text-xs text-sky-600 mt-1">Scheduled</div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{metrics.overdue}</div>
            <div className="text-xs text-red-500 mt-1">Overdue</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
            <div className="text-2xl font-bold text-slate-500">{metrics.unscheduled}</div>
            <div className="text-xs text-slate-400 mt-1">Unscheduled</div>
          </div>
        </div>
        {metrics.lastUpdated && (
          <p className="text-xs text-slate-400 mt-3">
            Last activity: {new Date(metrics.lastUpdated).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
      </div>

      {/* Lead table */}
      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Lead breakdown <span className="text-slate-400 font-normal text-sm">({leads.length})</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium">Phone</th>
                <th className="pb-2 pr-3 font-medium">Call Status</th>
                <th className="pb-2 pr-3 font-medium">Connect</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Quality</th>
                <th className="pb-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.row_id || l.row_index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-800">{l.name || "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{l.phone || "—"}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge value={l.call_status} />
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge value={l.meaningful_connect} />
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge value={l.lead_status} />
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{l.lead_quality || "—"}</td>
                  <td className="py-2 text-slate-400 text-xs tabular-nums">
                    {l.updated_at ? new Date(l.updated_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length === 0 && (
            <p className="text-slate-400 text-sm py-4 text-center">No leads in this window.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  if (!value) return <span className="text-slate-300">—</span>;

  const colorMap: Record<string, string> = {
    Connected: "bg-sky-100 text-sky-700",
    "Switch Off/Wrong Number": "bg-slate-100 text-slate-500",
    DNP: "bg-slate-100 text-slate-500",
    Busy: "bg-amber-100 text-amber-700",
    YES: "bg-green-100 text-green-700",
    NO: "bg-red-100 text-red-600",
    Converted: "bg-green-100 text-green-700",
    Hot: "bg-orange-100 text-orange-700",
    Warm: "bg-amber-100 text-amber-700",
    Cold: "bg-slate-100 text-slate-600",
    "Token Received": "bg-emerald-100 text-emerald-700",
    "Not Interested": "bg-red-100 text-red-600",
  };

  const cls = colorMap[value] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

function SummaryTable({ allMetrics }: { allMetrics: SdrMetrics[] }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-800 mb-3">All SDRs — overview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="pb-3 pr-4 font-medium">SDR</th>
              <th className="pb-3 pr-4 font-medium text-right">Assigned</th>
              <th className="pb-3 pr-4 font-medium text-right">Touched</th>
              <th className="pb-3 pr-4 font-medium text-right">Connected</th>
              <th className="pb-3 pr-4 font-medium text-right">Meaningful</th>
              <th className="pb-3 pr-4 font-medium text-right">Cold</th>
              <th className="pb-3 pr-4 font-medium text-right text-amber-600">Warm</th>
              <th className="pb-3 pr-4 font-medium text-right text-orange-600">Hot</th>
              <th className="pb-3 pr-4 font-medium text-right text-green-600">Converted</th>
              <th className="pb-3 pr-4 font-medium text-right text-red-500">Overdue</th>
              <th className="pb-3 font-medium text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {allMetrics.map((m) => {
              const rate = m.total ? ((m.converted / m.total) * 100).toFixed(1) : "0";
              return (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-800">{m.name}</td>
                  <td className="py-3 pr-4 text-right">{m.total}</td>
                  <td className="py-3 pr-4 text-right text-sky-600">{m.touched}</td>
                  <td className="py-3 pr-4 text-right text-sky-700">{m.connected}</td>
                  <td className="py-3 pr-4 text-right text-indigo-600">{m.meaningful}</td>
                  <td className="py-3 pr-4 text-right text-slate-500">{m.cold}</td>
                  <td className="py-3 pr-4 text-right text-amber-600">{m.warm}</td>
                  <td className="py-3 pr-4 text-right text-orange-600">{m.hot}</td>
                  <td className="py-3 pr-4 text-right text-green-600">{m.converted}</td>
                  <td className={`py-3 pr-4 text-right ${m.overdue > 0 ? "text-red-500 font-medium" : "text-slate-400"}`}>{m.overdue}</td>
                  <td className="py-3 text-right font-medium">{rate}%</td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals row */}
          {allMetrics.length > 1 && (() => {
            const t = allMetrics.reduce(
              (acc, m) => ({
                total: acc.total + m.total,
                touched: acc.touched + m.touched,
                connected: acc.connected + m.connected,
                meaningful: acc.meaningful + m.meaningful,
                cold: acc.cold + m.cold,
                warm: acc.warm + m.warm,
                hot: acc.hot + m.hot,
                converted: acc.converted + m.converted,
                overdue: acc.overdue + m.overdue,
              }),
              { total: 0, touched: 0, connected: 0, meaningful: 0, cold: 0, warm: 0, hot: 0, converted: 0, overdue: 0 }
            );
            const tRate = t.total ? ((t.converted / t.total) * 100).toFixed(1) : "0";
            return (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-3 pr-4 text-slate-700">Total</td>
                  <td className="py-3 pr-4 text-right">{t.total}</td>
                  <td className="py-3 pr-4 text-right text-sky-600">{t.touched}</td>
                  <td className="py-3 pr-4 text-right text-sky-700">{t.connected}</td>
                  <td className="py-3 pr-4 text-right text-indigo-600">{t.meaningful}</td>
                  <td className="py-3 pr-4 text-right text-slate-500">{t.cold}</td>
                  <td className="py-3 pr-4 text-right text-amber-600">{t.warm}</td>
                  <td className="py-3 pr-4 text-right text-orange-600">{t.hot}</td>
                  <td className="py-3 pr-4 text-right text-green-600">{t.converted}</td>
                  <td className={`py-3 pr-4 text-right ${t.overdue > 0 ? "text-red-500" : "text-slate-400"}`}>{t.overdue}</td>
                  <td className="py-3 text-right">{tRate}%</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdrReportPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [selectedRep, setSelectedRep] = useState<string>("all");
  const [now] = useState(() => new Date());

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

  const window = useMemo(() => getWindowIST(period), [period]);

  const filteredLeads = useMemo(
    () => leads.filter((l) => inWindow(l, window)),
    [leads, window]
  );

  const allMetrics = useMemo(() => {
    return SDR_USERS.map((u) => {
      const repLeads = filteredLeads.filter(
        (l) => normalizeAssignedRepToId(l.assigned_rep_id || "") === u.id
      );
      return computeMetrics(repLeads, u.id, u.name, now);
    });
  }, [filteredLeads, now]);

  const drillLeads = useMemo(() => {
    if (selectedRep === "all") return filteredLeads;
    return filteredLeads.filter(
      (l) => normalizeAssignedRepToId(l.assigned_rep_id || "") === selectedRep
    );
  }, [filteredLeads, selectedRep]);

  const drillMetrics = useMemo(() => {
    if (selectedRep === "all") {
      const totals = allMetrics.reduce(
        (acc, m) => ({
          id: "all",
          name: "All SDRs",
          total: acc.total + m.total,
          touched: acc.touched + m.touched,
          connected: acc.connected + m.connected,
          meaningful: acc.meaningful + m.meaningful,
          cold: acc.cold + m.cold,
          warm: acc.warm + m.warm,
          hot: acc.hot + m.hot,
          tokenReceived: acc.tokenReceived + m.tokenReceived,
          converted: acc.converted + m.converted,
          scheduled: acc.scheduled + m.scheduled,
          overdue: acc.overdue + m.overdue,
          unscheduled: acc.unscheduled + m.unscheduled,
          lastUpdated: acc.lastUpdated && m.lastUpdated
            ? (acc.lastUpdated > m.lastUpdated ? acc.lastUpdated : m.lastUpdated)
            : acc.lastUpdated || m.lastUpdated,
        }),
        { id: "all", name: "All SDRs", total: 0, touched: 0, connected: 0, meaningful: 0, cold: 0, warm: 0, hot: 0, tokenReceived: 0, converted: 0, scheduled: 0, overdue: 0, unscheduled: 0, lastUpdated: null as string | null }
      );
      return totals;
    }
    const u = SDR_USERS.find((u) => u.id === selectedRep);
    return computeMetrics(drillLeads, selectedRep, u?.name ?? selectedRep, now);
  }, [allMetrics, selectedRep, drillLeads, now]);

  if (loading) {
    return <div className="text-slate-500 py-8">Loading SDR report…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
        {error}
      </div>
    );
  }

  const windowLabel = window
    ? `${window.from.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} — ${window.to.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}`
    : "All time";

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">SDR Report</h1>
        <p className="text-sm text-slate-500 mt-1">
          Input &amp; output metrics per sales rep. Data window: <span className="font-medium text-slate-700">{windowLabel}</span> · {filteredLeads.length} leads
        </p>
      </div>

      {/* Time filter */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              period === p
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-slate-600 border-slate-300 hover:border-sky-400 hover:text-sky-700"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* SDR selector */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedRep("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selectedRep === "all"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
          }`}
        >
          All SDRs
        </button>
        {SDR_USERS.map((u) => {
          const m = allMetrics.find((x) => x.id === u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedRep(u.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedRep === u.id
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
              }`}
            >
              {u.name.split(" ")[0]}
              {m && m.total > 0 && (
                <span className={`ml-1.5 text-xs ${selectedRep === u.id ? "text-slate-300" : "text-slate-400"}`}>
                  ({m.total})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mode A: All SDRs summary table + drill-down of aggregated */}
      {selectedRep === "all" && (
        <>
          <SummaryTable allMetrics={allMetrics} />
          <div className="pt-1">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Aggregate view — All SDRs</h2>
            <DrillDown metrics={drillMetrics} leads={drillLeads} />
          </div>
        </>
      )}

      {/* Mode B: Individual SDR drill-down */}
      {selectedRep !== "all" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            {getRepDisplayName(selectedRep)}
          </h2>
          <DrillDown metrics={drillMetrics} leads={drillLeads} />
        </div>
      )}
    </div>
  );
}
