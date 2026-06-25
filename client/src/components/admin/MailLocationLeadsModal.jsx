import React from 'react';
import { X } from 'lucide-react';
import { Button, Badge, DataLoading } from '../ui';
import { useLocationLeads } from '../../hooks/useTaskmasterQueries';

export default function MailLocationLeadsModal({ location, onClose }) {
  const { data: leads = [], isLoading } = useLocationLeads(location, true);

  return (
    <div className="tm-modal-overlay fixed inset-0 z-[1000] bg-black/60 p-4">
      <div className="tm-modal-panel max-w-3xl max-h-[80vh] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
        <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Leads in {location}</h2>
            <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1">Showing engaged/active leads registered at this location</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--color-bg-primary)]">
          {isLoading ? (
            <div className="py-8 flex justify-center"><DataLoading /></div>
          ) : leads.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-[var(--color-text-muted)] italic">No engaged leads found for this location.</div>
          ) : (
            <div className="border border-[var(--color-bg-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
              <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)] font-mono">
                  {leads.map((lead, idx) => (
                    <tr key={lead._id || idx} className="hover:bg-[var(--color-bg-primary)]/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">{lead.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{lead.email}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{lead.phone || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={lead.unsubscribed ? 'warning' : lead.emailStatus === 'Bounced' ? 'danger' : 'success'}>
                          {lead.unsubscribed ? 'Unsubscribed' : lead.emailStatus || 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
