import React from 'react';
import { Shield, Activity, Users, Database } from 'lucide-react';

const AdminPanel = () => {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Platform Operations Desk</h1>
        <p className="text-[var(--color-text-secondary)]">Manage system metrics, user roles, and security protocols.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)]">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-blue-500" />
            <h3 className="font-bold">Security Status</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Firewall Layer</span>
              <span className="text-green-500 font-bold">Active</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">JWT Integrity</span>
              <span className="text-green-500 font-bold">Valid</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)]">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-orange-500" />
            <h3 className="font-bold">System Load</h3>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
            <div className="bg-orange-500 h-full w-[12%]" />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">12% Resource Utilization</p>
        </div>

        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)]">
          <div className="flex items-center gap-3 mb-4">
            <Database className="text-purple-500" />
            <h3 className="font-bold">Data Metrics</h3>
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">14,204</p>
          <p className="text-xs text-[var(--color-text-muted)]">Atomic Transactions Today</p>
        </div>
      </div>

      <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] overflow-hidden">
        <div className="p-6 border-b border-[var(--color-bg-border)] flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Users size={20} /> User Directory
          </h3>
          <button className="text-sm text-[var(--color-action-primary)] font-bold">View All Accounts</button>
        </div>
        <div className="divide-y divide-[var(--color-bg-border)]">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-[var(--color-bg-workspace)] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div>
                  <p className="text-sm font-bold">System Operator {i}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">operator_{i}@coreknot.io</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">Admin</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
