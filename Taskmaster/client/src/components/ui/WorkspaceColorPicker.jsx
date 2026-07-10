import React, { useEffect, useState } from 'react';
import { Input } from './primitives';
import {
  DEFAULT_WORKSPACE_COLOR,
  PRESET_WORKSPACE_COLORS,
  normalizeHexColor,
} from '../../utils/workspaceColors';

const WorkspaceColorPicker = ({ value, onChange, disabled = false }) => {
  const resolved = normalizeHexColor(value) || DEFAULT_WORKSPACE_COLOR;
  const [hexInput, setHexInput] = useState(resolved);

  useEffect(() => {
    setHexInput(normalizeHexColor(value) || DEFAULT_WORKSPACE_COLOR);
  }, [value]);

  const applyColor = (next) => {
    const normalized = normalizeHexColor(next);
    if (!normalized) return;
    onChange(normalized);
    setHexInput(normalized);
  };

  const handleHexBlur = () => {
    const normalized = normalizeHexColor(hexInput);
    if (normalized) {
      applyColor(normalized);
    } else {
      setHexInput(resolved);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)]">
        {PRESET_WORKSPACE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => applyColor(c)}
            className={`w-7 h-7 rounded-full transition-all duration-200 disabled:opacity-40 ${
              resolved === c
                ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-workspace)] scale-110 ring-[var(--color-text-primary)]'
                : 'hover:scale-105 opacity-80 hover:opacity-100'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="relative shrink-0 cursor-pointer disabled:cursor-not-allowed">
          <input
            type="color"
            value={resolved}
            disabled={disabled}
            onChange={(e) => applyColor(e.target.value)}
            className="sr-only"
          />
          <span
            className="block w-10 h-10 rounded-xl border border-[var(--color-bg-border)] shadow-inner"
            style={{ backgroundColor: resolved }}
          />
        </label>
        <div className="flex-1 min-w-0">
          <Input
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={handleHexBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleHexBlur();
              }
            }}
            placeholder="#64748b"
            disabled={disabled}
            className="!py-2 !text-xs font-mono uppercase"
          />
        </div>
        <div
          className="w-3 h-3 rounded-full shrink-0 border border-[var(--color-bg-border)]"
          style={{ backgroundColor: resolved }}
          title="Preview"
        />
      </div>
    </div>
  );
};

export default WorkspaceColorPicker;
