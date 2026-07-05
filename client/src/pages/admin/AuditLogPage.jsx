import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { ListPageLayout, PageSkeleton, QueryErrorBanner } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import axios from 'axios';

const AuditLogPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/enterprise/audit');
        if (mounted) setEvents(data?.events || []);
      } catch (err) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Audit Log"
      icon={Shield}
      backTo={ADMIN_CONSOLE_PATH}
    >
      {error ? <QueryErrorBanner error={error} /> : null}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Resource</th>
              <th className="text-left p-3">Actor</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-slate-500">No audit events yet.</td></tr>
            ) : events.map((e) => (
              <tr key={e._id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-3">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="p-3 font-mono text-xs">{e.action}</td>
                <td className="p-3">{e.resourceType}{e.resourceId ? ` #${String(e.resourceId).slice(-6)}` : ''}</td>
                <td className="p-3">{e.actorEmail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPageLayout>
  );
};

export default AuditLogPage;
