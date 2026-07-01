import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Read a CSS custom property duration in ms (strips "ms" / "s"). */
export function readMotionMs(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  if (raw.endsWith('ms')) return parseFloat(raw) || fallback;
  if (raw.endsWith('s')) return (parseFloat(raw) || 0) * 1000 || fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Open / close surface (.is-open / .is-closing) for modal + dropdown.
 * Keeps mounted through close animation.
 */
export function useTransitionSurface(
  isOpen,
  { closeVar = '--dropdown-close-dur', closeFallback = 150 } = {},
) {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setClosing(true);
    const ms = readMotionMs(closeVar, closeFallback);
    const timer = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, ms);
    return () => clearTimeout(timer);
  }, [isOpen, mounted, closeVar, closeFallback]);

  const surfaceClass = isOpen ? 'is-open' : closing ? 'is-closing' : '';

  return { mounted, surfaceClass, closing };
}

/** Sliding pill for .t-tabs segmented controls. */
export function useSlidingTabs(activeSelector = '[aria-selected="true"], .is-active') {
  const barRef = useRef(null);
  const pillRef = useRef(null);

  const movePill = useCallback(
    (animate) => {
      const bar = barRef.current;
      const pill = pillRef.current;
      if (!bar || !pill) return;
      const tab =
        bar.querySelector(activeSelector) || bar.querySelector('.t-tab');
      if (!tab) return;
      const apply = () => {
        pill.style.transform = `translateX(${tab.offsetLeft}px)`;
        pill.style.width = `${tab.offsetWidth}px`;
        pill.style.top = `${tab.offsetTop}px`;
        pill.style.height = `${tab.offsetHeight}px`;
      };
      if (!animate) {
        const prev = pill.style.transition;
        pill.style.transition = 'none';
        apply();
        void pill.offsetWidth;
        pill.style.transition = prev;
      } else {
        apply();
      }
    },
    [activeSelector],
  );

  useLayoutEffect(() => {
    requestAnimationFrame(() => movePill(false));
  });

  useEffect(() => {
    const onResize = () => movePill(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [movePill]);

  return { barRef, pillRef, movePill };
}

/** 3D card tilt — bind pointerProps to outer wrapper. */
export function useCardTilt({ maxDeg = 12, glare = true } = {}) {
  const wrapRef = useRef(null);
  const cardRef = useRef(null);

  const reset = useCallback(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    wrap.classList.remove('is-hover');
    card.classList.remove('is-tilting');
    card.style.setProperty('--tilt-rx', '0deg');
    card.style.setProperty('--tilt-ry', '0deg');
  }, []);

  const track = useCallback(
    (e) => {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const wrap = wrapRef.current;
      const card = cardRef.current;
      if (!wrap || !card) return;
      const r = wrap.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      wrap.classList.add('is-hover');
      card.classList.add('is-tilting');
      card.style.setProperty('--tilt-ry', `${((px - 0.5) * maxDeg).toFixed(2)}deg`);
      card.style.setProperty('--tilt-rx', `${((0.5 - py) * maxDeg).toFixed(2)}deg`);
      if (glare) {
        card.style.setProperty('--tilt-gx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--tilt-gy', `${(py * 100).toFixed(1)}%`);
      }
    },
    [maxDeg, glare],
  );

  const pointerProps = {
    onPointerDown: (e) => {
      if (e.pointerType !== 'mouse') {
        try {
          wrapRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    onPointerMove: track,
    onPointerUp: reset,
    onPointerCancel: reset,
    onPointerLeave: (e) => {
      if (e.pointerType === 'mouse') reset();
    },
  };

  return { wrapRef, cardRef, pointerProps, reset };
}

/** Staggered text reveal on mount (.t-stagger.is-shown). */
export function useStaggerReveal(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.classList.remove('is-hiding', 'is-shown');
    void el.offsetHeight;
    el.classList.add('is-shown');
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Shake input on validation error. */
export function useInputErrorShake(error, inputRef) {
  const wrapRef = useRef(null);
  const revertTimer = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const input = inputRef?.current;
    if (!error || !wrap || !input) return undefined;

    wrap.classList.add('is-error');
    input.classList.add('is-error', 't-input');
    input.classList.remove('is-shaking');
    void input.offsetWidth;
    input.classList.add('is-shaking');

    const shakeMs =
      readMotionMs('--shake-dur-a', 80) * 2 + readMotionMs('--shake-dur-b', 60) * 2;
    const shakeTimer = setTimeout(() => input.classList.remove('is-shaking'), shakeMs + 20);

    if (revertTimer.current) clearTimeout(revertTimer.current);
    const hold = readMotionMs('--revert-hold', 3000);
    revertTimer.current = setTimeout(() => {
      wrap.classList.remove('is-error');
      input.classList.remove('is-error');
      revertTimer.current = null;
    }, shakeMs + hold);

    return () => {
      clearTimeout(shakeTimer);
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, [error, inputRef]);

  const clearError = useCallback(() => {
    const wrap = wrapRef.current;
    const input = inputRef?.current;
    if (revertTimer.current) {
      clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
    wrap?.classList.remove('is-error');
    input?.classList.remove('is-error', 'is-shaking');
  }, [inputRef]);

  return { wrapRef, clearError };
}

/** Cubic-bezier sampler matching CSS easing strings. */
function bezierSample(str) {
  const m = String(str).match(/cubic-bezier\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/);
  if (!m) return (t) => t;
  const [x1, y1, x2, y2] = m.slice(1).map(parseFloat);
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const dx = ((ax * s + bx) * s + cx) * s - t;
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(dx) < 1e-6 || d === 0) break;
      s -= dx / d;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

function motionNum(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Input clear with dissolve (transitions.dev #13).
 * Attach wrapRef to `.t-clear` wrapper; call clearAnimated() from clear button.
 */
export function useInputClearDissolve({ value, onClear, placeholder = '' }) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const clearingRef = useRef(false);
  const canvasRef = useRef(null);

  const syncMirror = useCallback(() => {
    const wrap = wrapRef.current;
    const input = inputRef.current;
    const mirror = wrap?.querySelector('.t-clear-mirror');
    if (!wrap || !mirror) return;
    const has = String(value ?? input?.value ?? '').length > 0;
    wrap.classList.toggle('has-value', has);
    if (has) mirror.textContent = String(value ?? input?.value ?? '').replace(/ /g, '\u00a0');
  }, [value]);

  useEffect(() => {
    syncMirror();
  }, [syncMirror]);

  const clearAnimated = useCallback(() => {
    const wrap = wrapRef.current;
    const input = inputRef.current;
    if (!wrap || !input || clearingRef.current) return;

    const current = String(value ?? input.value ?? '');
    if (!current) {
      onClear?.();
      return;
    }

    clearingRef.current = true;
    const mirror = wrap.querySelector('.t-clear-mirror');
    const phold = wrap.querySelector('.t-clear-placeholder');
    const glow = wrap.querySelector('.t-clear-glow');
    if (!mirror || !phold || !glow) {
      clearingRef.current = false;
      onClear?.();
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas').getContext('2d');
    }
    const canvas = canvasRef.current;
    const root = document.documentElement;
    const keepFocus = document.activeElement === input;

    mirror.textContent = current.replace(/ /g, '\u00a0');

    const total = motionNum('--clear-dur', 1000);
    const outDur = motionNum('--clear-out-dur', 400);
    const inDur = motionNum('--clear-in-dur', 400);
    const outFly = motionNum('--clear-out-fly', 12);
    const inFly = motionNum('--clear-in-fly', 12);
    const blur = motionNum('--clear-blur', 2);
    const delay = motionNum('--glow-delay', 50);
    const peakAt = motionNum('--glow-peak-at', 0.15);
    const gOp = motionNum('--glow-opacity', 0.42);
    const easeOut = bezierSample(getComputedStyle(root).getPropertyValue('--clear-out-ease'));
    const easeIn = bezierSample(getComputedStyle(root).getPropertyValue('--clear-in-ease'));

    const buildGlow = (text) => {
      canvas.font = getComputedStyle(input).font;
      const isDark = root.getAttribute('data-theme') === 'dark';
      const rgb = isDark ? '255,255,255' : '0,0,0';
      const w = wrap.clientWidth || 280;
      const padLeft = parseFloat(getComputedStyle(input).paddingLeft) || 12;
      const spread = motionNum('--glow-spread', 1.5);
      const layers = [];
      let x = 0;
      text.split(/(\s+)/).forEach((seg) => {
        const segW = canvas.measureText(seg).width;
        if (seg.trim()) {
          const cx = padLeft + x + segW / 2;
          const hw = Math.max(segW * 0.45, 8) * spread;
          [
            [0, 0.8, 7, 0.22],
            [hw * 0.45, 0.55, 8, 0.18],
            [-hw * 0.4, 0.65, 6, 0.16],
            [hw * 0.15, 0.9, 5, 0.14],
          ].forEach(([dx, rwm, rh, a]) => {
            const lx = (((cx + dx) / w) * 100).toFixed(2);
            layers.push(
              `radial-gradient(ellipse ${Math.max(hw * rwm, 2).toFixed(1)}px ${rh}px at ${lx}% 100%, rgba(${rgb},${a}), transparent)`,
            );
          });
        }
        x += segW;
      });
      return layers.join(', ');
    };

    onClear?.();
    wrap.classList.remove('has-value');
    wrap.classList.add('is-clearing');
    glow.style.background = buildGlow(mirror.textContent);
    glow.style.opacity = '0';
    phold.textContent = placeholder;
    phold.style.transform = `translateY(-${inFly}px)`;
    phold.style.opacity = '0.9';
    phold.style.filter = `blur(${blur}px)`;

    const t0 = performance.now();
    const tick = (now) => {
      const el = now - t0;
      const eo = easeOut(Math.min(1, el / outDur));
      mirror.style.transform = `translateY(${(eo * outFly).toFixed(1)}px)`;
      mirror.style.opacity = (1 - eo).toFixed(3);
      mirror.style.filter = `blur(${(eo * blur).toFixed(1)}px)`;

      const ei = easeIn(Math.min(1, el / inDur));
      phold.style.transform = `translateY(${(-inFly + ei * inFly).toFixed(1)}px)`;
      phold.style.opacity = (0.9 + ei * 0.1).toFixed(3);
      phold.style.filter = `blur(${(blur - ei * blur).toFixed(1)}px)`;

      let g = 0;
      if (el > delay) {
        const gp = Math.min(1, (el - delay) / Math.max(1, total - delay));
        g = gp < peakAt ? gp / peakAt : 1 - (gp - peakAt) / (1 - peakAt);
      }
      glow.style.opacity = (g * gOp).toFixed(3);

      if (el < total) {
        requestAnimationFrame(tick);
      } else {
        wrap.classList.remove('is-clearing');
        [mirror, phold].forEach((elNode) => {
          elNode.style.cssText = '';
        });
        mirror.textContent = '';
        glow.style.opacity = '0';
        glow.style.background = '';
        clearingRef.current = false;
        if (keepFocus) requestAnimationFrame(() => input.focus({ preventScroll: true }));
      }
    };
    requestAnimationFrame(tick);
  }, [onClear, placeholder, value]);

  return { wrapRef, inputRef, clearAnimated, syncMirror };
}
