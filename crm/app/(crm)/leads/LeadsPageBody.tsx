"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { getRepDisplayName } from "@/lib/users";
import LeadDetailContent from "./LeadDetailContent";

type Lead = Record<string, string> & { row_index?: number };
type SortKey =
  | "name"
  | "webinar_dates"
  | "attendance_duration_min"
  | "meaningful_connect"
  | "call_status"
  | "lead_quality"
  | "lead_status"
  | "assigned_rep_id";
type SortDir = "asc" | "desc";
type FilterKey = "webinar_dates" | "meaningful_connect" | "call_status" | "lead_quality" | "lead_status" | "assigned_rep_id";

export type LeadsPageBodyThProps = {
  label: string;
  sortKey: SortKey;
  filterKey?: FilterKey;
  className?: string;
  currentSortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  openFilter: FilterKey | null;
  setOpenFilter: (k: FilterKey | null) => void;
  filters: Record<FilterKey, string[]>;
  leads: Lead[];
  filterButtonRef: React.RefObject<HTMLButtonElement>;
  toggleFilter: (key: FilterKey, value: string) => void;
  clearFilter: (key: FilterKey) => void;
  getFilterOptions: (key: FilterKey, leads: Lead[]) => string[];
  getFilterOptionLabel: (key: FilterKey, value: string) => string;
  getFilterOptionCount: (key: FilterKey, value: string) => number;
};

export type LeadsPageBodyThPropsBase = Omit<
  LeadsPageBodyThProps,
  "label" | "sortKey" | "filterKey" | "className"
>;

export type LeadsPageBodyProps = {
  search: string;
  setSearch: (s: string) => void;
  error: string;
  loading: boolean;
  sortedLeads: Lead[];
  /** Rows after column filters (search already applied server-side). */
  filteredCount: number;
  totalLeadCount: number;
  setSelectedLeadRowIndex: (n: number | null) => void;
  selectedLeadRowIndex: number | null;
  thProps: LeadsPageBodyThPropsBase;
  leads: Lead[];
  onLeadUpdated: () => void;
};

function LeadsLayout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col ${className}`.trim()}>{children}</div>;
}

function Th({
  label,
  sortKey: k,
  filterKey,
  className = "",
  currentSortKey,
  sortDir,
  onSort,
  openFilter,
  setOpenFilter,
  filters,
  leads,
  filterButtonRef,
  toggleFilter,
  clearFilter,
  getFilterOptions,
  getFilterOptionLabel,
  getFilterOptionCount,
}: LeadsPageBodyThProps) {
  const activeCount = filterKey ? filters[filterKey].length : 0;
  const isOpen = openFilter === filterKey;
  const filterOptions = filterKey && isOpen ? getFilterOptions(filterKey, leads) : [];
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target) || filterButtonRef.current?.contains(target)) return;
      setOpenFilter(null);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [isOpen, setOpenFilter, filterButtonRef]);

  return (
    <th className={`text-left p-2 font-medium ${className}`}>
      <div className="flex items-center gap-1">
        <span
          className="cursor-pointer select-none hover:bg-slate-200 rounded px-1 py-0.5"
          onClick={() => onSort(k)}
        >
          {label}
          {currentSortKey === k && (
            <span className="ml-1 text-slate-500">{sortDir === "asc" ? "↑" : "↓"}</span>
          )}
        </span>
        {filterKey && (
          <div className="relative" ref={dropdownRef}>
            <button
              ref={isOpen ? filterButtonRef : undefined}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenFilter(isOpen ? null : filterKey);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${activeCount ? "text-sky-600" : "text-slate-400"}`}
              title="Filter"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {activeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-sky-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>
            {isOpen && filterOptions.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] max-h-[280px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                <div className="px-2 py-1.5 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Filter</span>
                  <button
                    type="button"
                    onClick={() => clearFilter(filterKey)}
                    className="text-xs text-sky-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                {filterOptions.map((value) => {
                  const selected = filters[filterKey].includes(value);
                  const n = getFilterOptionCount(filterKey, value);
                  return (
                    <label
                      key={value}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleFilter(filterKey, value)}
                        className="rounded border-slate-300 text-sky-600"
                      />
                      <span className="truncate flex-1">{getFilterOptionLabel(filterKey, value)}</span>
                      <span className="text-xs text-slate-400 tabular-nums shrink-0">{n}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </th>
  );
}

