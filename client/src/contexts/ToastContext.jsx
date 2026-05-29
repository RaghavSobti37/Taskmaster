import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { ERPNotificationProvider, notify } from '../lib/notifications';

const ToastContext = createContext(null);

export const globalToast = {
  addToast: () => console.warn('globalToast called before ToastProvider initialized'),
};

export const ToastProvider = ({ children }) => {
  const addToast = useCallback((arg1, arg2) => {
    const legacyTypes = ['success', 'error', 'warning', 'info'];
    if (typeof arg1 === 'string' && typeof arg2 === 'string' && legacyTypes.includes(arg1)) {
      return notify.fromLegacy({
        title: arg1 === 'error' ? 'Error' : arg1 === 'success' ? 'Success' : 'Notice',
        message: arg2,
        type: arg1,
        id: `legacy-${arg1}-${arg2}`,
      });
    }
    if (typeof arg1 === 'object' && arg1 !== null) {
      return notify.fromLegacy(arg1);
    }
    if (typeof arg1 === 'string') {
      return notify.fromLegacy({ message: arg1, type: 'info' });
    }
    return null;
  }, []);

  const removeToast = useCallback((id) => {
    notify.dismiss(id);
  }, []);

  useEffect(() => {
    globalToast.addToast = addToast;
    window.alert = (msg) => {
      const text = String(msg);
      const isErr =
        /fail|error|required|mandatory/i.test(text);
      addToast({
        title: isErr ? 'Action Failed' : 'System Message',
        message: text,
        type: isErr ? 'error' : 'info',
        id: slugIdForAlert(text, isErr),
      });
    };
    return () => {
      delete window.alert;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, notify }}>
      {children}
      <ERPNotificationProvider />
    </ToastContext.Provider>
  );
};

function slugIdForAlert(msg, isErr) {
  const prefix = isErr ? 'alert-err' : 'alert-info';
  return `${prefix}-${msg.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
