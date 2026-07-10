/** 5 uniform wide-hub cascades — default spinner: frl-v-02 (Uniform Calm) */

export const DEFAULT_LOADER_VARIANT = 'frl-v-02';
export const CASCADE_LAYER_COUNT = 4;
export const INNER_RESTART_SLOT = 2;

function cascadeVariant({ id, name, className, dur, waveGap, maxR, band }) {
  const cyclePeriod = waveGap * INNER_RESTART_SLOT;
  return {
    id,
    name,
    className,
    dur,
    waveGap,
    cyclePeriod,
    maxR,
    band,
  };
}

export const FLUID_RIBBON_LOADER_VARIANTS = [
  cascadeVariant({
    id: 'frl-v-01',
    name: 'Uniform Wide',
    className: 'frl-v-01',
    dur: '3.8s',
    waveGap: 0.5,
    maxR: 48,
    band: 12,
  }),
  cascadeVariant({
    id: 'frl-v-02',
    name: 'Uniform Calm',
    className: 'frl-v-02',
    dur: '4.2s',
    waveGap: 0.52,
    maxR: 48,
    band: 13,
  }),
  cascadeVariant({
    id: 'frl-v-03',
    name: 'Uniform Steady',
    className: 'frl-v-03',
    dur: '3.8s',
    waveGap: 0.48,
    maxR: 47,
    band: 14,
  }),
  cascadeVariant({
    id: 'frl-v-04',
    name: 'Uniform Flow',
    className: 'frl-v-04',
    dur: '3.6s',
    waveGap: 0.46,
    maxR: 48,
    band: 12,
  }),
  cascadeVariant({
    id: 'frl-v-05',
    name: 'Uniform Pulse',
    className: 'frl-v-05',
    dur: '3.5s',
    waveGap: 0.42,
    maxR: 47,
    band: 11,
  }),
];

export function getLoaderVariant(id = DEFAULT_LOADER_VARIANT) {
  return FLUID_RIBBON_LOADER_VARIANTS.find((v) => v.id === id) || FLUID_RIBBON_LOADER_VARIANTS[1];
}
