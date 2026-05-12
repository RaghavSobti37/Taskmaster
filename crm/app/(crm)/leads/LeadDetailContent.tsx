"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format-date";
import { API_BASE } from "@/lib/api-base";

export type Lead = Record<string, string> & { row_index?: number };

const STATUS_OPTS = [
  "Not Interested",
  "Cold",
  "Warm",
  "Hot",
  "Token Received",
  "Converted",
];
const QUALITY_OPTS = ["4", "3", "2", "1", "Future 4"];
const CALL_OPTS = ["DNP", "Switch Off/Wrong Number", "Busy", "Connected"];
const CONNECT_OPTS = ["YES", "NO"];
const PLAN_OPTS = ["One-Time", "3 Mo", "6 Mo", "9 Mo"];

export interface LeadDetailContentProps {
  rowIndex: number;
  onClose?: () => void;
  onLeadUpdated?: (updates: Partial<Lead>) => void;
  /** When true, show a close button and tighter spacing for side pane */
  compact?: boolean;
}

export default function LeadDetailContent({
  rowIndex,
  onClose,
  onLeadUpdated,
  compact = false,
}: LeadDetailContentProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [updates, setUpdates] = useState<Partial<Lead>>({});

  useEffect(() => {
    fetch(`${API_BASE}/api/users`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setUsers(d.data || []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/leads/${rowIndex}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setLead(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [rowIndex]);

  const handleChange = (field: string, value: string) => {
    setUpdates((u) => ({ ...u, [field]: value }));
  };

  const save = async () => {
    if (Object.keys(updates).length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/leads/${rowIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setLead((prev) => (prev ? ({ ...prev, ...updates } as Lead) : prev));
      onLeadUpdated?.(updates);
      setUpdates({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 py-8">Loading...</div>;
  if (error && !lead) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        {error}{" "}
        {onClose ? (
          <button type="button" onClick={onClose} className="text-sky-600 underline">
            Close
          </button>
        ) : (
          <Link href="/leads" className="text-sky-600 underline">
            Back to leads
          </Link>
        )}
      </div>
    );
  }
  if (!lead) return null;

  const v = (k: string) => updates[k] ?? lead[k] ?? "";
  const sel = (k: string, opts: string[]) => (
    <select
      value={v(k)}
      onChange={(e) => handleChange(k, e.target.value)}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full"
    >
      <option value="">—</option>
      {opts.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  const spacing = compact ? "space-y-4" : "space-y-6";
  const maxW = compact ? "max-w-none" : "max-w-2xl";

  return (
    <div className={`${spacing} ${maxW}`}>
      <div className="flex items-center gap-4 flex-wrap">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 font-medium"
          >
            ✕ Close
          </button>
        ) : (
          <Link href="/leads" className="text-slate-500 hover:text-slate-800">
            ← Leads
          </Link>
        )}
        <h1 className="text-xl font-bold text-slate-800">Lead #{rowIndex}</h1>
        {lead.name && (
          <span className="text-slate-600">{lead.name}</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm">
          {error}
        </div>
      )}

      <section className="rounded-xl bg-white border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">Lead info (auto-generated)</h2>
        <p className="text-xs text-slate-500">These fields come from webinar/import; not editable here.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Row ID" value={lead.row_id} />
          <ReadOnlyField label="Customer ID (Exly)" value={lead.customer_id_exly} />
          <ReadOnlyField label="Transaction ID (Exly)" value={lead.transaction_id_exly} />
          <ReadOnlyField label="Name" value={lead.name} />
          <ReadOnlyField label="Email" value={lead.email} />
          <ReadOnlyField label="Phone" value={lead.phone} />
          <ReadOnlyField label="Webinar Dates" value={lead.webinar_dates} />
          <ReadOnlyField label="Attended" value={lead.attended} />
          <ReadOnlyField label="Attendance (min)" value={lead.attendance_duration_min} />
          <ReadOnlyField label="Created" value={formatDateTime(lead.created_at)} />
          <ReadOnlyField label="Updated" value={formatDateTime(lead.updated_at)} />
        </div>
      </section>

      <EmiSection leadRowId={lead.row_id} />

      <section className="rounded-xl bg-white border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">Artist & journey (from source, read-only)</h2>
        <p className="text-xs text-slate-500">Populated from webinar/import. Empty if not provided.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Artist Type" value={lead.artist_type} />
          <ReadOnlyField label="Full-Time Willingness" value={lead.full_time_willingness} />
          <ReadOnlyField label="Primary Role" value={lead.primary_role} />
          <ReadOnlyField label="Learning Goal" value={lead.learning_goal} />
          <ReadOnlyField label="Learned Music" value={lead.learned_music} />
          <ReadOnlyField label="Q&A Answered" value={lead.qna_answered} />
          <div className="sm:col-span-2">
            <ReadOnlyField label="Current Journey" value={lead.current_journey} />
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white border border-slate-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800">Sales funnel (edit here)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Assigned Rep</label>
            <select
              value={v("assigned_rep_id")}
              onChange={(e) => handleChange("assigned_rep_id", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Meaningful Connect</label>
            {sel("meaningful_connect", CONNECT_OPTS)}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Lead Quality</label>
            {sel("lead_quality", QUALITY_OPTS)}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Call Status</label>
            {sel("call_status", CALL_OPTS)}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Lead Status</label>
            {sel("lead_status", STATUS_OPTS)}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Plan</label>
            {sel("plan_option", PLAN_OPTS)}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Next follow-up date</label>
            <input
              type="date"
              value={v("next_followup_date")}
              onChange={(e) => handleChange("next_followup_date", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Next follow-up time</label>
            <input
              type="time"
              value={v("next_followup_time")}
              onChange={(e) => handleChange("next_followup_time", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full"
            />
            <p className="text-xs text-slate-400 mt-1">
              Optional; Followups uses 9:00 if time is empty.
            </p>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Remarks</label>
          <textarea
            value={v("remarks")}
            onChange={(e) => handleChange("remarks", e.target.value)}
            rows={3}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full"
          />
        </div>
      </section>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || Object.keys(updates).length === 0}
          className="px-4 py-3 min-h-[44px] rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function EmiSection({ leadRowId }: { leadRowId?: string }) {
  const [emis, setEmis] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadRowId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/emi?lead_row_id=${encodeURIComponent(leadRowId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setEmis(d.data || []))
      .finally(() => setLoading(false));
  }, [leadRowId]);

  if (!leadRowId) return null;

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-3">EMI installments</h2>
      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : emis.length === 0 ? (
        <p className="text-slate-500 text-sm">No EMI installments</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">#</th>
              <th className="pb-2">Due</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {emis.map((e) => (
              <tr key={e.row_id} className="border-t border-slate-100">
                <td className="py-2">{e.installment_no}</td>
                <td>{e.due_date}</td>
                <td>{e.amount}</td>
                <td>
                  <span
                    className={
                      e.status === "Paid" ? "text-green-600" : "text-amber-600"
                    }
                  >
                    {e.status || "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {value || "—"}
      </div>
    </div>
  );
}
