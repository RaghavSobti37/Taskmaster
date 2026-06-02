import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Trash2, Check, Lock, LogIn, LogOut, RotateCcw, Palmtree, Users, Navigation } from 'lucide-react';
import { PageContainer, Button, NexusModal, NexusDropdown, Input, ModalFooter, UserLabel, DesktopRecommendedBanner } from '../../components/ui';
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
import { useUnsavedChanges, stableJsonEqual } from '../../hooks/useUnsavedChanges';
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
import UnifiedTimeCard from '../../components/attendance/UnifiedTimeCard';

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
  const [isLocating, setIsLocating] = useState(false);
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

  const { data: rows = [], isLoading } = useAttendance({ start: rangeStart, end: rangeEnd }, canEdit);
  const { data: selfMonthRows = [] } = useAttendance(
    { start: format(startOfMonth(monthView), 'yyyy-MM-dd'), end: format(endOfMonth(monthView), 'yyyy-MM-dd'), mine: 'true' },
    true // always fetch for self-view
  );
  
  const { data: selfTodayRows = [] } = useAttendance({ start: todayKey, end: todayKey, mine: 'true' }, true);
  
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: leaveRequests = [] } = useLeaveRequests({ status: 'pending' }, canEdit);
  
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

  const filteredUsers = useMemo(() => users.filter((u) => !isAttendanceExcluded(u)), [users]);

  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((entry) => {
      map.set(`${String(entry.userId)}_${format(new Date(entry.date), 'yyyy-MM-dd')}`, entry);
    });
    return map;
  }, [rows]);

  const selfRowMap = useMemo(() => {
    const map = new Map();
    selfMonthRows.forEach((entry) => {
      map.set(`${String(entry.userId)}_${format(new Date(entry.date), 'yyyy-MM-dd')}`, entry);
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
    if (!editInCell) return;
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
    if (!editOutCell) return;
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

  const executeGeolocationCheck = (type, manualTime) => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkIn.mutate({ type, lat: position.coords.latitude, lng: position.coords.longitude, manualTime }, { onSettled: () => setIsLocating(false) });
        },
        (error) => {
          addToast({ type: 'warn', message: 'Location unavailable — check-in saved without GPS.', module: MODULE.ATTENDANCE });
          checkIn.mutate({ type, manualTime }, { onSettled: () => setIsLocating(false) });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      addToast({ type: 'warn', message: 'Location unavailable — check-in saved without GPS.', module: MODULE.ATTENDANCE });
      checkIn.mutate({ type, manualTime }, { onSettled: () => setIsLocating(false) });
    }
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <DesktopRecommendedBanner message="Team attendance matrix is best viewed on desktop. Use Settings → Attendance for your personal log on mobile." />
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-h-[44px] pb-3 mb-4 border-b border-[var(--color-bg-border)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10">
              <ClipboardCheck size={18} strokeWidth={2.5} />
            </div>
            <h1 className="tm-page-title uppercase whitespace-nowrap">Attendance</h1>
          </div>
          {!showTeamOverview && (
            <>
              <span className="hidden sm:block w-px h-5 bg-[var(--color-bg-border)] shrink-0" aria-hidden />
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] shrink-0">Today</span>
                <span className="text-sm font-black truncate">{format(today, 'EEEE, MMMM d')}</span>
              </div>
            </>
          )}
        </div>
        {canEdit ? (
          <Button
            size="sm"
            variant={showTeamOverview ? 'primary' : 'secondary'}
            className="shrink-0"
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
            <Users size={16} />
            {showTeamOverview ? 'Hide Team Overview' : 'View Team Attendance Overview'}
          </Button>
        ) : null}
      </header>

      {/* Unified Time Card for Current User */}
      {!showTeamOverview && (
        <UnifiedTimeCard 
          entry={selfTodayRows[0]}
          hideTitleRow
          isSelfMode={true}
          onCheckIn={(t) => executeGeolocationCheck('in', t)}
          onCheckOut={(t) => executeGeolocationCheck('out', t)}
          onUndo={(type) => undoCheck.mutate({ type })}
          isLoading={isLocating || checkIn.isPending}
        />
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

          <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/90 border border-emerald-600/60" /> Present</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400/80 border border-amber-500/50" /> Half Day</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--color-pastel-violet-bg)] border border-[var(--color-pastel-violet-text)]/40" /> Holiday</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--color-pastel-rose-bg)] border border-[var(--color-pastel-rose-text)]/40" /> Leave</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]" /> No input</span>
          </div>

          {viewMode === VIEW_MODES.MONTH ? (
            <div className="hidden lg:block">
            <MonthlyAttendanceGrid
              month={monthView}
              onMonthChange={setMonthView}
              rowMap={rowMap}
              users={filteredUsers}
              resolveStatus={resolveStatus}
              onEdit={openEditModal}
            />
            </div>
          ) : (
            <div className="hidden lg:block overflow-x-auto border border-[var(--color-bg-border)]">
              <table className="min-w-full text-xs">
                <thead className="bg-[var(--color-bg-primary)]">
                  <tr>
                    <th className="px-4 py-3 text-left sticky left-0 bg-[var(--color-bg-primary)] z-10 border-b border-[var(--color-bg-border)]" rowSpan={2}>User</th>
                    {dateColumns.map((day) => (
                      <th key={day.key} className={`px-3 py-3 text-center border-b border-[var(--color-bg-border)] ${viewMode === VIEW_MODES.WEEK ? 'min-w-[120px]' : 'min-w-[200px]'}`} colSpan={2}>
                        <div>{day.label}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{format(day.date, 'EEE, MMM d')}</div>
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
                    <tr><td className="px-4 py-4 text-center italic" colSpan={1 + (dateColumns.length * 2)}>Loading...</td></tr>
                  )}
                  {!isLoading && !usersLoading && filteredUsers.map((userRow) => (
                    <tr key={userRow._id} className="border-t border-[var(--color-bg-border)] hover:bg-[var(--color-bg-primary)]/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-[var(--color-bg-secondary)] z-10">
                        <UserLabel user={userRow} size="xs" nameClassName="font-bold text-xs" />
                      </td>
                      {dateColumns.map(({ date, key: dayKey }) => {
                        const key = `${String(userRow._id)}_${format(date, 'yyyy-MM-dd')}`;
                        const entry = rowMap.get(key);
                        const status = resolveStatus(entry, date);
                        return <AttendanceDayCells key={`${dayKey}-${key}`} userRow={userRow} date={date} entry={entry} status={status} onEdit={openEditModal} statusDot={statusDot} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <NexusModal
        isOpen={!!editInCell}
        onClose={() => setEditInCell(null)}
        title="Morning Check-In — User Timecard"
        showFooter={false}
        size="md"
        footer={
          editInCell ? (
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
            title={format(editInCell.date, 'EEE, MMM d, yyyy')}
            subTitle={editInCell.userRow.name}
            isSelfMode={false}
            editScope="in"
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
        title="Evening Check-Out — User Timecard"
        showFooter={false}
        size="md"
        footer={
          editOutCell ? (
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
            title={format(editOutCell.date, 'EEE, MMM d, yyyy')}
            subTitle={editOutCell.userRow.name}
            isSelfMode={false}
            editScope="out"
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
