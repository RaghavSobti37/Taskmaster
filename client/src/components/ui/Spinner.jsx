import React from 'react';
import FluidRibbonLoader from '../brand/FluidRibbonLoader';
import { DEFAULT_LOADER_VARIANT } from '../brand/fluidRibbonLoaderCatalog';
import { useLoadingPhrase } from '../../hooks/useLoadingPhrase';
import { LoadingPhrase } from './LoadingPhrase';

/**
 * Spinner — fluid-ribbon loader (default frl-v-02) + random phrase when showPhrase.
 */
export const Spinner = ({
  size = 'md',
  className = '',
  variant,
  showPhrase = false,
  phraseClassName = '',
}) => {
  const phrase = useLoadingPhrase();
  const loader = (
    <FluidRibbonLoader
      variant={variant || DEFAULT_LOADER_VARIANT}
      size={size}
      className={className}
      label={phrase}
    />
  );
  if (!showPhrase) return loader;
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {loader}
      <LoadingPhrase phrase={phrase} className={phraseClassName} />
    </div>
  );
};

/**
 * LoadingState — centered spinner + random phrase.
 */
export const LoadingState = ({ className = '', variant, phraseClassName = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-4 py-12 text-center ${className}`}>
    <Spinner size="lg" variant={variant} showPhrase phraseClassName={`text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] ${phraseClassName}`} />
  </div>
);

export default Spinner;
