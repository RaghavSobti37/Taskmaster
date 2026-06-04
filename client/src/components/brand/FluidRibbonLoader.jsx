import React, { useId } from 'react';
import { FLUID_RIBBON_PATHS } from './fluidRibbonPaths';
import { DEFAULT_LOADER_VARIANT, getLoaderVariant } from './fluidRibbonLoaderCatalog';
import './fluidRibbonLoader.css';

const SIZES = { sm: 14, md: 20, lg: 28, xl: 40, boot: 88 };
const HUB = 32;
const HUB_GUARD_R = 5;

const LAYERS = [
  { key: '4', pathIndex: 3, className: 'frl-path frl-path-4', slot: 0 },
  { key: '3', pathIndex: 2, className: 'frl-path frl-path-3', slot: 1 },
  { key: '2', pathIndex: 1, className: 'frl-path frl-path-2', slot: 2 },
  { key: '1', pathIndex: 0, className: 'frl-path frl-path-1', slot: 3 },
];

function SweepMask({ id, begin, dur, maxR, band }) {
  const r0 = HUB_GUARD_R;
  const trail = Math.max(r0 + 2, maxR - band);

  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="black" />
      <circle cx={HUB} cy={HUB} r={r0} fill="white">
        <animate
          attributeName="r"
          values={`${r0};${maxR};${maxR};${r0}`}
          keyTimes="0;0.72;0.76;1"
          dur={dur}
          begin={begin}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </circle>
      <circle cx={HUB} cy={HUB} r={r0} fill="black">
        <animate
          attributeName="r"
          values={`${r0};${r0};${trail};${maxR};${maxR};${r0}`}
          keyTimes="0;0.1;0.62;0.72;0.76;1"
          dur={dur}
          begin={begin}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </circle>
      <circle cx={HUB} cy={HUB} r={HUB_GUARD_R} fill="black" />
    </mask>
  );
}

/**
 * Four ribbons cascade from hub. Inner restarts when 3rd wave starts (cycle = 2× waveGap).
 */
export function FluidRibbonLoader({
  variant = DEFAULT_LOADER_VARIANT,
  size = 'md',
  className = '',
  label = 'Please wait',
}) {
  const v = getLoaderVariant(variant);
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 64 64"
      width={px}
      height={px}
      className={`fluid-ribbon-loader ${v.className} shrink-0 text-[#126d5e] ${className}`}
      role="status"
      aria-label={label}
    >
      <defs>
        {LAYERS.map((layer) => (
          <SweepMask
            key={layer.key}
            id={`${uid}-m-${layer.key}`}
            begin={`${layer.slot * v.waveGap}s`}
            dur={v.dur}
            maxR={v.maxR}
            band={v.band}
          />
        ))}
      </defs>
      <g className="frl-stack">
        {LAYERS.map((layer) => (
          <path
            key={layer.key}
            className={layer.className}
            d={FLUID_RIBBON_PATHS[layer.pathIndex]}
            mask={`url(#${uid}-m-${layer.key})`}
          />
        ))}
        <circle className="frl-hub" cx={HUB} cy={HUB} r="2.5" />
      </g>
    </svg>
  );
}

export default FluidRibbonLoader;
