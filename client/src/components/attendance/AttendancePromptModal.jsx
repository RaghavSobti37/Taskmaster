import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ClipboardCheck } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, Button } from '../ui';
import UnifiedTimeCard from './UnifiedTimeCard';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
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
  const { addToast } = useSystemToast();
  const todayKey = formatDateKeyIST();
  const { data: attendanceRows = [], isLoading: attendanceLoading } = useAttendance(
    { start: todayKey, end: todayKey, mine: 'true' },
    !!user?._id && !isAttendanceExcluded(user)
  );
  const entry = attendanceRows[0];
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();
  const [isLocating, setIsLocating] = useState(false);
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

  const executeGeolocationCheck = (type, manualTime) => {
    setIsLocating(true);
    const onSettled = () => {
      setIsLocating(false);
      if (type === 'in' && user?._id) {
        markAttendancePromptedToday(user._id);
        setDismissed(true);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkIn.mutate(
            {
              type,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              manualTime,
            },
            { onSettled }
          );
        },
        () => {
          addToast({
            type: 'warn',
            message: 'Location unavailable — check-in saved without GPS.',
            module: MODULE.ATTENDANCE,
          });
          checkIn.mutate({ type, manualTime }, { onSettled });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      addToast({
        type: 'warn',
        message: 'Location unavailable — check-in saved without GPS.',
        module: MODULE.ATTENDANCE,
      });
      checkIn.mutate({ type, manualTime }, { onSettled });
    }
  };

  if (!showModal) return null;

  return (
    <ModalShell isOpen size="lg" zIndex={1990} closeOnBackdrop={false} closeOnEscape={false}>
      <ModalHeader
        title="Mark today's attendance"
        subtitle="Check in before you continue"
        icon={ClipboardCheck}
        showClose={false}
      />
      <ModalBody className="!pt-4">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Record your check-in for today.
        </p>
        <UnifiedTimeCard
          entry={entry}
          title={format(today, 'EEEE, MMMM d')}
          subTitle="Today"
          isSelfMode
          onCheckIn={(t) => executeGeolocationCheck('in', t)}
          onCheckOut={(t) => executeGeolocationCheck('out', t)}
          onUndo={(type) => undoCheck.mutate({ type })}
          isLoading={isLocating || checkIn.isPending}
        />
      </ModalBody>
      <ModalFooter className="!justify-between">
        <Button type="button" variant="ghost" onClick={handleDismiss}>
          Remind me later
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};

export default AttendancePromptModal;
