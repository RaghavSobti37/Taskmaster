import React, { useMemo, useState } from 'react';
import { PageContainer, PageHeader, Card, Button, NexusModal, NexusDropdown } from '../../components/ui';
import {
  useAttendance,
  useUpsertAttendance,
  useLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useBatchMarkPresent,
  useResetAttendance,
  useTeams,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { addWeeks, format, startOfWeek } from 'date-fns';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const OPS_ROLES = new Set(['admin', 'ops', 'operations', 'Operations']);

const TEST_USER_PATTERN = /(test\s*user|qa\s*tester|^test$|demo\s*user)/i;

const AttendancePage = () => {
  const { user } = useAuth();
  const canEdit = OPS_ROLES.has(user?.role);
  const [weekOffset, setWeekOffset] = useState(0);
  const [teamFilter, setTeamFilter] = useState('all');
  const [editCell, setEditCell] = useState(null);
  const [editForm, setEditForm] = useState({ status: 'present', timeIn: '09:00', timeOut: '18:00' });

  const weekStart = useMemo(() => {
    const base = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    base.setHours(0, 0, 0, 0);
    return base;
  }, [weekOffset]);

  const weekDates = useMemo(() => (
    Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      return d;
    })
  ), [weekStart]);

  const weekStartParam = format(weekStart, 'yyyy-MM-dd');
  const { data: rows = [], isLoading } = useAttendance({ week: 'current', weekStart: weekStartParam }, true);
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: teams = [] } = useTeams();
  const { data: leaveRequests = [] } = useLeaveRequests({ status: 'pending' }, canEdit);
  const upsertAttendance = useUpsertAttendance();
  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();
  const batchPresent = useBatchMarkPresent();
  const resetAttendance = useResetAttendance();

  const filteredUsers = useMemo(() => (
    users.filter((u) => {
      const label = `${u.name || ''} ${u.email || ''}`.trim();
      if (TEST_USER_PATTERN.test(label)) return false;
      if (teamFilter === 'all') return true;
      const userTeams = u.teams || [];
      return userTeams.some((t) => String(t._id || t) === String(teamFilter));
    })
  ), [users, teamFilter]);

  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((entry) => {
      const key = `${String(entry.userId)}_${new Date(entry.date).toISOString().slice(0, 10)}`;
      map.set(key, entry);
    });
    return map;
  }, [rows]);

  const resolveStatus = (entry) => {
    if (!entry) return 'empty';
    if (entry.onLeave) return 'leave';
    if (entry.isHalfDay) return 'halfDay';
    if (entry.timeIn || entry.timeOut) return 'present';
    return 'empty';
  };

  const statusDot = (status) => {
    if (status === 'leave') return 'bg-red-500';
    if (status === 'halfDay') return 'bg-amber-400';
    if (status === 'present') return 'bg-emerald-500';
    return 'bg-[var(--color-bg-border)]';
  };

  const openEditModal = (userRow, date, entry) => {
    const status = resolveStatus(entry);
    setEditCell({ userRow, date, entry });
    setEditForm({
      status: status === 'empty' ? 'present' : status,
      timeIn: entry?.timeIn || '09:00',
      timeOut: entry?.timeOut || '18:00',
    });
  };

  const saveCell = () => {
    if (!editCell) return;
    const { userRow, date } = editCell;
    const payload = {
      userId: userRow._id,
      username: userRow.name,
      date: format(date, 'yyyy-MM-dd'),
      onLeave: editForm.status === 'leave',
      isHalfDay: editForm.status === 'halfDay',
      timeIn: editForm.status === 'leave' ? '' : editForm.timeIn,
      timeOut: editForm.status === 'leave' ? '' : editForm.timeOut,
    };
    upsertAttendance.mutate(payload, { onSuccess: () => setEditCell(null) });
  };

  const teamOptions = [
    { value: 'all', label: 'All Teams' },
    ...teams.map((t) => ({ value: t._id, label: t.name })),
  ];

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Attendance Dashboard"
        subtitle="Weekly matrix: users × days with status and time logs."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft size={16} /> Prev
            </Button>
            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-[var(--color-bg-secondary)]">
              {format(weekDates[0], 'MMM d')} – {format(weekDates[6], 'MMM d, yyyy')}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setWeekOffset((w) => w + 1)}>
              Next <ChevronRight size={16} />
            </Button>
            <div className="w-44">
              <NexusDropdown
                options={teamOptions}
                value={teamFilter}
                onChange={setTeamFilter}
                placeholder="Filter team"
              />
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (window.confirm('Reset ALL attendance and leave request data? This cannot be undone.')) {
                    resetAttendance.mutate();
                  }
                }}
                disabled={resetAttendance.isPending}
              >
                {resetAttendance.isPending ? 'Resetting...' : 'Reset Data'}
              </Button>
            )}
          </div>
        )}
      />

      {canEdit && leaveRequests.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Pending Leave Approvals</h3>
          {leaveRequests.map((req) => (
            <div key={req._id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
              <div>
                <p className="font-bold text-sm">{req.username || req.userId?.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {format(new Date(req.fromDate), 'MMM d')} – {format(new Date(req.toDate), 'MMM d, yyyy')}
                  {req.reason ? ` · ${req.reason}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => approveLeave.mutate(req._id)}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => rejectLeave.mutate({ id: req._id })}>Reject</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-[var(--color-bg-secondary)] z-10">User</th>
                {weekDates.map((date) => (
                  <th key={date.toISOString()} className="px-3 py-3 text-center min-w-[130px]">
                    <div>{format(date, 'EEE')}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{format(date, 'MMM d')}</div>
                    {canEdit && (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="mt-1 !text-[9px]"
                        onClick={() => batchPresent.mutate({ date: format(date, 'yyyy-MM-dd'), userIds: filteredUsers.map((u) => u._id) })}
                      >
                        All Present
                      </Button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isLoading || usersLoading) && (
                <tr><td className="px-4 py-4" colSpan={8}>Loading attendance...</td></tr>
              )}
              {!isLoading && !usersLoading && filteredUsers.length === 0 && (
                <tr><td className="px-4 py-4" colSpan={8}>No users found.</td></tr>
              )}
              {!isLoading && !usersLoading && filteredUsers.map((userRow) => (
                <tr key={userRow._id} className="border-t border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]/40">
                  <td className="px-4 py-3 font-bold whitespace-nowrap sticky left-0 bg-[var(--color-bg-primary)] z-10">{userRow.name}</td>
                  {weekDates.map((date) => {
                      const key = `${String(userRow._id)}_${date.toISOString().slice(0, 10)}`;
                      const entry = rowMap.get(key);
                      const status = resolveStatus(entry);
                      const timeLabel = entry?.timeIn && entry?.timeOut ? `${entry.timeIn} - ${entry.timeOut}` : entry?.timeIn || entry?.timeOut || '--';
                      return (
                        <td key={key} className="px-2 py-2 align-top">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => canEdit && openEditModal(userRow, date, entry)}
                            className={`w-full rounded-lg border px-2 py-2 text-left transition-colors ${
                              status === 'leave' ? 'bg-red-500/10 border-red-500/30' :
                              status === 'halfDay' ? 'bg-amber-500/10 border-amber-500/30' :
                              status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
                              'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]'
                            } ${canEdit ? 'hover:ring-2 hover:ring-[var(--color-action-primary)]/30 cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status)}`} />
                              <span className="text-[10px] font-bold truncate">{timeLabel}</span>
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NexusModal
        isOpen={!!editCell}
        onClose={() => setEditCell(null)}
        title="Edit Attendance"
        showFooter={false}
        size="md"
      >
        {editCell && (
          <div className="space-y-4">
            <p className="text-sm font-bold">{editCell.userRow.name} · {format(editCell.date, 'EEE, MMM d')}</p>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Status</label>
              <NexusDropdown
                options={[
                  { value: 'present', label: 'Present' },
                  { value: 'halfDay', label: 'Half Day' },
                  { value: 'leave', label: 'Leave' },
                ]}
                value={editForm.status}
                onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
              />
            </div>
            {editForm.status !== 'leave' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Time In</label>
                  <input type="time" value={editForm.timeIn} onChange={(e) => setEditForm((f) => ({ ...f, timeIn: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Time Out</label>
                  <input type="time" value={editForm.timeOut} onChange={(e) => setEditForm((f) => ({ ...f, timeOut: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]" />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditCell(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveCell} disabled={upsertAttendance.isPending}>Save</Button>
            </div>
          </div>
        )}
      </NexusModal>
    </PageContainer>
  );
};

export default AttendancePage;
