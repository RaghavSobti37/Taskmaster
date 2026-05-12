"use client";

import { useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api-base";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    attempted?: number;
    imported?: number;
    skipped?: number;
    invalid?: number;
    duplicates?: number;
    auto_assigned?: number;
    distribution?: Record<string, number>;
    import_batch_id?: string;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      let body: string;
      let contentType: string;
      if (file.name.endsWith(".csv")) {
        body = await file.text();
        contentType = "text/csv";
      } else {
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          body = JSON.stringify(Array.isArray(parsed) ? { rows: parsed } : parsed);
        } catch {
          const rows = parseCsvToJson(text);
          body = JSON.stringify({ rows });
        }
        contentType = "application/json";
      }
      const res = await fetch(`${API_BASE}/api/import/leads`, {
        method: "POST",
        headers: { "Content-Type": contentType },
        credentials: "include",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          error: data.error || "Import failed",
          attempted: data.attempted,
          invalid: data.invalid,
          duplicates: data.duplicates,
        });
        return;
      }
      setResult({
        attempted: data.attempted,
        imported: data.imported,
        skipped: data.skipped ?? 0,
        invalid: data.invalid ?? 0,
        duplicates: data.duplicates ?? 0,
        auto_assigned: data.auto_assigned ?? 0,
        distribution: data.distribution ?? {},
        import_batch_id: data.import_batch_id,
      });
      setFile(null);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href="/leads" className="text-slate-500 hover:text-slate-800 text-sm">
          ← Back to leads
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Import leads</h1>
        <p className="text-slate-600 text-sm mt-1">
          CSV or JSON with columns: name, email, phone, webinar_dates, attended,
          attendance_duration_min, assigned_rep_id
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Blank/invalid rep values are auto-mapped to SDR IDs with load balancing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Upload file
          </label>
          <input
            type="file"
            accept=".csv,application/json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-slate-300 file:bg-slate-50"
          />
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </form>

      {result && (
        <div
          className={`rounded-lg p-4 ${
            result.error ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-green-50 border border-green-200 text-green-800"
          }`}
        >
          {result.error ? (
            <>
              {result.error}
              {(result.invalid || result.duplicates) && (
                <span className="block mt-1 text-xs">
                  {result.invalid ? `Invalid: ${result.invalid}. ` : ""}
                  {result.duplicates ? `Duplicates: ${result.duplicates}.` : ""}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="font-medium">
                Imported {result.imported} lead(s)
                {result.attempted ? ` out of ${result.attempted}` : ""}.
              </p>
              <p className="text-sm mt-1">
                Skipped: {result.skipped ?? 0}
                {` (invalid: ${result.invalid ?? 0}, duplicates: ${result.duplicates ?? 0})`}
              </p>
              <p className="text-sm mt-1">
                Auto-assigned to SDRs: {result.auto_assigned ?? 0}
              </p>
              {result.import_batch_id && (
                <p className="text-xs mt-1 opacity-80">Batch ID: {result.import_batch_id}</p>
              )}
              {result.distribution && Object.keys(result.distribution).length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Assignment distribution:</p>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(result.distribution).map(([repId, count]) => (
                      <span key={repId}>
                        {repId}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function parseCsvToJson(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}
