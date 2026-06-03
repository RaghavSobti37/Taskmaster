import React, { useState, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input, Button, Badge } from '../../../components/ui';
import { NexusModal } from '../../../components/ui/modals';;
import { useAuth } from '../../../contexts/AuthContext';
import { useApplyLeave, useLeaveRequests } from '../../../hooks/useTaskmasterQueries';

export default function LeaveTab() {
  const { user } = useAuth();
  const { data: myLeaveRequests = [] } = useLeaveRequests({}, !!user);
  const applyLeave = useApplyLeave();

  const [leaveFromDate, setLeaveFromDate] = useState('');
  const [leaveToDate, setLeaveToDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSuccessMessage, setLeaveSuccessMessage] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const pendingLeaveCount = useMemo(() => myLeaveRequests.filter((r) => r.status === 'pending').length, [myLeaveRequests]);

  const handleApplyLeave = async () => {
    try {
      await applyLeave.mutateAsync({ fromDate: leaveFromDate, toDate: leaveToDate, reason: leaveReason });
      setLeaveSuccessMessage('Your leave request has been submitted and is pending approval.');
      setLeaveFromDate('');
      setLeaveToDate('');
      setLeaveReason('');
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: 'Leave Request Failed',
        message: err.response?.data?.error || 'Failed to submit leave request.',
        type: 'danger'
      });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Apply for Leave</h1>
      </div>

      <section className="border-b border-[var(--color-bg-border)] pb-6">
        <div className="pb-4 border-b border-[var(--color-bg-border)] mb-6 flex items-center justify-between">
          <h3 className="tm-widget-label flex items-center gap-2">
            <CalendarDays size={14} className="text-violet-500" /> New Request
          </h3>
          {pendingLeaveCount > 0 && (
            <Badge variant="warning">{pendingLeaveCount} pending</Badge>
          )}
        </div>
        <div className="space-y-6">
          {(leaveSuccessMessage || pendingLeaveCount > 0) && (
            <div className="p-4 rounded-[var(--radius-atomic)] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              {leaveSuccessMessage || 'You have leave request(s) pending approval from operations.'}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input type="date" label="Leave From" value={leaveFromDate} onChange={(e) => setLeaveFromDate(e.target.value)} />
            <Input type="date" label="Leave To" value={leaveToDate} onChange={(e) => setLeaveToDate(e.target.value)} />
          </div>
          
          <Input label="Reason for Leave" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
          
          <div className="flex justify-end gap-3 pt-4">
            {(leaveFromDate || leaveToDate || leaveReason) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLeaveFromDate('');
                  setLeaveToDate('');
                  setLeaveReason('');
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleApplyLeave}
              disabled={!leaveFromDate || !leaveToDate || applyLeave.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {applyLeave.isPending ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
          </div>
        </div>
      </section>
      
      <NexusModal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} title={modalConfig.title} message={modalConfig.message} type={modalConfig.type} />
    </div>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
