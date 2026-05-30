import React, { useEffect } from 'react';
import { ERPNotificationProvider } from '../lib/notifications';
import { emitSystemEvent } from '../lib/systemLogBridge';
import { SEVERITY, MODULE, makeToastId } from '../lib/systemLogContract';

/** Mounts toast portal + patches window.alert to unified pipeline */
export const ToastProvider = ({ children }) => {
  useEffect(() => {
    const previousAlert = window.alert;
    window.alert = (msg) => {
      const text = String(msg);
      const isErr = /fail|error|required|mandatory/i.test(text);
      emitSystemEvent({
        title: isErr ? 'Action Failed' : 'System Message',
        message: text,
        severity: isErr ? SEVERITY.ERROR : SEVERITY.INFO,
        module: MODULE.SYSTEM,
        id: makeToastId(MODULE.SYSTEM, text, isErr ? SEVERITY.ERROR : SEVERITY.INFO),
      });
    };
    return () => {
      window.alert = previousAlert;
    };
  }, []);

  return (
    <>
      {children}
      <ERPNotificationProvider />
    </>
  );
};

export { useSystemToast, useToast, globalToast, emitSystemEvent, emitFromLegacy } from '../lib/systemLogBridge';
