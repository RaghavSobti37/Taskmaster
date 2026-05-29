import React, { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { PageContainer, PageHeader, Card, Button, NexusModal, NexusDropdown } from '../../components/ui';
import {
  useAttendance,
  useUpsertAttendance,
  useLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useBatchMarkPresent,
  useAttendanceCheck,
  useUndoAttendanceCheck,
  useApproveAttendance,
  useUserDirectory,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { addDays, format } from 'date-fns';
import { Check, Lock, LogIn, LogOut, RotateCcw, Palmtree } from 'lucide-react';
import { isWeekend } from '../../utils/attendanceUtils';

const OPS_ROLES = new Set(['admin', 'ops', 'operations', 'Operations']);

const TEST_USER_PATTERN = /(test\s*user|qa\s*tester|^test$|demo\s*user)/i;

const TimeCell = ({ time, marked, locked, approved }) => (
  <div className={`rounded-xl border px-4 py-3 ${locked ? 'bg-blue-500/10 border-blue-500/30' : marked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]'}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-lg font-black tabular-nums">{time || '--:--'}</span>
      <div className="flex items-center gap-1">
        {marked && !approved && <Check size={16} className="text-emerald-500" />}
        {approved && <Lock size={14} className="text-blue-500" />}
      </div>
    </div>
  </div>
);

const SelfAttendancePanel = ({ today, todayKey }) => {
  const weekend = isWeekend(today);
  const { data: rows = [], isLoading } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  const checkIn = useAttendanceCheck();
  const checkOut = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();

  const entry = rows[0];
  const isLocked = !!entry?.isApproved;
  const hasIn = !!entry?.timeIn;
  const hasOut = !!entry?.timeOut;
  const isBusy = checkIn.isPending || checkOut.isPending || undoCheck.isPending;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Today</p>
          <p className="text-2xl font-black">{format(today, 'EEEE, MMMM d')}</p>
        </div>
        {isLocked && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <Lock size={14} />
            Approved & locked
          </span>
        )}
        {entry?.workMode && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
            entry.workMode === 'office' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
          }`}>
            {entry.workMode === 'office' ? 'In Office' : 'WFH'}
          </span>
        )}
      </div>

      {(entry?.overtimeMinutes > 0 || entry?.discrepancyMinutes >= 30) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {entry.overtimeMinutes > 0 && (
            <span className="px-2 py-1 rounded-lg bg-violet-500/10 text-violet-600 border border-violet-500/20 font-bold">
              OT: {Math.round(entry.overtimeMinutes / 60 * 10) / 10}h
            </span>
          )}
          {entry.discrepancyMinutes >= 30 && (
            <span className="px-2 py-1 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 font-bold">
              Discrepancy: {entry.discrepancyMinutes}m
            </span>
          )}
        </div>
      )}

      {weekend ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <Palmtree size={18} />
          <span className="text-sm font-bold">Weekend — holiday. Attendance not required.</span>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TimeCell time={entry?.timeIn} marked={hasIn} locked={isLocked} approved={entry?.isApproved} />
        <TimeCell time={entry?.timeOut} marked={hasOut} locked={isLocked} approved={entry?.isApproved} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="primary"
          className="!py-3"
          disabled={isLoading || isBusy || hasIn || isLocked}
          onClick={() => checkIn.mutate({ type: 'in' })}
        >
          <LogIn size={16} className="mr-2" />
          Mark In
        </Button>
        <Button
          variant="primary"
          className="!py-3"
          disabled={isLoading || isBusy || hasOut || isLocked}
          onClick={() => checkOut.mutate({ type: 'out' })}
        >
          <LogOut size={16} className="mr-2" />
          Mark Out
        </Button>
      </div>
        </>
      )}

      {!weekend && !isLocked && (hasIn || hasOut) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {hasIn && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => undoCheck.mutate({ type: 'in' })}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Undo check-in
            </Button>
          )}
          {hasOut && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => undoCheck.mutate({ type: 'out' })}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Undo check-out
            </Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--color-bg-border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Time In</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Time Out</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--color-bg-border)]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-bold tabular-nums">
                  {entry?.timeIn || '--:--'}
                  {hasIn && <Check size={14} className="text-emerald-500" />}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-bold tabular-nums">
                  {entry?.timeOut || '--:--'}
                  {hasOut && <Check size={14} className="text-emerald-500" />}
                </div>
              </td>
              <td className="px-4 py-3 text-xs font-bold text-[var(--color-text-muted)]">
                {isLoading ? 'Loading...' : isLocked ? 'Approved' : hasIn || hasOut ? 'Pending review' : 'Not marked'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const AttendancePage = () => {
  const { user } = useAuth();
  const canEdit = OPS_ROLES.has(user?.role);
  const [editCell, setEditCell] = useState(null);
  const [editForm, setEditForm] = useState({ status: 'present', timeIn: '10:30', timeOut: '18:00' });

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayKey = format(today, 'yyyy-MM-dd');

  const dateColumns = useMemo(() => ([
    { key: 'yesterday', label: 'Yesterday', date: addDays(today, -1) },
    { key: 'today', label: 'Today', date: today },
    { key: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
  ]), [today]);

  const rangeStart = format(dateColumns[0].date, 'yyyy-MM-dd');
  const rangeEnd = format(dateColumns[2].date, 'yyyy-MM-dd');
  const { data: rows = [], isLoading } = useAttendance({ start: rangeStart, end: rangeEnd }, canEdit);
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: leaveRequests = [] } = useLeaveRequests({ status: 'pending' }, canEdit);
  const upsertAttendance = useUpsertAttendance();
  const approveAttendance = useApproveAttendance();
  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();
  const batchPresent = useBatchMarkPresent();

  const filteredUsers = useMemo(() => (
    users.filter((u) => {
      const label = `${u.name || ''} ${u.email || ''}`.trim();
      if (TEST_USER_PATTERN.test(label)) return false;
      return true;
    })
  ), [users]);

  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((entry) => {
      const key = `${String(entry.userId)}_${format(new Date(entry.date), 'yyyy-MM-dd')}`;
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

  const statusDot = (status, entry) => {
    if (entry?.isApproved) return 'bg-blue-500';
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
      timeIn: entry?.timeIn || '10:30',
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
    upsertAttendance.mutate(payload, {
      onSuccess: (response) => {
        setEditCell((prev) => (prev ? { ...prev, entry: response.data } : null));
      },
    });
  };

  const approveCell = () => {
    if (!editCell?.entry?._id) return;
    approveAttendance.mutate(editCell.entry._id, { onSuccess: () => setEditCell(null) });
  };

  if (!canEdit) {
    return (
      <PageContainer className="!py-4 !space-y-6">
        <PageHeader
          title="Attendance"
          subtitle="Mark your check-in and check-out for today."
          icon={ClipboardCheck}
        />
        <SelfAttendancePanel today={today} todayKey={todayKey} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Attendance Dashboard"
        subtitle="Review team attendance, edit times, and approve entries."
        icon={ClipboardCheck}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-[var(--color-bg-secondary)]">
              {format(dateColumns[0].date, 'MMM d')} – {format(dateColumns[2].date, 'MMM d, yyyy')}
            </span>
          </div>
        )}
      />

      {leaveRequests.length > 0 && (
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
                <th className="px-4 py-3 text-left sticky left-0 bg-[var(--color-bg-secondary)] z-10" rowSpan={2}>User</th>
                {dateColumns.map((day) => (
                  <th key={day.key} className="px-3 py-3 text-center min-w-[200px]" colSpan={2}>
                    <div>{day.label}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{format(day.date, 'EEE, MMM d')}</div>
                    <div className="mt-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        className="!text-[9px]"
                        onClick={() => batchPresent.mutate({ date: format(day.date, 'yyyy-MM-dd'), userIds: filteredUsers.map((u) => u._id) })}
                      >
                        All Present
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {dateColumns.map((day) => (
                  <React.Fragment key={`${day.key}-sub`}>
                    <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Time In</th>
                    <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Time Out</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isLoading || usersLoading) && (
                <tr><td className="px-4 py-4" colSpan={1 + (dateColumns.length * 2)}>Loading attendance...</td></tr>
              )}
              {!isLoading && !usersLoading && filteredUsers.length === 0 && (
                <tr><td className="px-4 py-4" colSpan={1 + (dateColumns.length * 2)}>No users found.</td></tr>
              )}
              {!isLoading && !usersLoading && filteredUsers.map((userRow) => (
                <tr key={userRow._id} className="border-t border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]/40">
                  <td className="px-4 py-3 font-bold whitespace-nowrap sticky left-0 bg-[var(--color-bg-primary)] z-10">{userRow.name}</td>
                  {dateColumns.map(({ date, key: dayKey }) => {
                      const key = `${String(userRow._id)}_${format(date, 'yyyy-MM-dd')}`;
                      const entry = rowMap.get(key);
                      const status = resolveStatus(entry);
                      return (
                        <React.Fragment key={`${dayKey}-${key}`}>
                          <td className="px-2 py-2 align-top">
                            <button
                              type="button"
                              onClick={() => openEditModal(userRow, date, entry)}
                              className={`w-full rounded-lg border px-2 py-2 text-left transition-colors ${
                                entry?.isApproved ? 'bg-blue-500/10 border-blue-500/30' :
                                status === 'leave' ? 'bg-red-500/10 border-red-500/30' :
                                status === 'halfDay' ? 'bg-amber-500/10 border-amber-500/30' :
                                status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]'
                              } hover:ring-2 hover:ring-[var(--color-action-primary)]/30 cursor-pointer`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
                                <span className="text-[10px] font-bold truncate">{entry?.timeIn || '--'}</span>
                                {entry?.timeIn && !entry?.isApproved && <Check size={10} className="text-emerald-500 shrink-0" />}
                                {entry?.isApproved && <Lock size={10} className="text-blue-500 shrink-0" />}
                              </div>
                            </button>
                          </td>
                          <td className="px-2 py-2 align-top">
                            <button
                              type="button"
                              onClick={() => openEditModal(userRow, date, entry)}
                              className={`w-full rounded-lg border px-2 py-2 text-left transition-colors ${
                                entry?.isApproved ? 'bg-blue-500/10 border-blue-500/30' :
                                status === 'leave' ? 'bg-red-500/10 border-red-500/30' :
                                status === 'halfDay' ? 'bg-amber-500/10 border-amber-500/30' :
                                status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]'
                              } hover:ring-2 hover:ring-[var(--color-action-primary)]/30 cursor-pointer`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
                                <span className="text-[10px] font-bold truncate">{entry?.timeOut || '--'}</span>
                                {entry?.timeOut && !entry?.isApproved && <Check size={10} className="text-emerald-500 shrink-0" />}
                                {entry?.isApproved && <Lock size={10} className="text-blue-500 shrink-0" />}
                              </div>
                            </button>
                          </td>
                        </React.Fragment>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">{editCell.userRow.name} · {format(editCell.date, 'EEE, MMM d')}</p>
              {editCell.entry?.isApproved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600">
                  <Lock size={12} />
                  Locked
                </span>
              )}
            </div>
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
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditCell(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveCell} disabled={upsertAttendance.isPending}>Save</Button>
              {editCell.entry?._id && !editCell.entry?.isApproved && editForm.status !== 'leave' && (editForm.timeIn || editForm.timeOut) && (
                <Button variant="primary" onClick={approveCell} disabled={approveAttendance.isPending}>
                  Approve & Lock
                </Button>
              )}
            </div>
          </div>
        )}
      </NexusModal>
    </PageContainer>
  );
};

export default AttendancePage;
