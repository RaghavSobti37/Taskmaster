import React, { useEffect, useMemo, useState } from 'react';
import { formatWeekdayDateLong } from '../../utils/dateDisplay';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';;
import UnifiedTimeCard from './UnifiedTimeCard';
import { useAuth } from '../../contexts/AuthContext';
import {
  useAttendance,
  useAttendanceCheck,
  useUndoAttendanceCheck,
} from '../../hooks/useTaskmasterQueries';
import { formatDateKeyIST } from '../../utils/attendanceUtils';
import { isAttendanceExcluded } from '../../utils/attendanceUsers';
import {
  ensureAttendanceSessionLoginRecorded,
  markAttendancePromptedToday,
  shouldShowAttendancePrompt,
} from '../../utils/attendancePrompt';

const AttendancePromptModal = () => {
  const { user } = useAuth();
  const todayKey = formatDateKeyIST();
  const { data: attendanceRows = [], isLoading: attendanceLoading } = useAttendance(
    { start: todayKey, end: todayKey, mine: 'true' },
    !!user?._id && !isAttendanceExcluded(user)
  );
  const entry = attendanceRows[0];
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user?._id) ensureAttendanceSessionLoginRecorded();
  }, [user?._id]);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  const showModal = useMemo(() => {
    if (!user || isAttendanceExcluded(user) || dismissed) return false;
    return shouldShowAttendancePrompt({ user, entry, attendanceLoading });
  }, [user, entry, attendanceLoading, dismissed]);

  const handleDismiss = () => {
    if (user?._id) markAttendancePromptedToday(user._id);
    setDismissed(true);
  };

  const executeAttendanceCheck = (type, manualTime, workMode) => {
    const onSettled = () => {
      if (type === 'in' && user?._id) {
        markAttendancePromptedToday(user._id);
        setDismissed(true);
      }
    };
    checkIn.mutate(
      { type, manualTime, workMode: workMode === 'wfh' ? 'wfh' : 'office' },
      { onSettled }
    );
  };

  if (!showModal) return null;

  return (
    <ModalShell isOpen size="lg" zIndex={1990} closeOnBackdrop={false} closeOnEscape={false}>
      <ModalBody className="!pt-4">
        <UnifiedTimeCard
          entry={entry}
          title={formatWeekdayDateLong(today)}
          subTitle="Today"
          isSelfMode
          onCheckIn={(t, workMode) => executeAttendanceCheck('in', t, workMode)}
          onCheckOut={(t, workMode) => executeAttendanceCheck('out', t, workMode)}
          onUndo={(type) => undoCheck.mutate({ type })}
          isLoading={checkIn.isPending}
        />
      </ModalBody>
      <ModalFooter className="!justify-stretch">
        <Button type="button" variant="secondary" size="md" className="w-full" onClick={handleDismiss}>
          Remind me later
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};

export default AttendancePromptModal;
