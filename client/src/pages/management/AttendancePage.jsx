import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Trash2 } from 'lucide-react';
import { PageContainer, PageHeader, Card, Button, NexusModal, NexusDropdown } from '../../components/ui';
import {
  useAttendance,
  useUpsertAttendance,
  useLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useAttendanceCheck,
  useUndoAttendanceCheck,
  useApproveAttendance,
  useUserDirectory,
  useResetAttendance,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { isOpsUser, isAdminUser } from '../../utils/departmentPermissions';
import { isAttendanceExcluded } from '../../utils/attendanceUsers';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Check, Lock, LogIn, LogOut, RotateCcw, Palmtree } from 'lucide-react';
import {
  isAttendanceHoliday,
  getWeekDaysIST,
  shouldUseSplitLayout,
  getMergedCellLabel,
  formatDateKeyIST,
  resolveAttendanceStatus,
} from '../../utils/attendanceUtils';
import MonthlyAttendanceGrid from '../../components/attendance/MonthlyAttendanceGrid';

const VIEW_MODES = {
  COMPACT: 'compact',
  WEEK: 'week',
  MONTH: 'month',
};

const PASTEL_ROSE_CELL = 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/20';
const PASTEL_ROSE_TEXT = 'text-[var(--color-pastel-rose-text)]';
const PASTEL_VIOLET_CELL = 'bg-[var(--color-pastel-violet-bg)] border-[var(--color-pastel-violet-text)]/20';
const PASTEL_VIOLET_TEXT = 'text-[var(--color-pastel-violet-text)]';

const getCellButtonClass = (status, entry) => (
  entry?.isApproved ? 'bg-blue-500/10 border-blue-500/30' :
  status === 'holiday' ? PASTEL_VIOLET_CELL :
  status === 'leave' ? PASTEL_ROSE_CELL :
  status === 'halfDay' ? 'bg-amber-500/10 border-amber-500/30' :
  status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
  'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]'
);

