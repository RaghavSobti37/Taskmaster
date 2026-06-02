import React, { useState } from 'react';
import { Terminal, Zap, AlertTriangle, CheckCircle, Link2 } from 'lucide-react';
import { Button } from '../ui';
import { emitSystemEvent, getClientTraceId, startClientTrace } from '../../lib/systemLogBridge';
import { SEVERITY, MODULE } from '../../lib/systemLogContract';

const SystemLogSandbox = () => {
  const [lastTrace, setLastTrace] = useState(null);
  const showSandbox = import.meta.env.DEV || import.meta.env.VITE_SHOW_LOG_SANDBOX === 'true';

  if (!showSandbox) return null;

  const fireDuplicateError = () => {
    const id = 'sandbox-duplicate-error';
    for (let i = 0; i < 3; i += 1) {
      emitSystemEvent({
        severity: SEVERITY.ERROR,
        module: MODULE.SYSTEM,
        message: 'Sandbox: duplicate network failure (should dedupe toast)',
        userVisible: true,
        toastId: id,
        errorCode: 'SANDBOX_DUP',
        payload: i === 0 ? { stack: 'Error: Simulated network failure\n  at sandbox' } : undefined,
      });
    }
  };

  const fireChainedTrace = () => {
    const traceId = startClientTrace();
    setLastTrace(traceId);
    emitSystemEvent({
      severity: SEVERITY.INFO,
      module: MODULE.CRM,
      message: 'Trace step 1: CRM action initiated',
      userVisible: false,
      traceId,
    });
    emitSystemEvent({
      severity: SEVERITY.WARN,
      module: MODULE.WEBHOOK,
      message: 'Trace step 2: webhook retry scheduled',
      userVisible: true,
      traceId,
    });
    emitSystemEvent({
      severity: SEVERITY.ERROR,
      module: MODULE.EMAIL,
      message: 'Trace step 3: SMTP delivery failed',
      userVisible: true,
      traceId,
      errorCode: 'SMTP_421',
      payload: { smtpCode: 421 },
    });
  };

  return (
    <section className="py-4 border-t border-dashed border-[var(--color-pastel-blue-text)]/30 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <Terminal className="w-4 h-4" />
        System Log Sandbox
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Dev-only panel to validate deduplication, severity mapping, and trace chaining.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={fireDuplicateError}>
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          Duplicate ERROR (×3)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            emitSystemEvent({
              severity: SEVERITY.WARN,
              module: MODULE.PROJECTS,
              message: 'Sandbox: task deadline in 24 hours',
              userVisible: true,
            })
          }
        >
          <Zap className="w-3.5 h-3.5 mr-1" />
          WARN (5s auto-dismiss)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            emitSystemEvent({
              severity: SEVERITY.SUCCESS,
              module: MODULE.FINANCE,
              message: 'Sandbox: invoice #1024 generated',
              userVisible: true,
            })
          }
        >
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          SUCCESS
        </Button>
        <Button size="sm" variant="outline" onClick={fireChainedTrace}>
          <Link2 className="w-3.5 h-3.5 mr-1" />
          Chained trace (3 events)
        </Button>
      </div>
      {lastTrace && (
        <p className="text-[10px] font-mono text-[var(--color-text-muted)]">
          Last trace: {lastTrace} · current session: {getClientTraceId()}
        </p>
      )}
    </section>
  );
};

export default SystemLogSandbox;
