import React from 'react';
import { CheckCircle2, Info, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from './primitives';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH_PX } from './ModalShell';

const MODAL_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': '2xl',
  full: 'full',
  fullscreen: 'fullscreen',
};

const LEGACY_WIDTH_MAP = {
  'max-w-sm': 'sm',
  'max-w-md': 'md',
  'max-w-lg': 'md',
  'max-w-xl': 'lg',
  'max-w-2xl': 'lg',
  'max-w-3xl': 'xl',
  'max-w-4xl': 'xl',
  'max-w-5xl': '2xl',
};

export const NexusModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  subtitleFirst = false,
  prominentTitle = false,
  message,
  type = 'info',
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isConfirm = false,
  showFooter = true,
  footer,
  size = 'fullscreen',
  width,
  bodyClassName = '',
  children,
}) => {
  const resolvedSize = (width && LEGACY_WIDTH_MAP[width]) || (width && MODAL_WIDTH_PX[width] ? width : null) || size;
  const shellSize = isConfirm ? 'sm' : resolvedSize;

  const typeConfig = {
    info: {
      icon: Info,
      color: 'var(--color-pastel-slate-text)',
      bg: 'var(--color-pastel-slate-bg)',
    },
    success: {
      icon: CheckCircle2,
      color: 'var(--color-pastel-mint-text)',
      bg: 'var(--color-pastel-mint-bg)',
    },
    warning: {
      icon: AlertTriangle,
      color: 'var(--color-pastel-apricot-text)',
      bg: 'var(--color-pastel-apricot-bg)',
    },
    danger: {
      icon: Trash2,
      color: 'var(--color-pastel-rose-text)',
      bg: 'var(--color-pastel-rose-bg)',
    },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size={shellSize}>
      <ModalHeader
        title={title}
        subtitle={subtitle}
        subtitleFirst={subtitleFirst}
        prominentTitle={prominentTitle}
        onClose={onClose}
        icon={Icon}
        iconStyle={{ background: config.bg, color: config.color }}
      />
      <ModalBody className={bodyClassName}>
        {message && (
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{message}</p>
        )}
        {children}
      </ModalBody>
      {footer != null ? (
        footer
      ) : showFooter ? (
        <ModalFooter>
          {isConfirm ? (
            <>
              <Button size="sm" variant="ghost" onClick={onClose}>{cancelLabel}</Button>
              <Button
                size="sm"
                variant={type === 'danger' ? 'danger' : 'primary'}
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
              >
                {confirmLabel}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={onClose}>Acknowledged</Button>
          )}
        </ModalFooter>
      ) : null}
    </ModalShell>
  );
};
