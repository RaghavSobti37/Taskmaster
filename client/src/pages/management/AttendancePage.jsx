import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Trash2, Check, Lock, LogIn, LogOut, RotateCcw, Users, Navigation, XCircle } from 'lucide-react';
import { PageContainer, Button, NexusDropdown, Input, UserLabel, Spinner, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { NexusModal, ModalFooter } from '../../components/ui/modals';;
import {
  useAttendance,
  useAttendanceRosterUsers,
  useUpsertAttendance,
  useLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useAttendanceCheck,
  useUndoAttendanceCheck,
  useApproveAttendance,
  useResetAttendance,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { isOpsUser, isAdminUser } from '../../utils/departmentPermissions';
import { resolveRowEntry } from '../../utils/attendanceRosterVisibility';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { useUnsavedChanges, stableJsonEqual } from '../../hooks/useUnsavedChanges';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import {
  isAttendanceHoliday,
  getWeekDaysIST,
  shouldUseSplitLayout,
  getMergedCellLabel,
  formatDateKeyIST,
  resolveAttendanceStatus,
  inferEditScope,
} from '../../utils/attendanceUtils';
import MonthlyAttendanceGrid from '../../components/attendance/MonthlyAttendanceGrid';
import SelfMonthlyAttendanceCalendar from '../../components/attendance/SelfMonthlyAttendanceCalendar';
import TeamAttendanceMobileList from '../../components/attendance/TeamAttendanceMobileList';
import UnifiedTimeCard from '../../components/attendance/UnifiedTimeCard';
import AttendanceStatusLegend from '../../components/attendance/AttendanceStatusLegend';

const VIEW_MODES = {
  DAILY: 'daily',
  COMPACT: 'compact',
  WEEK: 'week',
  MONTH: 'month',
};

const PASTEL_ROSE_CELL = 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/20';
const PASTEL_ROSE_TEXT = 'text-[var(--color-pastel-rose-text)]';
const PASTEL_VIOLET_CELL = 'bg-[var(--color-pastel-violet-bg)] border-[var(--color-pastel-violet-text)]/20';
const PASTEL_VIOLET_TEXT = 'text-[var(--color-pastel-violet-text)]';

const preserveTimeRecord = (record) => {
  if (!record?.manualTimestamp) return undefined;
  return {
    manualTimestamp: record.manualTimestamp,
    workMode: record.workMode || 'office',
    verificationMethod: record.verificationMethod || 'MANUAL',
    isApproved: !!record.isApproved,
    ...(record.systemTimestamp ? { systemTimestamp: record.systemTimestamp } : {}),
    ...(record.approvedBy ? { approvedBy: record.approvedBy } : {}),
  };
};


const APPROVED_CELL = 'bg-blue-500/10 border-blue-500/30';

const getCellButtonClass = (status, entry, approved = false) => {
  if (approved) return APPROVED_CELL;
  return status === 'holiday' ? PASTEL_VIOLET_CELL :
  status === 'leave' ? PASTEL_ROSE_CELL :
  status === 'halfDay' ? 'bg-amber-500/10 border-amber-500/30' :
  status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
  'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]';
};

const AttendanceDayCells = ({ userRow, date, entry, status, onEdit, statusDot }) => {
  const split = shouldUseSplitLayout(entry, status);
  const cellButtonClass = (approved) =>
    `w-full rounded-lg border px-2 py-2 transition-colors hover:ring-2 hover:ring-[var(--color-action-primary)]/30 cursor-pointer ${getCellButtonClass(status, entry, approved)}`;

  if (!split) {
    const fullyApproved = entry?.inTimeRecord?.isApproved && entry?.outTimeRecord?.isApproved;
    const defaultScope = !entry?.inTimeRecord?.manualTimestamp ? 'in' : !entry?.outTimeRecord?.manualTimestamp ? 'out' : 'in';
    return (
      <td colSpan={2} className="px-2 py-2 align-top">
        <button type="button" onClick={() => onEdit(userRow, date, entry, defaultScope)} className={`${cellButtonClass(fullyApproved)} flex items-center justify-center gap-2 min-h-[36px]`}>
          {fullyApproved && <Lock size={10} className="text-blue-500 shrink-0" />}
          <span className={`text-[10px] font-bold ${status === 'empty' ? 'text-[var(--color-text-muted)]' : status === 'holiday' ? PASTEL_VIOLET_TEXT : ''}`}>
            {getMergedCellLabel(status, date)}
          </span>
        </button>
      </td>
    );
  }

  const inAppr = !!entry?.inTimeRecord?.isApproved;
  const outAppr = !!entry?.outTimeRecord?.isApproved;

  return (
    <>
      <td className="px-2 py-2 align-top">
        <button type="button" onClick={() => onEdit(userRow, date, entry, 'in')} className={`${cellButtonClass(inAppr)} text-left`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
            <span className="text-[10px] font-bold truncate">{entry?.inTimeRecord?.manualTimestamp || '--'}</span>
            {entry?.inTimeRecord?.manualTimestamp && !inAppr && <Check size={10} className="text-emerald-500 shrink-0" />}
            {inAppr && <Lock size={10} className="text-blue-500 shrink-0" />}
          </div>
        </button>
      </td>
      <td className="px-2 py-2 align-top">
        <button type="button" onClick={() => onEdit(userRow, date, entry, 'out')} className={`${cellButtonClass(outAppr)} text-left`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(status, entry)}`} />
            <span className="text-[10px] font-bold truncate">{entry?.outTimeRecord?.manualTimestamp || '--'}</span>
            {entry?.outTimeRecord?.manualTimestamp && !outAppr && <Check size={10} className="text-emerald-500 shrink-0" />}
            {outAppr && <Lock size={10} className="text-blue-500 shrink-0" />}
          </div>
        </button>
      </td>
    </>
  );
};



const AttendancePage = () => {
  const { user } = useAuth();
  const { addToast } = useSystemToast();
  const canEdit = isOpsUser(user);
  const canReset = isAdminUser(user);
  const [editInCell, setEditInCell] = useState(null);
  const [editOutCell, setEditOutCell] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [showTeamOverview, setShowTeamOverview] = useState(() => (
    location.pathname.endsWith('/all') && isOpsUser(user)
  ));

  useEffect(() => {
    if (!canEdit && location.pathname.endsWith('/all')) {
      setShowTeamOverview(false);
      navigate('/attendance', { replace: true });
    }
  }, [canEdit, location.pathname, navigate]);
  const [viewMode, setViewMode] = useState(VIEW_MODES.DAILY);
  const [monthView, setMonthView] = useState(() => startOfMonth(new Date()));
  const [editInForm, setEditInForm] = useState({ inTime: '', inMode: 'office' });
  const [editOutForm, setEditOutForm] = useState({ outTime: '', outMode: 'office' });
  const [editInBaseline, setEditInBaseline] = useState(null);
  const [editOutBaseline, setEditOutBaseline] = useState(null);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const todayKey = formatDateKeyIST(today);

  const dateColumns = useMemo(() => {
    if (viewMode === VIEW_MODES.DAILY) return [{ key: 'today', label: 'Today', date: today }];
    if (viewMode === VIEW_MODES.WEEK) return getWeekDaysIST(today);
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

  const { data: rows = [], isLoading } = useAttendance({ start: rangeStart, end: rangeEnd }, canEdit && showTeamOverview);
  const deferTeamSecondary = useDeferredQueryEnabled(!isLoading);
  const rosterParams = useMemo(() => ({
    viewMode,
    ...(viewMode === VIEW_MODES.MONTH
      ? {
        monthStart: format(startOfMonth(monthView), 'yyyy-MM-dd'),
        monthEnd: format(endOfMonth(monthView), 'yyyy-MM-dd'),
      }
      : {}),
  }), [viewMode, monthView]);
  const { data: visibleUsers = [], isLoading: usersLoading } = useAttendanceRosterUsers(
    rosterParams,
    canEdit && showTeamOverview && deferTeamSecondary
  );
  const { data: approvedLeaves = [] } = useLeaveRequests(
    { status: 'approved' },
    canEdit && showTeamOverview && deferTeamSecondary
  );
  const {
    data: selfMonthRows = [],
    isError: selfAttendanceError,
    error: selfAttendanceErr,
    refetch: refetchSelfAttendance,
  } = useAttendance(
    { start: format(startOfMonth(monthView), 'yyyy-MM-dd'), end: format(endOfMonth(monthView), 'yyyy-MM-dd'), mine: 'true' },
    true // always fetch for self-view
  );
  
  const { data: selfTodayRows = [] } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  const selfTodayEntry = selfTodayRows[0];

  const deferPendingLeaves = useDeferredQueryEnabled(!isLoading);
  const { data: leaveRequests = [] } = useLeaveRequests({ status: 'pending' }, canEdit && deferPendingLeaves);
  
  const upsertAttendance = useUpsertAttendance();
  const approveAttendance = useApproveAttendance();

  const handleApproveSuccess = (data, closeModal) => {
    if (data?.xpAward?.awarded) {
      addToast({
        type: 'success',
        message: 'Day locked — full-day attendance XP awarded for this date.',
        module: MODULE.SYSTEM,
      });
    }
    closeModal?.();
  };
  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();
  const resetAttendance = useResetAttendance();
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();

  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((entry) => {
      map.set(`${String(entry.userId)}_${format(new Date(entry.date), 'yyyy-MM-dd')}`, entry);
    });
    return map;
  }, [rows]);

  const getEntryForCell = (userRow, date) =>
    resolveRowEntry(rowMap, userRow._id, date, approvedLeaves);

  const selfRowMap = useMemo(() => {
    const map = new Map();
    selfMonthRows.forEach((entry) => {
      map.set(`${String(entry.userId)}_${formatDateKeyIST(new Date(entry.date))}`, entry);
    });
    return map;
  }, [selfMonthRows]);

  const resolveStatus = (entry, date) => resolveAttendanceStatus(entry, date);

  const statusDot = (status, entry) => {
    if (entry?.inTimeRecord?.isApproved || entry?.outTimeRecord?.isApproved) return 'bg-blue-500';
    if (status === 'holiday') return 'bg-[var(--color-pastel-violet-text)]';
    if (status === 'leave') return 'bg-[var(--color-pastel-rose-text)]';
    if (status === 'halfDay') return 'bg-amber-400';
    if (status === 'present') return 'bg-emerald-500';
    return 'bg-[var(--color-bg-border)]';
  };

  const openEditModal = (userRow, date, entry, scope) => {
    const resolvedScope = scope || inferEditScope(entry);
    const cell = { userRow, date, entry };
    if (resolvedScope === 'out') {
      const form = {
        outTime: entry?.outTimeRecord?.manualTimestamp || '',
        outMode: entry?.outTimeRecord?.workMode || 'office',
      };
      setEditOutCell(cell);
      setEditOutForm(form);
      setEditOutBaseline(form);
      setEditInCell(null);
      setEditInBaseline(null);
    } else {
      const form = {
        inTime: entry?.inTimeRecord?.manualTimestamp || '',
        inMode: entry?.inTimeRecord?.workMode || 'office',
      };
      setEditInCell(cell);
      setEditInForm(form);
      setEditInBaseline(form);
      setEditOutCell(null);
      setEditOutBaseline(null);
    }
  };

  const saveInCell = () => {
    if (!editInCell || editInLocked) return;
    const { userRow, date, entry } = editInCell;
    const payload = {
      userId: userRow._id,
      username: userRow.name,
      date: format(date, 'yyyy-MM-dd'),
      onLeave: !!entry?.onLeave,
      isHalfDay: !!entry?.isHalfDay,
      inTimeRecord: editInForm.inTime
        ? { manualTimestamp: editInForm.inTime, workMode: editInForm.inMode, verificationMethod: 'MANUAL' }
        : undefined,
      outTimeRecord: preserveTimeRecord(entry?.outTimeRecord),
    };
    upsertAttendance.mutate(payload, {
      onSuccess: () => setEditInCell(null),
      onError: (error) => addToast({ type: 'error', message: error.response?.data?.error || 'Failed to save', module: MODULE.ATTENDANCE }),
    });
  };

  const saveOutCell = () => {
    if (!editOutCell || editOutLocked) return;
    const { userRow, date, entry } = editOutCell;
    const payload = {
      userId: userRow._id,
      username: userRow.name,
      date: format(date, 'yyyy-MM-dd'),
      onLeave: !!entry?.onLeave,
      isHalfDay: !!entry?.isHalfDay,
      inTimeRecord: preserveTimeRecord(entry?.inTimeRecord),
      outTimeRecord: editOutForm.outTime
        ? { manualTimestamp: editOutForm.outTime, workMode: editOutForm.outMode, verificationMethod: 'MANUAL' }
        : undefined,
    };
    upsertAttendance.mutate(payload, {
      onSuccess: () => setEditOutCell(null),
      onError: (error) => addToast({ type: 'error', message: error.response?.data?.error || 'Failed to save', module: MODULE.ATTENDANCE }),
    });
  };

  const hasInEdits = !!editInCell && !!editInBaseline && !stableJsonEqual(editInForm, editInBaseline);
  const hasOutEdits = !!editOutCell && !!editOutBaseline && !stableJsonEqual(editOutForm, editOutBaseline);
  const editInLocked = !!editInCell?.entry?.inTimeRecord?.isApproved;
  const editOutLocked = !!editOutCell?.entry?.outTimeRecord?.isApproved;

  const { revert: revertInEdits } = useUnsavedChanges({
    baseline: editInBaseline,
    draft: editInForm,
    setDraft: setEditInForm,
    hasChanges: hasInEdits,
    onSave: saveInCell,
    enabled: false,
    isSaving: upsertAttendance.isPending,
  });

  const { revert: revertOutEdits } = useUnsavedChanges({
    baseline: editOutBaseline,
    draft: editOutForm,
    setDraft: setEditOutForm,
    hasChanges: hasOutEdits,
    onSave: saveOutCell,
    enabled: false,
    isSaving: upsertAttendance.isPending,
  });

  const executeAttendanceCheck = (type, manualTime, workMode) => {
    checkIn.mutate({ type, manualTime, workMode: workMode === 'wfh' ? 'wfh' : 'office' });
  };

  const handleLeaveActionError = (error, action) => {
    addToast({
      type: 'error',
      message: error.response?.data?.error || `Failed to ${action} leave request`,
      module: MODULE.ATTENDANCE,
    });
  };

  const handleApproveLeave = (requestId) => {
    approveLeave.mutate(requestId, {
      onError: (error) => handleLeaveActionError(error, 'approve'),
    });
  };

  const handleRejectLeave = (requestId) => {
    rejectLeave.mutate({ id: requestId }, {
      onError: (error) => handleLeaveActionError(error, 'reject'),
    });
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      {selfAttendanceError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(selfAttendanceErr, 'Failed to load attendance')}
          onRetry={() => refetchSelfAttendance()}
        />
      )}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 min-h-[44px] pb-3 mb-4">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2 lg:gap-x-3 lg:gap-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
              <ClipboardCheck size={18} strokeWidth={2.5} />
            </div>
            <h1 className="tm-page-title uppercase min-w-0">Attendance</h1>
          </div>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            variant={showTeamOverview ? 'primary' : 'secondary'}
            className="w-full lg:w-auto shrink-0"
            aria-label={showTeamOverview ? 'Hide team attendance overview' : 'View team attendance overview'}
            onClick={() => {
              if (showTeamOverview) {
                setShowTeamOverview(false);
                navigate('/attendance');
              } else {
                setShowTeamOverview(true);
                navigate('/attendance/all');
              }
            }}
          >
            <Users size={16} aria-hidden />
            <span className="lg:hidden">{showTeamOverview ? 'Hide overview' : 'Team overview'}</span>
            <span className="hidden lg:inline">{showTeamOverview ? 'Hide Team Overview' : 'View Team Attendance Overview'}</span>
          </Button>
        ) : null}
      </header>

      {/* Unified Time Card for Current User */}
      {!showTeamOverview && (
        <div className="space-y-4">
        <UnifiedTimeCard
          entry={selfTodayEntry}
          subTitle={user?.name}
          title={formatWeekdayDateLong(today)}
          alwaysShowMarkInAccess
          isSelfMode={true}
          onCheckIn={(t, workMode) => executeAttendanceCheck('in', t, workMode)}
          onCheckOut={(t, workMode) => executeAttendanceCheck('out', t, workMode)}
          onUndo={(type) => undoCheck.mutate({ type })}
          isLoading={checkIn.isPending}
        />
        </div>
      )}

      {/* Monthly Attendance Calendar for Current User */}
      {!showTeamOverview && (
        <SelfMonthlyAttendanceCalendar
          month={monthView}
          onMonthChange={setMonthView}
          rowMap={selfRowMap}
          userId={user?._id}
          resolveStatus={resolveStatus}
        />
      )}

      {/* Team Overview Matrix for Admins */}
      {showTeamOverview && canEdit && (
        <section className="p-4 space-y-4 border border-[var(--color-bg-border)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-bg-border)] pb-4">
            <h3 className="tm-widget-label">Team Matrix Overview</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-[var(--color-bg-border)] overflow-hidden">
                <button type="button" onClick={() => setViewMode(VIEW_MODES.DAILY)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${viewMode === VIEW_MODES.DAILY ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>Daily</button>
                <button type="button" onClick={() => setViewMode(VIEW_MODES.COMPACT)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${viewMode === VIEW_MODES.COMPACT ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>3-Day</button>
                <button type="button" onClick={() => setViewMode(VIEW_MODES.WEEK)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${viewMode === VIEW_MODES.WEEK ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>Week</button>
                <button type="button" onClick={() => setViewMode(VIEW_MODES.MONTH)} className={`px-3 py-1.5 text-xs font-bold transition-colors ${viewMode === VIEW_MODES.MONTH ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>Month</button>
              </div>
              {canReset && (
                <Button size="sm" variant="danger" onClick={() => setShowResetConfirm(true)}>
                  <Trash2 size={14} className="mr-1.5" />
                  Reset All
                </Button>
              )}
            </div>
          </div>

          <AttendanceStatusLegend />

          {leaveRequests.length > 0 && (
            <div className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] divide-y divide-[var(--color-bg-border)]">
              <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Pending leave requests
              </div>
              {leaveRequests.map((request) => {
                const requester = request.userId?.name || request.username || 'Unknown';
                const fromLabel = request.fromDate ? formatWeekdayDateLong(new Date(request.fromDate)) : '—';
                const toLabel = request.toDate ? formatWeekdayDateLong(new Date(request.toDate)) : fromLabel;
                return (
                  <div key={request._id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{requester}</p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {fromLabel === toLabel ? fromLabel : `${fromLabel} → ${toLabel}`}
                      </p>
                      {request.reason ? (
                        <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-2 mt-0.5">{request.reason}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="xs"
                        variant="success"
                        disabled={approveLeave.isPending || rejectLeave.isPending}
                        onClick={() => handleApproveLeave(request._id)}
                      >
                        <Check size={14} />
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        disabled={approveLeave.isPending || rejectLeave.isPending}
                        onClick={() => handleRejectLeave(request._id)}
                      >
                        <XCircle size={14} />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === VIEW_MODES.MONTH ? (
            <>
              <div className="hidden lg:block">
                <MonthlyAttendanceGrid
                  month={monthView}
                  onMonthChange={setMonthView}
                  rowMap={rowMap}
                  users={visibleUsers}
                  approvedLeaves={approvedLeaves}
                  resolveStatus={resolveStatus}
                  onEdit={openEditModal}
                />
              </div>
              <div className="lg:hidden -mx-1">
                <MonthlyAttendanceGrid
                  month={monthView}
                  onMonthChange={setMonthView}
                  rowMap={rowMap}
                  users={visibleUsers}
                  approvedLeaves={approvedLeaves}
                  resolveStatus={resolveStatus}
                  onEdit={openEditModal}
                />
              </div>
            </>
          ) : (
            <>
              <TeamAttendanceMobileList
                users={visibleUsers}
                dateColumns={dateColumns}
                rowMap={rowMap}
                approvedLeaves={approvedLeaves}
                resolveStatus={resolveStatus}
                onEdit={openEditModal}
                statusDot={statusDot}
                isLoading={isLoading}
                usersLoading={usersLoading}
              />
              <div className="hidden lg:block border border-[var(--color-bg-border)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--color-bg-primary)]">
                    <tr>
                      <th className="px-4 py-3 text-left sticky left-0 bg-[var(--color-bg-primary)] z-10 border-b border-[var(--color-bg-border)]" rowSpan={2}>User</th>
                      {dateColumns.map((day) => (
                        <th key={day.key} className={`px-3 py-3 text-center border-b border-[var(--color-bg-border)] ${viewMode === VIEW_MODES.WEEK ? 'min-w-[120px]' : 'min-w-[200px]'}`} colSpan={2}>
                          <div>{day.label}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">{formatWeekdayDate(day.date)}</div>
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {dateColumns.map((day) => (
                        <React.Fragment key={`${day.key}-sub`}>
                          <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">In</th>
                          <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">Out</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--color-bg-secondary)]">
                    {(isLoading || usersLoading) && (
                      <tr><td className="px-4 py-4 text-center" colSpan={1 + (dateColumns.length * 2)}><Spinner size="sm" /></td></tr>
                    )}
                    {!isLoading && !usersLoading && visibleUsers.map((userRow) => (
                      <tr key={userRow._id} className="border-t border-[var(--color-bg-border)] hover:bg-[var(--color-bg-primary)]/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-[var(--color-bg-secondary)] z-10">
                          <UserLabel user={userRow} size="xs" nameClassName="font-bold text-xs" />
                        </td>
                        {dateColumns.map(({ date, key: dayKey }) => {
                          const entry = getEntryForCell(userRow, date);
                          const status = resolveStatus(entry, date);
                          return <AttendanceDayCells key={`${dayKey}-${userRow._id}`} userRow={userRow} date={date} entry={entry} status={status} onEdit={openEditModal} statusDot={statusDot} />;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <NexusModal
        isOpen={!!editInCell}
        onClose={() => setEditInCell(null)}
        title={editInCell ? formatWeekdayDateLong(editInCell.date) : ''}
        subtitle={editInCell?.userRow?.name}
        subtitleFirst
        prominentTitle
        showFooter={false}
        size="md"
        bodyClassName="!pt-4 !pb-4 !space-y-0"
        footer={
          editInCell && !editInLocked ? (
            <ModalFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertInEdits}
                disabled={!hasInEdits || upsertAttendance.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={saveInCell}
                disabled={!hasInEdits || upsertAttendance.isPending}
              >
                {upsertAttendance.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          ) : null
        }
      >
        {editInCell && (
          <UnifiedTimeCard
            entry={editInCell.entry}
            hideTitleRow
            isSelfMode={false}
            editScope="in"
            readOnly={editInLocked}
            editForm={editInForm}
            setEditForm={setEditInForm}
            onApproveIn={() => approveAttendance.mutate(
              { id: editInCell.entry._id, approvalTarget: 'IN', manualTime: editInForm.inTime, workMode: editInForm.inMode },
              { onSuccess: (data) => handleApproveSuccess(data, () => setEditInCell(null)) }
            )}
            isLoading={approveAttendance.isPending}
          />
        )}
      </NexusModal>

      <NexusModal
        isOpen={!!editOutCell}
        onClose={() => setEditOutCell(null)}
        title={editOutCell ? formatWeekdayDateLong(editOutCell.date) : ''}
        subtitle={editOutCell?.userRow?.name}
        subtitleFirst
        prominentTitle
        showFooter={false}
        size="md"
        bodyClassName="!pt-4 !pb-4 !space-y-0"
        footer={
          editOutCell && !editOutLocked ? (
            <ModalFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertOutEdits}
                disabled={!hasOutEdits || upsertAttendance.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={saveOutCell}
                disabled={!hasOutEdits || upsertAttendance.isPending}
              >
                {upsertAttendance.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          ) : null
        }
      >
        {editOutCell && (
          <UnifiedTimeCard
            entry={editOutCell.entry}
            hideTitleRow
            isSelfMode={false}
            editScope="out"
            readOnly={editOutLocked}
            editForm={editOutForm}
            setEditForm={setEditOutForm}
            onApproveOut={() => approveAttendance.mutate(
              { id: editOutCell.entry._id, approvalTarget: 'OUT', manualTime: editOutForm.outTime, workMode: editOutForm.outMode },
              { onSuccess: (data) => handleApproveSuccess(data, () => setEditOutCell(null)) }
            )}
            isLoading={approveAttendance.isPending}
          />
        )}
      </NexusModal>

      <NexusModal isOpen={showResetConfirm} onClose={() => { setShowResetConfirm(false); setResetConfirmText(''); }} title="Reset All Attendance" showFooter={false} size="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            This permanently deletes <strong>all attendance records for all users</strong> across all dates. This cannot be undone.
          </p>
          <Input
            label="Type RESET to confirm"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="RESET"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowResetConfirm(false); setResetConfirmText(''); }}>Cancel</Button>
            <Button variant="danger" disabled={resetConfirmText !== 'RESET'} onClick={() => {
              resetAttendance.mutate(undefined, { onSuccess: () => { setShowResetConfirm(false); setResetConfirmText(''); } });
            }}>Confirm Reset</Button>
          </div>
        </div>
      </NexusModal>
    </PageContainer>
  );
};

export default AttendancePage;
