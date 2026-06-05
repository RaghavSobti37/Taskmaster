import React from 'react';
import { format } from 'date-fns';
import { SEVERITY } from '../../lib/systemLogContract';

const SEVERITY_BORDER = {
  [SEVERITY.ERROR]: 'border-l-red-500',
  [SEVERITY.WARN]: 'border-l-amber-500',
  [SEVERITY.SUCCESS]: 'border-l-emerald-500',
  [SEVERITY.INFO]: 'border-l-[var(--color-action-primary)]',
};

const formatActorLabel = (log) => {
  if (!log.actorId || log.actorId === 'SYSTEM') return 'SYSTEM';
  if (log.actorName) return log.actorName;
  if (log.actorId === 'ANON') return 'ANON';
  return log.actorId?.slice?.(-6) || '—';
};

export default function OpsTerminalView({ logs = [], className = '' }) {
  if (!logs.length) {
    return (
      <div className={`py-16 text-center opacity-40 font-mono text-xs ${className}`}>
        <p className="uppercase tracking-widest">No events in buffer</p>
      </div>
    );
  }

  return (
    <div className={`font-mono text-[11px] leading-relaxed ${className}`}>
      {logs.map((log) => {
        const border = SEVERITY_BORDER[log.severity] || 'border-l-[var(--color-bg-border)]';
        const ts = format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss');
        const route = log.route ? `${log.method || 'GET'} ${log.route}` : '';
        const meta = [log.module, log.errorCode, formatActorLabel(log)].filter(Boolean).join(' · ');

        return (
          <div
            key={log._id}
            className={`border-l-2 ${border} pl-3 py-2 border-b border-[var(--color-bg-border)]/60 last:border-b-0 hover:bg-[var(--color-bg-secondary)]/40`}
          >
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--color-text-muted)]">
              <span className="tabular-nums shrink-0">{ts}</span>
              <span className={`uppercase font-bold shrink-0 ${
                log.severity === SEVERITY.ERROR ? 'text-red-500'
                  : log.severity === SEVERITY.WARN ? 'text-amber-500'
                    : 'text-[var(--color-action-primary)]'
              }`}>
                {log.severity}
              </span>
              {meta && <span className="truncate">{meta}</span>}
            </div>
            <p className="text-[var(--color-text-primary)] mt-0.5 break-words">{log.message}</p>
            {route && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{route}</p>
            )}
            {log.payload && typeof log.payload === 'object' && (
              <pre className="mt-1 text-[10px] text-[var(--color-text-muted)] whitespace-pre-wrap break-all opacity-80">
                {JSON.stringify(log.payload)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