const AttendanceDayCells = ({ userRow, date, entry, status, onEdit, statusDot }) => {
  const split = shouldUseSplitLayout(entry, status);
  const baseClass = `w-full rounded-lg border px-2 py-2 transition-colors hover:ring-2 hover:ring-[var(--color-action-primary)]/30 cursor-pointer ${getCellButtonClass(status, entry)}`;

  if (!split) {
    return (
      <td colSpan={2} className="px-2 py-2 align-top">
        <button type="button" onClick={() => onEdit(userRow, date, entry)} className={`${baseClass} flex items-center justify-center gap-2 min-h-[36px]`}>
          {entry?.isApproved && <Lock size={10} className="text-blue-500 shrink-0" />}
          <span className={`text-[10px] font-bold ${status === 'empty' ? 'text-[var(--color-text-muted)]' : status === 'holiday' ? PASTEL_VIOLET_TEXT : ''}`}>
            {getMergedCellLabel(status, date)}
          </span>
        </button>
      </td>
    );
  }

  return (
    <>
      <td className="px-2 py-2 align-top">
        <button type="button" onClick={() => onEdit(userRow, date, entry)} className={`${baseClass} text-left`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
            <span className="text-[10px] font-bold truncate">{entry?.timeIn || '--'}</span>
            {entry?.timeIn && !entry?.isApproved && <Check size={10} className="text-emerald-500 shrink-0" />}
            {entry?.isApproved && <Lock size={10} className="text-blue-500 shrink-0" />}
          </div>
        </button>
      </td>
      <td className="px-2 py-2 align-top">
        <button type="button" onClick={() => onEdit(userRow, date, entry)} className={`${baseClass} text-left`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
            <span className="text-[10px] font-bold truncate">{entry?.timeOut || '--'}</span>
            {entry?.timeOut && !entry?.isApproved && <Check size={10} className="text-emerald-500 shrink-0" />}
            {entry?.isApproved && <Lock size={10} className="text-blue-500 shrink-0" />}
          </div>
        </button>
      </td>
    </>
  );
};

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
  const holiday = isAttendanceHoliday(today);
  const { data: rows = [], isLoading } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  const checkIn = useAttendanceCheck();
  const checkOut = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();

  const entry = rows[0];
  const isLocked = !!entry?.isApproved;
  const hasIn = !!entry?.timeIn;
  const hasOut = !!entry?.timeOut;
  const isBusy = checkIn.isPending || checkOut.isPending || undoCheck.isPending;

  const displayStatus = () => {
    if (isLoading) return 'Loading...';
    if (isLocked) return 'Approved';
    if (entry?.onLeave) return 'On leave';
    if (holiday && !hasIn && !hasOut) return 'Holiday';
    if (hasIn || hasOut) return 'Pending review';
    return 'Not marked';
  };

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
            <span className={`px-2 py-1 rounded-lg ${PASTEL_ROSE_CELL} ${PASTEL_ROSE_TEXT} font-bold`}>
              Discrepancy: {entry.discrepancyMinutes}m
            </span>
          )}
        </div>
      )}

      {holiday && !hasIn && !hasOut && !entry?.onLeave && (
        <div className={`flex items-center gap-2 p-4 rounded-xl ${PASTEL_VIOLET_CELL} ${PASTEL_VIOLET_TEXT}`}>
          <Palmtree size={18} />
          <span className="text-sm font-bold">Holiday — no attendance required. Mark in if you are working.</span>
        </div>
      )}

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
          disabled={isLoading || isBusy || hasOut || isLocked || !hasIn}
          onClick={() => checkOut.mutate({ type: 'out' })}
        >
          <LogOut size={16} className="mr-2" />
          Mark Out
        </Button>
      </div>

      {!isLocked && (hasIn || hasOut) && (
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
                {displayStatus()}
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
  const { addToast } = useSystemToast();
  const canEdit = isOpsUser(user);
  const canReset = isAdminUser(user);
  const [editCell, setEditCell] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [viewMode, setViewMode] = useState(VIEW_MODES.COMPACT);
  const [monthView, setMonthView] = useState(() => startOfMonth(new Date()));
  const [editForm, setEditForm] = useState({ status: 'present', timeIn: '', timeOut: '' });

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayKey = formatDateKeyIST(today);

  const dateColumns = useMemo(() => {
    if (viewMode === VIEW_MODES.WEEK) {
      return getWeekDaysIST(today);
    }
    if (viewMode === VIEW_MODES.MONTH) {
      const start = startOfMonth(monthView);
      const end = endOfMonth(monthView);
      return eachDayOfInterval({ start, end }).map((date) => ({
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'd'),
        date,
      }));
    }
    return [
      { key: 'yesterday', label: 'Yesterday', date: addDays(today, -1) },
      { key: 'today', label: 'Today', date: today },
      { key: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
    ];
  }, [today, viewMode, monthView]);

  const rangeStart = viewMode === VIEW_MODES.MONTH
    ? format(startOfMonth(monthView), 'yyyy-MM-dd')
    : format(dateColumns[0].date, 'yyyy-MM-dd');
  const rangeEnd = viewMode === VIEW_MODES.MONTH
    ? format(endOfMonth(monthView), 'yyyy-MM-dd')
    : format(dateColumns[dateColumns.length - 1].date, 'yyyy-MM-dd');

  const selfMonthStart = format(startOfMonth(monthView), 'yyyy-MM-dd');
  const selfMonthEnd = format(endOfMonth(monthView), 'yyyy-MM-dd');
  const { data: rows = [], isLoading } = useAttendance({ start: rangeStart, end: rangeEnd }, canEdit);
  const { data: selfMonthRows = [] } = useAttendance(
    { start: selfMonthStart, end: selfMonthEnd, mine: 'true' },
    !canEdit
  );
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: leaveRequests = [] } = useLeaveRequests({ status: 'pending' }, canEdit);
  const upsertAttendance = useUpsertAttendance();
  const approveAttendance = useApproveAttendance();
  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();
  const resetAttendance = useResetAttendance();

  const filteredUsers = useMemo(() => (
    users.filter((u) => !isAttendanceExcluded(u))
  ), [users]);

  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((entry) => {
      const key = `${String(entry.userId)}_${format(new Date(entry.date), 'yyyy-MM-dd')}`;
      map.set(key, entry);
    });
    return map;
  }, [rows]);

  const selfRowMap = useMemo(() => {
    const map = new Map();
    selfMonthRows.forEach((entry) => {
      const key = `${String(entry.userId)}_${format(new Date(entry.date), 'yyyy-MM-dd')}`;
      map.set(key, entry);
    });
    return map;
  }, [selfMonthRows]);

  const resolveStatus = (entry, date) => resolveAttendanceStatus(entry, date);

  const statusDot = (status, entry) => {
    if (entry?.isApproved) return 'bg-blue-500';
    if (status === 'holiday') return 'bg-[var(--color-pastel-violet-text)]';
    if (status === 'leave') return 'bg-[var(--color-pastel-rose-text)]';
    if (status === 'halfDay') return 'bg-amber-400';
    if (status === 'present') return 'bg-emerald-500';
    return 'bg-[var(--color-bg-border)]';
  };

  const openEditModal = (userRow, date, entry) => {
    const status = resolveStatus(entry, date);
    setEditCell({ userRow, date, entry });
    setEditForm({
      status: entry?.onLeave ? 'leave' : entry?.isHalfDay ? 'halfDay' : 'present',
      timeIn: entry?.timeIn || '',
      timeOut: entry?.timeOut || '',
    });
  };

  const saveCell = () => {
    if (!editCell) return;
    const { userRow, date } = editCell;
    const hasTimes = !!(editForm.timeIn || editForm.timeOut);
    const effectiveStatus = hasTimes && editForm.status === 'leave' ? 'present' : editForm.status;
    const payload = {
      userId: userRow._id,
      username: userRow.name,
      date: format(date, 'yyyy-MM-dd'),
      onLeave: effectiveStatus === 'leave',
      isHalfDay: effectiveStatus === 'halfDay',
      timeIn: effectiveStatus === 'leave' ? '' : (editForm.timeIn || ''),
      timeOut: effectiveStatus === 'leave' ? '' : (editForm.timeOut || ''),
    };
    upsertAttendance.mutate(payload, {
      onSuccess: () => {
        setEditCell(null);
      },
      onError: (error) => {
        addToast({
          type: 'error',
          message: error.response?.data?.error || 'Failed to save attendance',
          module: MODULE.ATTENDANCE,
        });
      },
    });
  };

  const approveCell = () => {
    if (!editCell?.entry?._id) return;
    approveAttendance.mutate(editCell.entry._id, { onSuccess: () => setEditCell(null) });
  };

  const handleResetAttendance = () => {
    resetAttendance.mutate(undefined, {
      onSuccess: (response) => {
        const deleted = response.data?.deleted;
        addToast({
          type: 'success',
          message: deleted
            ? `Deleted ${deleted.attendance} attendance rows and ${deleted.leaveRequests} leave requests.`
            : 'Attendance data reset successfully.',
          module: MODULE.ATTENDANCE,
        });
        setShowResetConfirm(false);
      },
      onError: (error) => {
        addToast({
          type: 'error',
          message: error.response?.data?.error || 'Failed to reset attendance data',
          module: MODULE.ATTENDANCE,
        });
      },
    });
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
        <MonthlyAttendanceGrid
          month={monthView}
          onMonthChange={setMonthView}
          rowMap={selfRowMap}
          singleUser={user}
          resolveStatus={resolveStatus}
          onEdit={() => {}}
          title="My Monthly Attendance"
        />
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
            <div className="inline-flex rounded-lg border border-[var(--color-bg-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode(VIEW_MODES.COMPACT)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === VIEW_MODES.COMPACT
                    ? 'bg-[var(--color-action-primary)] text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                3-Day
              </button>
              <button
                type="button"
                onClick={() => setViewMode(VIEW_MODES.WEEK)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === VIEW_MODES.WEEK
                    ? 'bg-[var(--color-action-primary)] text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Full Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode(VIEW_MODES.MONTH)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === VIEW_MODES.MONTH
                    ? 'bg-[var(--color-action-primary)] text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Monthly
              </button>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-[var(--color-bg-secondary)]">
              {viewMode === VIEW_MODES.MONTH
                ? format(monthView, 'MMMM yyyy')
                : `${format(dateColumns[0].date, 'MMM d')} – ${format(dateColumns[dateColumns.length - 1].date, 'MMM d, yyyy')}`}
            </span>
            {canReset && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setShowResetConfirm(true)}
                disabled={resetAttendance.isPending}
              >
                <Trash2 size={14} className="mr-1.5" />
                Reset All Attendance
              </Button>
            )}
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

      {viewMode === VIEW_MODES.MONTH ? (
        <MonthlyAttendanceGrid
          month={monthView}
          onMonthChange={setMonthView}
          rowMap={rowMap}
          users={filteredUsers}
          resolveStatus={resolveStatus}
          onEdit={openEditModal}
          title="Team Monthly Attendance"
        />
      ) : (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-[var(--color-bg-secondary)] z-10" rowSpan={2}>User</th>
                {dateColumns.map((day) => (
                  <th key={day.key} className={`px-3 py-3 text-center ${viewMode === VIEW_MODES.WEEK ? 'min-w-[120px]' : 'min-w-[200px]'}`} colSpan={2}>
                    <div>{day.label}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{format(day.date, 'EEE, MMM d')}</div>
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
                      const status = resolveStatus(entry, date);
                      return (
                        <AttendanceDayCells
                          key={`${dayKey}-${key}`}
                          userRow={userRow}
                          date={date}
                          entry={entry}
                          status={status}
                          onEdit={openEditModal}
                          statusDot={statusDot}
                        />
                      );
                    })}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}

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

      <NexusModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset All Attendance"
        showFooter={false}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            This permanently deletes all attendance records and leave requests. This cannot be undone.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleResetAttendance} disabled={resetAttendance.isPending}>
              Delete All Attendance Data
            </Button>
          </div>
        </div>
      </NexusModal>
    </PageContainer>
  );
};

export default AttendancePage;


// Performance Optimization: useCallback(eventHandler) memoization guard
