import React from 'react';
import BrandLogo from '../brand/BrandLogo';
import AuthLegalFooter from './AuthLegalFooter';
import AuthSparkleWatermark from './AuthSparkleWatermark';
import { brand } from '../../constants/marketingContent';
import { AUTH_PANEL_TEAL } from '../../config/clerkAppearance';

/**
 * Unified auth card — cream brand panel + teal sign-in zone; centered on all viewports.
 */
export default function AuthMarketingShell({
  title,
  subtitle,
  children,
  asideLinks,
  panelClassName = '',
}) {
  return (
    <div className="tm-auth-page tm-marketing-page w-full min-h-dvh supports-[min-height:100dvh]:min-h-dvh min-h-screen bg-[var(--brand-cream-wash)] text-foreground relative overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--brand-teal-deep)]/[0.04] via-[var(--brand-cream-wash)] to-[var(--brand-green)]/[0.06]"
      />

      <div className="relative z-10 flex min-h-dvh supports-[min-height:100dvh]:min-h-dvh min-h-screen w-full items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 sm:gap-5">
          <div
            className={`w-full overflow-hidden rounded-2xl border border-[var(--brand-teal-deep)]/10 shadow-[0_20px_50px_-12px_rgba(8,61,58,0.18)] grid md:grid-cols-2 md:min-h-[26rem] animate-in fade-in zoom-in-95 duration-300 ${panelClassName}`}
          >
            <aside className="order-2 flex flex-col justify-center bg-[var(--brand-cream-wash)] px-6 py-7 sm:px-8 sm:py-8 md:order-1 md:px-10 md:py-10">
              <div className="mx-auto w-full max-w-sm text-center md:mx-0 md:max-w-none md:text-left">
                <BrandLogo size={56} className="mx-auto mb-4 md:mx-0" />
                <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-teal-deep)]">
                  {title || brand.name}
                </h1>
                {subtitle ? (
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--brand-teal-mid)]">
                    {subtitle}
                  </p>
                ) : null}
                {asideLinks ? (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm md:justify-start">
                    {asideLinks}
                  </div>
                ) : null}
              </div>
            </aside>

            <section
              className="order-1 relative flex items-center justify-center px-5 py-7 sm:px-7 sm:py-8 md:order-2 md:px-9 md:py-10"
              style={{ backgroundColor: AUTH_PANEL_TEAL }}
            >
              <AuthSparkleWatermark />
              <div className="relative z-10 mx-auto w-full max-w-[22rem]">
                {children}
              </div>
            </section>
          </div>

          <AuthLegalFooter />
        </div>
      </div>
    </div>
  );
}
