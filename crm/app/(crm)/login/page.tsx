"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api-base";

export default function LoginPage() {
  const router = useRouter();
  const [passkey, setPasskey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!passkey.trim()) {
      setError("Enter passkey");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/passkey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: passkey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid passkey");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-2">TSC CRM</h1>
        <p className="text-slate-500 text-sm mb-6">Enter passkey (e.g. last 5 digits of phone)</p>
        <form onSubmit={login} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Passkey"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-lg tracking-widest"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
