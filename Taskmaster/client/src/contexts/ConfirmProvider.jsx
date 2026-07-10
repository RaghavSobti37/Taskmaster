import React, { useCallback, useRef, useState } from 'react';
import { NexusModal } from '../components/ui/NexusModal';
import { ConfirmContext, globalConfirm } from './confirmContext';

const CLOSED = {
  isOpen: false,
  title: 'Confirm',
  message: '',
  type: 'danger',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(CLOSED);
  const resolverRef = useRef(null);

  const finish = useCallback((result) => {
    setState(CLOSED);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }, []);

  const confirm = useCallback((options = {}) => {
    const opts = typeof options === 'string' ? { message: options } : options;

    const {
      title = 'Confirm',
      message = 'Are you sure?',
      type = 'danger',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
    } = opts;

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        isOpen: true,
        title,
        message,
        type,
        confirmLabel,
        cancelLabel,
      });
    });
  }, []);

  globalConfirm.confirm = confirm;

  React.useEffect(() => {
    globalConfirm.confirm = confirm;
    return () => {
      globalConfirm.confirm = async () => false;
    };
  }, [confirm]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <NexusModal
        isOpen={state.isOpen}
        onClose={() => finish(false)}
        title={state.title}
        message={state.message}
        type={state.type}
        isConfirm
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        onConfirm={() => finish(true)}
        size="sm"
      />
    </ConfirmContext.Provider>
  );
}
