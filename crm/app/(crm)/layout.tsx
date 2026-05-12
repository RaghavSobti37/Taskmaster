"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/lib/api-base";

type User = { id: string; email: string; name: string; role: string } | null;

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/me`)
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leads", label: "Leads" },
    { href: "/followups", label: "Followups" },
    ...(user?.role === "super_admin" || user?.role === "team_leader"
      ? [{ href: "/sdr-report", label: "SDR Report" }]
      : []),
    ...(user?.role === "super_admin" ? [{ href: "/import", label: "Import" }] : []),
  ];

  return (
    <div className="min-h-screen min-h-0 flex flex-col md:flex-row bg-slate-50 md:h-screen md:max-h-screen">
      <aside className="md:w-56 md:min-h-screen bg-slate-900 text-white p-4 flex flex-col">
        <div className="text-xl font-bold tracking-tight mb-6">TSC CRM</div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block px-3 py-3 min-h-[44px] flex items-center rounded-lg text-sm transition-colors ${
                pathname.startsWith(n.href)
                  ? "bg-sky-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="pt-4 border-t border-slate-700 text-xs text-slate-400 space-y-1">
            <div className="font-medium text-slate-200 truncate" title={user.name}>{user.name}</div>
            <div className="capitalize">{String(user.role).replace(/_/g, " ")}</div>
            <a
              href={`${API_BASE}/login`}
              onClick={async (e) => {
                e.preventDefault();
                await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
                window.location.href = `${API_BASE}/login`;
              }}
              className="block text-slate-500 hover:text-slate-300 mt-2"
            >
              Logout
            </a>
          </div>
        )}
      </aside>
      <main
        id="crm-main"
        className="flex flex-1 flex-col min-h-0 overflow-auto p-4 md:p-6"
      >
        {children}
      </main>
    </div>
  );
}
