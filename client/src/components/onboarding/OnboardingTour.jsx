import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { getVisibleOnboardingSteps } from '../../constants/onboardingSteps';
import { hasCompletedOnboarding, markOnboardingCompleted, resetOnboarding } from '../../utils/onboardingStorage';
import { useAuth } from '../../contexts/AuthContext';

const PAD = 8;
const Z_INDEX = 9990;
const AUTO_START_DELAY_MS = 1200;
const VIEWPORT_MARGIN = 16;
const MOBILE_DOCK_OFFSET = 'calc(5.5rem + env(safe-area-inset-bottom))';
const CARD_HEIGHT_ESTIMATE = 300;

function isDashboardRoute(pathname) {
  return pathname === '/dashboard' || pathname === '/';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function measureTarget(selector) {
  if (!selector || typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 && rect.height < 1) return null;
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
}

function cardMaxWidth(isCenterStep, isMobile) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
  const cap = isCenterStep ? 520 : isMobile ? 400 : 360;
  return Math.min(cap, vw - VIEWPORT_MARGIN * 2);
}

/** Layout modes avoid CSS transform — Framer Motion also uses transform for animation. */
function computeTooltipLayout(placement, rect, isMobile, isCenterStep) {
  const maxWidth = cardMaxWidth(isCenterStep, isMobile);

  if (!rect || placement === 'center' || isCenterStep) {
    return { mode: 'center', maxWidth, isCenterStep: true, anchored: null };
  }

  if (isMobile) {
    return { mode: 'mobile-dock', maxWidth, isCenterStep: false, anchored: null };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = VIEWPORT_MARGIN;
  const gap = 12;
  let top;
  let left;

  if (placement === 'bottom') {
    top = rect.top + rect.height + gap;
    left = rect.left + rect.width / 2 - maxWidth / 2;
  } else if (placement === 'top') {
    top = rect.top - gap - CARD_HEIGHT_ESTIMATE;
    left = rect.left + rect.width / 2 - maxWidth / 2;
  } else if (placement === 'right') {
    top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2;
    left = rect.left + rect.width + gap;
    if (left + maxWidth > vw - margin) {
      left = rect.left - gap - maxWidth;
    }
  } else if (placement === 'left') {
    top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2;
    left = rect.left - gap - maxWidth;
    if (left < margin) {
      left = rect.left + rect.width + gap;
    }
  } else {
    top = rect.top + rect.height + gap;
    left = rect.left;
  }

  left = clamp(left, margin, vw - margin - maxWidth);
  top = clamp(top, margin, vh - margin - CARD_HEIGHT_ESTIMATE);

  return {
    mode: 'anchored',
    maxWidth,
    isCenterStep: false,
    anchored: { top, left, maxHeight: vh - top - margin },
  };
}

export default function OnboardingTour() {
  const { user, sessionReady } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState(() => getVisibleOnboardingSteps(isMobile));
  const [spotlight, setSpotlight] = useState(null);
  const [layout, setLayout] = useState({
    mode: 'center',
    maxWidth: 520,
    isCenterStep: true,
    anchored: null,
  });
  const autoStartTimerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const visible = getVisibleOnboardingSteps(isMobile);
    setSteps(visible);
    setStepIndex((i) => Math.min(i, Math.max(0, visible.length - 1)));
  }, [active, isMobile]);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const clearAutoStartTimer = useCallback(() => {
    if (autoStartTimerRef.current) {
      window.clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
  }, []);

  const scheduleAutoStart = useCallback(() => {
    clearAutoStartTimer();
    if (!user?._id || !sessionReady) return;
    if (!isDashboardRoute(location.pathname)) return;
    if (hasCompletedOnboarding(user._id)) return;

    autoStartTimerRef.current = window.setTimeout(() => {
      autoStartTimerRef.current = null;
      setStepIndex(0);
      setActive(true);
    }, AUTO_START_DELAY_MS);
  }, [clearAutoStartTimer, user?._id, sessionReady, location.pathname]);

  const finish = useCallback(() => {
    if (user?._id) markOnboardingCompleted(user._id);
    window.dispatchEvent(new CustomEvent('coreknot:onboarding-complete'));
    setActive(false);
  }, [user?._id]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const refreshLayout = useCallback(() => {
    if (!step) return;
    const isCenterStep = !step.target || step.placement === 'center';
    if (step.target) {
      const el = document.querySelector(step.target);
      el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    window.requestAnimationFrame(() => {
      const rect = step.target ? measureTarget(step.target) : null;
      setSpotlight(isCenterStep ? null : rect);
      setLayout(computeTooltipLayout(step.placement, rect, isMobile, isCenterStep));
    });
  }, [step, isMobile]);

  useEffect(() => {
    scheduleAutoStart();
    return clearAutoStartTimer;
  }, [scheduleAutoStart, clearAutoStartTimer]);

  useEffect(() => {
    const replay = () => {
      if (!user?._id) return;
      clearAutoStartTimer();
      resetOnboarding(user._id);
      setStepIndex(0);
      setActive(true);
    };
    window.addEventListener('coreknot:replay-onboarding', replay);
    return () => window.removeEventListener('coreknot:replay-onboarding', replay);
  }, [user?._id, clearAutoStartTimer]);

  useLayoutEffect(() => {
    if (!active || !step) return undefined;

    let highlightedEl = null;
    if (step.target) {
      highlightedEl = document.querySelector(step.target);
      if (highlightedEl) highlightedEl.dataset.tourHighlighted = 'true';
    }

    refreshLayout();
    window.addEventListener('resize', refreshLayout);
    window.addEventListener('scroll', refreshLayout, true);
    return () => {
      if (highlightedEl) delete highlightedEl.dataset.tourHighlighted;
      window.removeEventListener('resize', refreshLayout);
      window.removeEventListener('scroll', refreshLayout, true);
    };
  }, [active, step, refreshLayout]);

  useEffect(() => {
    if (!active) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [active]);

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  if (!active || !step || steps.length === 0 || typeof document === 'undefined') return null;

  const isCenterStep = layout.isCenterStep;

  const renderTourCard = () => (
    <div className="w-full max-w-full min-w-0 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-2xl overflow-hidden box-border">
      <div className={`flex items-start justify-between gap-3 min-w-0 ${isCenterStep ? 'px-5 sm:px-7 pt-6 sm:pt-7 pb-2' : 'px-4 sm:px-5 pt-4 sm:pt-5 pb-2'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl bg-[#126d5e]/15 text-[#126d5e] ${
              isCenterStep ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-8 w-8'
            }`}
          >
            <Sparkles size={isCenterStep ? 18 : 16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2
              id="onboarding-tour-title"
              className={`font-bold text-[var(--color-text-primary)] leading-snug break-words ${
                isCenterStep ? 'text-lg sm:text-xl md:text-2xl' : 'text-base'
              }`}
            >
              {step.title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={skip}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
          aria-label="Skip tutorial"
        >
          <X size={16} />
        </button>
      </div>

      <p
        className={`text-[var(--color-text-secondary)] leading-relaxed break-words ${
          isCenterStep ? 'px-5 sm:px-7 pb-5 sm:pb-6 text-sm sm:text-base' : 'px-4 sm:px-5 pb-4 text-sm'
        }`}
      >
        {step.body}
      </p>

      <div className={`flex items-center gap-1.5 ${isCenterStep ? 'px-5 sm:px-7 pb-3 sm:pb-4' : 'px-4 sm:px-5 pb-3'}`}>
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all ${
              i === stepIndex ? 'w-6 bg-[#126d5e]' : 'w-1.5 bg-[var(--color-bg-border)]'
            }`}
          />
        ))}
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] ${
          isCenterStep ? 'px-5 sm:px-7 py-4 sm:py-5' : 'px-4 sm:px-5 py-3 sm:py-4'
        }`}
      >
        <button
          type="button"
          onClick={skip}
          className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1.5"
        >
          Skip tutorial
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-bg-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-[#126d5e] px-4 py-2 text-xs font-bold text-white hover:bg-[#0f5c4f]"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderCardShell = () => (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto w-full min-w-0"
      style={{ maxWidth: layout.maxWidth }}
    >
      {renderTourCard()}
    </motion.div>
  );

  const renderCardHost = () => {
    if (layout.mode === 'center') {
      return (
        <div className="fixed inset-0 z-[9991] flex items-center justify-center pointer-events-none p-4 sm:p-6">
          {renderCardShell()}
        </div>
      );
    }

    if (layout.mode === 'mobile-dock') {
      return (
        <div
          className="fixed inset-x-0 z-[9991] flex justify-center pointer-events-none px-4"
          style={{
            bottom: MOBILE_DOCK_OFFSET,
            maxHeight: `calc(100vh - ${MOBILE_DOCK_OFFSET} - ${VIEWPORT_MARGIN}px)`,
          }}
        >
          <div className="w-full min-w-0 overflow-y-auto overscroll-contain pointer-events-auto">
            {renderCardShell()}
          </div>
        </div>
      );
    }

    const { top, left, maxHeight } = layout.anchored || { top: VIEWPORT_MARGIN, left: VIEWPORT_MARGIN, maxHeight: 400 };
    return (
      <div
        className="fixed z-[9991] pointer-events-auto overflow-y-auto overscroll-contain"
        style={{
          top,
          left,
          width: layout.maxWidth,
          maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
          maxHeight,
        }}
      >
        {renderCardShell()}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: Z_INDEX }} role="presentation">
      {isCenterStep ? (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" aria-hidden />
      ) : spotlight ? (
        <motion.div
          key={`spot-${step.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed rounded-xl"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            outline: '2px solid #126d5e',
            outlineOffset: 2,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" aria-hidden />
      )}

      {renderCardHost()}
    </div>,
    document.body
  );
}
