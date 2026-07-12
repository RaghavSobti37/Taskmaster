import React from 'react';
import FluidRibbonLoader from '../brand/FluidRibbonLoader';
import { DEFAULT_LOADER_VARIANT } from '../brand/fluidRibbonLoaderCatalog';
import { useLoadingPhrase } from '../../hooks/useLoadingPhrase';
import { LoadingPhrase } from './LoadingPhrase';

function SpinnerWithPhrase({
  size,
  className,
  variant,
  phraseClassName,
}) {
  const phrase = useLoadingPhrase();
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <FluidRibbonLoader
        variant={variant || DEFAULT_LOADER_VARIANT}
        size={size}
        className={className}
        label={phrase}
      />
      <LoadingPhrase phrase={phrase} className={phraseClassName} />
    </div>
  );
}

/**
 * Spinner — fluid-ribbon loader (default frl-v-02).
 * Phrase only when showPhrase (boot, heavy pages) — one phrase per mount, no rotation.
 */
export const Spinner = ({
  size = 'md',
  className = '',
  variant,
  showPhrase = false,
  phraseClassName = '',
}) => {
  if (showPhrase) {
    return (
      <SpinnerWithPhrase
        size={size}
        className={className}
        variant={variant}
        phraseClassName={phraseClassName}
      />
    );
  }
  return (
    <FluidRibbonLoader
      variant={variant || DEFAULT_LOADER_VARIANT}
      size={size}
      className={className}
      label="Loading"
    />
  );
};

export const LoadingText = ({
  children = 'Loading',
  className = '',
  spinnerSize = 'sm',
}) => (
  <span
    className={`inline-flex min-w-0 items-center justify-center gap-2 ${className}`.trim()}
    role="status"
    aria-live="polite"
  >
    <Spinner size={spinnerSize} />
    <span className="truncate">{children}</span>
  </span>
);

/**
 * LoadingState — centered spinner; phrase only when showPhrase.
 */
export const LoadingState = ({
  className = '',
  variant,
  phraseClassName = '',
  showPhrase = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-4 py-12 text-center ${className}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <Spinner
      size="lg"
      variant={variant}
      showPhrase={showPhrase}
      phraseClassName={`text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] ${phraseClassName}`}
    />
  </div>
);