export default function LeadsPageBody({
  search,
  setSearch,
  error,
  loading,
  sortedLeads,
  filteredCount,
  totalLeadCount,
  setSelectedLeadRowIndex,
  selectedLeadRowIndex,
  thProps,
  leads,
  onLeadUpdated,
}: LeadsPageBodyProps) {
  const router = useRouter();
  /** Desktop split-pane when a lead is selected (lg+). Flex height chain is lg-only so mobile keeps normal document scroll via main. */
  const hasSelectedLead = selectedLeadRowIndex != null;

  const content = (
    <div
      className={`flex w-full min-w-0 flex-col ${hasSelectedLead ? "min-h-0 flex-1 lg:min-h-0 lg:overflow-hidden" : ""}`}
    >
      <LeadsLayout
        className={hasSelectedLead ? "min-h-0 flex-1 lg:min-h-0 lg:overflow-hidden" : ""}
      >
        <div
          className={
            hasSelectedLead
              ? "flex min-h-0 flex-1 flex-col gap-0 lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden"
              : "flex flex-col gap-0 lg:flex-row"
          }
        >
        {/* Left: on lg+ with panel open, only the body below the header scrolls (reliable flex + overflow). */}
        <div
          className={
            hasSelectedLead
              ? "flex min-h-0 min-w-0 flex-1 flex-col lg:max-w-[55%]"
              : "flex min-w-0 flex-1 flex-col"
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
              {!loading && (
                <p className="text-sm text-slate-500 mt-1 tabular-nums">
                  {filteredCount === totalLeadCount
                    ? `${filteredCount} lead${filteredCount === 1 ? "" : "s"}`
                    : `${filteredCount} of ${totalLeadCount} leads match filters`}
                </p>
              )}
            </div>
            <input
              type="search"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:w-64"
            />
          </div>

          <div
            className={
              hasSelectedLead
                ? "min-h-0 flex-1 overflow-y-auto overscroll-contain lg:min-h-0"
                : ""
            }
          >
            {error && (
              <div className="mx-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-slate-500 py-8 px-4">Loading...</div>
            ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white m-4">
              <div className="overflow-x-auto min-h-[24rem]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <Th {...thProps} label="Name" sortKey="name" />
                      <Th {...thProps} label="Webinar" sortKey="webinar_dates" filterKey="webinar_dates" />
                      <Th {...thProps} label="Time attended" sortKey="attendance_duration_min" />
                      <Th {...thProps} label="Meaningful Connect" sortKey="meaningful_connect" filterKey="meaningful_connect" />
                      <Th {...thProps} label="Call Status" sortKey="call_status" filterKey="call_status" />
                      <Th {...thProps} label="Lead Quality" sortKey="lead_quality" filterKey="lead_quality" />
                      <Th {...thProps} label="Lead Status" sortKey="lead_status" filterKey="lead_status" />
                      <Th {...thProps} label="Sales Rep" sortKey="assigned_rep_id" filterKey="assigned_rep_id" />
                      <th className="text-left p-3 font-medium w-10">Call</th>
                      <th className="text-left p-3 font-medium w-10">Mail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeads.map((l) => (
                      <tr
                        key={l.row_id || l.row_index}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("a, button")) return;
                          const idx = l.row_index ?? 0;
                          if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
                            setSelectedLeadRowIndex(idx);
                          } else {
                            router.push(`/leads/${idx}`);
                          }
                        }}
                      >
                    <td className="p-3 font-medium">{l.name || "—"}</td>
                    <td className="p-3 text-slate-600">{l.webinar_dates || "—"}</td>
                    <td className="p-3 text-slate-600">
                      {l.attendance_duration_min ? `${l.attendance_duration_min} min` : "—"}
                    </td>
                    <td className="p-3 text-slate-600">{l.meaningful_connect || "—"}</td>
                    <td className="p-3 text-slate-600">{l.call_status || "—"}</td>
                    <td className="p-3 text-slate-600">{l.lead_quality || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          l.lead_status === "Converted"
                            ? "bg-green-100 text-green-800"
                            : l.lead_status === "Hot"
                            ? "bg-orange-100 text-orange-800"
                            : l.lead_status === "Warm"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {l.lead_status || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{getRepDisplayName(l.assigned_rep_id ?? "")}</td>
                    <td className="p-3">
                      {l.phone ? (
                        <a
                          href={`tel:${l.phone}`}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm"
                          title="Call"
                        >
                          📞
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {l.email ? (
                        <a
                          href={`mailto:${l.email}`}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm"
                          title="Email"
                        >
                          ✉
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                    ))}
                    {sortedLeads.length === 0 &&
                      Array.from({ length: 8 }, (_, i) => (
                        <tr key={`empty-${i}`} className="border-b border-slate-100">
                          <td colSpan={10} className="p-3 text-slate-400">
                            —
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {sortedLeads.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  {leads.length === 0 ? "No leads found" : "No leads match the current filters"}
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Right: detail pane (desktop only) — inner scroller so long lead forms scroll */}
        {selectedLeadRowIndex != null && (
          <div className="hidden min-h-0 w-full min-w-0 flex-shrink-0 border-l border-slate-200 bg-slate-50 lg:flex lg:w-[420px] lg:flex-col lg:overflow-hidden xl:w-[480px]">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <LeadDetailContent
                rowIndex={selectedLeadRowIndex}
                compact
                onClose={() => setSelectedLeadRowIndex(null)}
                onLeadUpdated={onLeadUpdated}
              />
            </div>
          </div>
        )}
      </div>
      </LeadsLayout>
    </div>
  );
  return content;
}
