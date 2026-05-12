"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api-base";
import { followupBucketIST, parseFollowupAtInIST } from "@/lib/followup-utils";
import { getRepDisplayName } from "@/lib/users";

type Lead = Record<string, string> & { row_index?: number };

function FollowupCard({
  lead,
  markingDone,
  onMarkDone,
}: {
  lead: Lead;
  markingDone: boolean;
  onMarkDone: (lead: Lead) => void;
}) {
  const idx = lead.row_index ?? 0;
  const at = parseFollowupAtInIST(lead);
  const dateStr = lead.next_followup_date || "—";
  const timeStr = lead.next_followup_time?.trim() || "—";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 hover:border-sky-300 hover:bg-sky-50/50 transition-colors">
      <Link href={`/leads/${idx}`} className="block">
        <div className="font-medium text-slate-800">{lead.name || "—"}</div>
        <div className="text-sm text-slate-500 mt-1">
          {lead.phone || lead.email || "—"}
        </div>
        <div className="text-xs text-slate-600 mt-2 tabular-nums">
          {at ? (
            <>
              {at.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          ) : (
            <>
              {dateStr} {timeStr !== "—" ? `· ${timeStr}` : ""}
            </>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Rep: {getRepDisplayName(lead.assigned_rep_id ?? "")}
        </div>
      </Link>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onMarkDone(lead)}
          disabled={markingDone}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          {markingDone ? "Marking..." : "Mark done"}
        </button>
      </div>
    </div>
  );
}

function Column({
  title,
  description,
  leads,
  markingRowIndex,
  onMarkDone,
}: {
  title: string;
  description: string;
  leads: Lead[];
  markingRowIndex: number | null;
  onMarkDone: (lead: Lead) => void;
}) {
  return (
    <section className="min-w-0 flex flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      <p className="text-xs text-slate-500 mt-1 mb-3">{description}</p>
      {leads.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">None</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto max-h-[min(60vh,28rem)] pr-1">
          {leads.map((l) => (
            <li key={l.row_id || l.row_index}>
              <FollowupCard
                lead={l}
                markingDone={markingRowIndex === (l.row_index ?? null)}
                onMarkDone={onMarkDone}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function FollowupsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [markingRowIndex, setMarkingRowIndex] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleMarkDone = async (lead: Lead) => {
    const rowIndex = lead.row_index;
    if (!rowIndex) return;
    setMarkingRowIndex(rowIndex);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/leads/${rowIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          next_followup_date: "",
          next_followup_time: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark follow-up done");
      setLeads((prev) =>
        prev.map((l) =>
          l.row_index === rowIndex
            ? ({ ...l, next_followup_date: "", next_followup_time: "" } as unknown as Lead)
            : l
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark follow-up done");
    } finally {
      setMarkingRowIndex(null);
    }
  };

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

  const { overdue, today, upcoming, unscheduled } = useMemo(() => {
    const overdue: Lead[] = [];
    const today: Lead[] = [];
    const upcoming: Lead[] = [];
    const unscheduled: Lead[] = [];

    for (const l of leads) {
      const b = followupBucketIST(l, now);
      if (b === "unscheduled") unscheduled.push(l);
      else if (b === "overdue") overdue.push(l);
      else if (b === "today") today.push(l);
      else upcoming.push(l);
    }

    const byFollowupTime = (a: Lead, b: Lead) => {
      const ta = parseFollowupAtInIST(a)?.getTime() ?? 0;
      const tb = parseFollowupAtInIST(b)?.getTime() ?? 0;
      return ta - tb;
    };
    overdue.sort(byFollowupTime);
    today.sort(byFollowupTime);
    upcoming.sort(byFollowupTime);

    return { overdue, today, upcoming, unscheduled };
  }, [leads, now]);

  const scheduledCount = overdue.length + today.length + upcoming.length;

  if (loading) {
    return (
      <div className="text-slate-500 py-8">Loading follow-ups…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Follow-ups</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pipeline uses <strong>IST</strong> for dates and buckets. Current time (IST):{" "}
          <span className="font-medium text-slate-700 tabular-nums">
            {now.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          . Set dates on the lead detail screen (same fields sync to the sheet when you save).
        </p>
        <p className="text-sm text-slate-600 mt-2 tabular-nums">
          {scheduledCount} scheduled · {unscheduled.length} without a follow-up date
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column
          title="Overdue"
          description="Follow-up time has passed — prioritize these."
          leads={overdue}
          markingRowIndex={markingRowIndex}
          onMarkDone={handleMarkDone}
        />
        <Column
          title="Due today"
          description="Scheduled for later today (not yet overdue)."
          leads={today}
          markingRowIndex={markingRowIndex}
          onMarkDone={handleMarkDone}
        />
        <Column
          title="Upcoming"
          description="Future dates after today."
          leads={upcoming}
          markingRowIndex={markingRowIndex}
          onMarkDone={handleMarkDone}
        />
      </div>

      {unscheduled.length > 0 && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <h2 className="font-semibold text-slate-800">No follow-up date set</h2>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            {unscheduled.length} lead{unscheduled.length === 1 ? "" : "s"} — open a lead to add next follow-up date/time.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unscheduled.slice(0, 24).map((l) => (
              <li key={l.row_id || l.row_index}>
                <FollowupCard
                  lead={l}
                  markingDone={markingRowIndex === (l.row_index ?? null)}
                  onMarkDone={handleMarkDone}
                />
              </li>
            ))}
          </ul>
          {unscheduled.length > 24 && (
            <p className="text-xs text-slate-400 mt-2">
              Showing 24 of {unscheduled.length}. Refine assignments in Leads.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
