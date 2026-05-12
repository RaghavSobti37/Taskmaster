"use client";

import React, { Suspense, useCallback, useEffect, useLayoutEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/api-base";
import { ENUMS } from "@/lib/schema";
import {
  getAssignableUsers,
  getRepDisplayName,
  normalizeAssignedRepToId,
} from "@/lib/users";
import LeadsPageBody, { type LeadsPageBodyProps } from "./LeadsPageBody";

/** URL / filter sentinel for “blank” values (empty or unassigned). */
const FILTER_BLANK = "__EMPTY__";

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

const FILTER_KEYS: FilterKey[] = [
  "webinar_dates",
  "meaningful_connect",
  "call_status",
  "lead_quality",
  "lead_status",
  "assigned_rep_id",
];

function leadFieldIsBlank(key: FilterKey, l: Lead): boolean {
  const raw = (l[key] ?? "").trim();
  if (key === "assigned_rep_id") return !raw || !normalizeAssignedRepToId(raw);
  return !raw;
}

function getFilterOptions(key: FilterKey, _leads: Lead[]): string[] {
  let base: string[] = [];
  if (key === "meaningful_connect") base = [...ENUMS.meaningful_connect];
  else if (key === "call_status") base = [...ENUMS.call_status];
  else if (key === "lead_quality") base = [...ENUMS.lead_quality];
  else if (key === "lead_status") base = [...ENUMS.lead_status];
  else if (key === "assigned_rep_id")
    base = getAssignableUsers().map((u) => u.id);
  else {
    const seen = new Set<string>();
    for (const l of _leads) {
      const v = (l[key] ?? "").trim();
      if (v) seen.add(v);
    }
    base = Array.from(seen).sort();
  }
  const hasBlank = _leads.some((l) => leadFieldIsBlank(key, l));
  if (hasBlank) return [FILTER_BLANK, ...base];
  return base;
}

function getFilterOptionLabel(key: FilterKey, value: string): string {
  if (value === FILTER_BLANK) return "(Blank)";
  if (key === "assigned_rep_id") return getRepDisplayName(value);
  return value || "(empty)";
}

function leadMatchesColumnFilter(key: FilterKey, l: Lead, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const raw = (l[key] ?? "").trim();
  return selected.some((s) => {
    if (s === FILTER_BLANK) return leadFieldIsBlank(key, l);
    if (key === "assigned_rep_id")
      return normalizeAssignedRepToId(raw) === normalizeAssignedRepToId(s);
    return raw.toLowerCase() === s.toLowerCase();
  });
}

function leadMatchesFilters(
  l: Lead,
  filters: Record<FilterKey, string[]>,
  exceptKey?: FilterKey
): boolean {
  for (const key of FILTER_KEYS) {
    if (exceptKey && key === exceptKey) continue;
    const selected = filters[key];
    if (!leadMatchesColumnFilter(key, l, selected)) return false;
  }
  return true;
}

function countLeadsForFilterOption(
  filterKey: FilterKey,
  optionValue: string,
  allLeads: Lead[],
  filters: Record<FilterKey, string[]>
): number {
  return allLeads.filter((l) => {
    if (!leadMatchesFilters(l, filters, filterKey)) return false;
    return leadMatchesColumnFilter(filterKey, l, [optionValue]);
  }).length;
}

export default function LeadsPage() {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8 text-slate-500">
            Loading…
          </div>
        }
      >
        <LeadsPageContent />
      </Suspense>
    </div>
  );
}

function LeadsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") ?? "";
  const initialSortKey = (searchParams.get("sort") as SortKey | null) ?? null;
  const initialSortDir = (searchParams.get("dir") as SortDir | null) ?? "asc";

  const initialFilters: Record<FilterKey, string[]> = FILTER_KEYS.reduce(
    (acc, key) => {
      const raw = searchParams.get(`f_${key}`) || "";
      acc[key] = raw ? raw.split(",").map((v) => decodeURIComponent(v)) : [];
      return acc;
    },
    {} as Record<FilterKey, string[]>
  );
  const leadParam = searchParams.get("lead");
  const initialLead =
    leadParam ? (() => {
      const n = parseInt(leadParam, 10);
      return isNaN(n) || n < 2 ? null : n;
    })() : null;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [selectedLeadRowIndex, setSelectedLeadRowIndex] = useState<number | null>(initialLead);
  const [filters, setFilters] = useState<Record<FilterKey, string[]>>(
    () =>
      Object.keys(initialFilters).length
        ? initialFilters
        : FILTER_KEYS.reduce(
            (acc, k) => ({ ...acc, [k]: [] }),
            {} as Record<FilterKey, string[]>
          )
  );
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [, setFilterAnchorRect] = useState<DOMRect | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const main = document.getElementById("crm-main");
    if (!main) return;
    const key = "crm-leads-main-scroll";
    const saved = sessionStorage.getItem(key);
    if (saved != null) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y)) main.scrollTop = y;
    }
    return () => {
      sessionStorage.setItem(key, String(main.scrollTop));
    };
  }, []);

  // Keep URL query params in sync so filters and pane survive refresh/back
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (sortKey) {
      params.set("sort", sortKey);
      params.set("dir", sortDir);
    }
    if (selectedLeadRowIndex != null) params.set("lead", String(selectedLeadRowIndex));
    FILTER_KEYS.forEach((key) => {
      const values = filters[key];
      if (values && values.length) {
        params.set(
          `f_${key}`,
          values.map((v) => encodeURIComponent(v)).join(",")
        );
      }
    });
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [router, search, sortKey, sortDir, filters, selectedLeadRowIndex]);

  useEffect(() => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`${API_BASE}/api/leads${q}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setLeads(d.data || []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [search]);

  // Position filter popover from button (for portal)
  useEffect(() => {
    if (!openFilter) {
      setFilterAnchorRect(null);
      return;
    }
    const el = filterButtonRef.current;
    if (el) setFilterAnchorRect(el.getBoundingClientRect());
  }, [openFilter]);

  const updateFilterAnchor = useCallback(() => {
    if (openFilter && filterButtonRef.current)
      setFilterAnchorRect(filterButtonRef.current.getBoundingClientRect());
  }, [openFilter]);

  useEffect(() => {
    if (!openFilter) return;
    window.addEventListener("scroll", updateFilterAnchor, true);
    window.addEventListener("resize", updateFilterAnchor);
    return () => {
      window.removeEventListener("scroll", updateFilterAnchor, true);
      window.removeEventListener("resize", updateFilterAnchor);
    };
  }, [openFilter, updateFilterAnchor]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => leadMatchesFilters(l, filters));
  }, [leads, filters]);

  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      const va = (a[sortKey] ?? "").toLowerCase();
      const vb = (b[sortKey] ?? "").toLowerCase();
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredLeads, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleFilter = (key: FilterKey, value: string) => {
    setFilters((prev) => {
      const arr = prev[key];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const clearFilter = (key: FilterKey) => {
    setFilters((prev) => ({ ...prev, [key]: [] }));
  };

  const getFilterOptionCount = useCallback(
    (filterKey: FilterKey, optionValue: string) =>
      countLeadsForFilterOption(filterKey, optionValue, leads, filters),
    [leads, filters]
  );

  const thProps = {
    currentSortKey: sortKey,
    sortDir,
    onSort: handleSort,
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
  };
  const bodyProps: LeadsPageBodyProps = {
    search,
    setSearch,
    error,
    loading,
    sortedLeads,
    filteredCount: filteredLeads.length,
    totalLeadCount: leads.length,
    setSelectedLeadRowIndex,
    selectedLeadRowIndex,
    thProps,
    leads,
    onLeadUpdated: () => {
      setLeads((prev) =>
        prev.map((l) =>
          l.row_index === selectedLeadRowIndex ? { ...l } : l
        )
      );
    },
  };
  return React.createElement(LeadsPageBody, bodyProps);
}
