import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card } from '../ui';
import { DEFAULT_LOADER_VARIANT, FLUID_RIBBON_LOADER_VARIANTS } from './fluidRibbonLoaderCatalog';
import FluidRibbonLoader from './FluidRibbonLoader';
import BrandLogo from './BrandLogo';

export default function FluidRibbonLoaderGallery() {
  const [selected, setSelected] = useState(DEFAULT_LOADER_VARIANT);
  const [copied, setCopied] = useState('');

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* ignore */
    }
  };

  const selectedMeta = FLUID_RIBBON_LOADER_VARIANTS.find((v) => v.id === selected);

  return (
    <div className="logo-mark-gallery space-y-8">
      <div className="flex flex-wrap items-center gap-4 pb-2 border-b border-[#1e2d38]">
        <div className="logo-mark-tile w-[3.25rem] h-[3.25rem] shrink-0">
          <BrandLogo size={44} />
        </div>
        <div>
          <p className="text-sm font-bold text-[#d4ddd6]">App logo — The Harmonic Frequency (#99)</p>
          <p className="text-[10px] font-mono text-[#6b7f88] mt-1">harmonic-frequency · used everywhere</p>
        </div>
      </div>

      <p className="text-xs text-[#94a8b0] max-w-3xl leading-relaxed">
        App spinner: <code className="font-mono text-[#c8d6cc]">frl-v-02</code> everywhere. Logo: white-on-green (locked). Gallery variants below. Click — copy{' '}
        <code className="text-[10px] bg-[#1a2832] text-[#c8d6cc] px-1 py-0.5 rounded">variant</code> id. Default:{' '}
        <code className="text-[10px] bg-[#1a2832] text-[#c8d6cc] px-1 py-0.5 rounded">{DEFAULT_LOADER_VARIANT}</code>{' '}
        (set in <code className="font-mono text-[#c8d6cc]">fluidRibbonLoaderCatalog.js</code>).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {FLUID_RIBBON_LOADER_VARIANTS.map((item, idx) => {
          const active = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={`group text-left rounded-xl border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c4a4]/60 ${
                active
                  ? 'border-[#a8c4a4]/70 bg-[#152028] shadow-[0_0_0_1px_rgba(168,196,164,0.25)]'
                  : 'border-[#1e2d38] bg-[#111a22] hover:border-[#2d4a46]'
              }`}
            >
              <div className="logo-mark-tile w-full aspect-square flex items-center justify-center mb-2.5 mx-auto">
                <FluidRibbonLoader variant={item.id} size={44} />
              </div>
              <p className="text-[9px] font-bold text-[#6b7f88] mb-0.5">{String(idx + 1).padStart(2, '0')}</p>
              <p className="text-[10px] font-semibold text-[#d4ddd6] leading-snug line-clamp-2">{item.name}</p>
              <p className="mt-1 text-[9px] font-mono text-[#6b7f88] truncate">{item.id}</p>
            </button>
          );
        })}
      </div>

      {selectedMeta && (
        <Card className="logo-mark-gallery-detail p-6 border border-[#2d4a46] bg-[#111a22] space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="logo-mark-tile w-[3.5rem] h-[3.5rem] flex items-center justify-center shrink-0">
              <FluidRibbonLoader variant={selected} size={56} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#d4ddd6]">{selectedMeta.name}</p>
              <p className="text-xs font-mono text-[#6b7f88] mt-1">{selected}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => copyId(selected)}>
              {copied === selected ? (
                <>
                  <Check size={14} /> Copied variant id
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy variant id
                </>
              )}
            </Button>
            <p className="text-[10px] text-[#94a8b0] self-center">
              Set <code className="font-mono text-[#c8d6cc]">DEFAULT_LOADER_VARIANT</code> in{' '}
              <code className="font-mono text-[#c8d6cc]">fluidRibbonLoaderCatalog.js</code> or pass{' '}
              <code className="font-mono text-[#c8d6cc]">variant</code> to <code className="font-mono text-[#c8d6cc]">FluidRibbonLoader</code> /{' '}
              <code className="font-mono text-[#c8d6cc]">Spinner</code>.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
