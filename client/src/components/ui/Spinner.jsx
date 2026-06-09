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

/**
 * LoadingState — centered spinner; phrase only when showPhrase.
 */
export const LoadingState = ({
  className = '',
  variant,
  phraseClassName = '',
  showPhrase = false,
}) => (
  <div className={`flex flex-col items-center justify-center gap-4 py-12 text-center ${className}`}>
    <Spinner
      size="lg"
      variant={variant}
      showPhrase={showPhrase}
      phraseClassName={`text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] ${phraseClassName}`}
    />
  </div>
);
