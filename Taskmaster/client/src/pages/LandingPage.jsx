import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Briefcase,
  Mail,
  Users,
  Calendar,
  CreditCard,
  Shield,
  Star,
  Download,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BootScreen from '../components/BootScreen';
import WithClerkWhenConfigured from '../components/auth/WithClerkWhenConfigured';
import BrandLogo from '../components/brand/BrandLogo';
import LandingDashboardPreview from '../components/landing/LandingDashboardPreview';
import { authUrl, appUrl, hasSameOriginAuthRoutes } from '../config/siteUrls';
import { isClerkConfigured } from '../config/clerk';
import {
  brand,
  footer,
  landingFeaturePillars,
  landingHero,
  landingNavLinks,
  landingSections,
} from '../constants/marketingContent';

const FEATURE_ICONS = { Briefcase, Mail, Users, Calendar };
const TRUST_ICONS = { CreditCard, Shield, Users };

function AuthLink({ to, className, children, ...props }) {
  if (hasSameOriginAuthRoutes()) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <a href={authUrl(to)} className={className} {...props}>
      {children}
    </a>
  );
}

function NavAnchor({ href, className, children }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export default function LandingPage() {
  return (
    <WithClerkWhenConfigured>
      {({ isLoaded: clerkLoaded, isSignedIn: clerkSignedIn }) => (
        <LandingPageView clerkLoaded={clerkLoaded} clerkSignedIn={clerkSignedIn} />
      )}
    </WithClerkWhenConfigured>
  );
}

function LandingPageView({ clerkLoaded, clerkSignedIn }) {
  const { user, loading } = useAuth();

  const clerkSessionPending = isClerkConfigured()
    && clerkLoaded
    && clerkSignedIn
    && !user;

  if (loading || clerkSessionPending) {
    return <BootScreen />;
  }

  if (user) {
    if (hasSameOriginAuthRoutes()) {
      return <Navigate to="/dashboard" replace />;
    }
    window.location.replace(appUrl('/dashboard'));
    return null;
  }

  const demoHref = `mailto:${brand.supportEmail}?subject=CoreKnot%20Demo%20Request`;

  return (
    <div className="tm-marketing-page tm-landing min-h-screen bg-[var(--landing-beige-wash)] text-[var(--landing-green-dark)] flex flex-col font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-[var(--landing-beige)] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <BrandLogo size={36} />
            <div className="leading-tight">
              <span className="font-bold text-sm tracking-tight block">{brand.name}</span>
              <span className="text-[10px] text-[var(--landing-green-mid)]">{brand.tagline}</span>
            </div>
          </div>

          <nav
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-[var(--landing-green-mid)]"
            aria-label="Primary"
          >
            {landingNavLinks.map((link) => (
              <NavAnchor
                key={link.href}
                href={link.href}
                className="hover:text-[var(--landing-green-dark)] transition-colors"
              >
                {link.label}
              </NavAnchor>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <AuthLink
              to="/login"
              className="px-3.5 py-2 rounded-lg border border-[var(--landing-beige)] bg-white hover:bg-[var(--landing-beige)]/50 text-xs sm:text-sm font-semibold text-[var(--landing-green-dark)] transition"
            >
              Sign In
            </AuthLink>
            <AuthLink
              to="/register"
              className="px-3.5 py-2 rounded-lg bg-[var(--landing-green-dark)] hover:bg-[var(--landing-green-mid)] text-xs sm:text-sm font-semibold text-white transition shadow-sm"
            >
              Get Started
            </AuthLink>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-14 sm:pb-20"
          aria-labelledby="landing-hero-title"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="space-y-6 text-left">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--landing-accent)]/15 border border-[var(--landing-accent)]/30 text-[var(--landing-green-dark)] text-xs font-bold">
                {landingHero.eyebrow}
              </span>

              <h1
                id="landing-hero-title"
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black tracking-tight text-[var(--landing-green-dark)] leading-[1.1] text-balance"
              >
                {landingHero.title}
              </h1>

              <p className="text-base sm:text-lg text-[var(--landing-green-mid)] leading-relaxed max-w-xl">
                {landingHero.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <AuthLink
                  to="/register"
                  className="px-5 py-3 rounded-xl bg-[var(--landing-green-dark)] hover:bg-[var(--landing-green-mid)] text-white font-bold text-sm transition shadow-lg shadow-[var(--landing-green-dark)]/20"
                >
                  {landingHero.ctaPrimary}
                </AuthLink>
                <a
                  href={demoHref}
                  className="px-5 py-3 rounded-xl border border-[var(--landing-beige)] bg-white hover:bg-[var(--landing-beige)]/60 text-[var(--landing-green-dark)] font-bold text-sm transition"
                >
                  {landingHero.ctaSecondary}
                </a>
                <a
                  href={landingHero.desktopDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--landing-green-mid)]/20 bg-white hover:bg-[var(--landing-beige)]/60 text-[var(--landing-green-dark)] font-bold text-sm transition"
                >
                  <Download size={16} aria-hidden />
                  {landingHero.desktopDownloadCta}
                </a>
              </div>

              <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-5 pt-2" aria-label="Trust indicators">
                {landingHero.trustBadges.map((badge) => {
                  const Icon = TRUST_ICONS[badge.icon] ?? Shield;
                  return (
                    <li key={badge.label} className="flex items-center gap-2 text-xs text-[var(--landing-green-mid)]">
                      <Icon size={14} className="text-[var(--landing-accent)] shrink-0" aria-hidden />
                      {badge.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <LandingDashboardPreview />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="bg-white border-y border-[var(--landing-beige)] py-16 sm:py-20 scroll-mt-20"
          aria-labelledby="landing-features-title"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <h2
                id="landing-features-title"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--landing-green-dark)]"
              >
                {landingSections.features.title}
              </h2>
              <p className="text-[var(--landing-green-mid)] text-base leading-relaxed">
                {landingSections.features.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {landingFeaturePillars.map((feat) => {
                const Icon = FEATURE_ICONS[feat.icon] ?? Briefcase;
                return (
                  <div
                    key={feat.title}
                    className="p-5 rounded-xl bg-white border border-[var(--landing-beige)] flex flex-col gap-3 hover:border-[var(--landing-green-mid)]/40 transition"
                  >
                    <div className="w-11 h-11 rounded-lg bg-[var(--landing-green-dark)]/8 text-[var(--landing-green-dark)] flex items-center justify-center">
                      <Icon size={22} aria-hidden />
                    </div>
                    <h3 className="font-bold text-sm text-[var(--landing-green-dark)]">{feat.title}</h3>
                    <p className="text-sm text-[var(--landing-green-mid)] leading-relaxed">{feat.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Metrics & social proof */}
        <section
          id="solutions"
          className="bg-[var(--landing-beige)] py-10 sm:py-12 scroll-mt-20"
          aria-label="Social proof"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <p className="text-sm sm:text-base font-semibold text-[var(--landing-green-dark)] text-center lg:text-left shrink-0">
                {landingSections.metrics.headline}
              </p>

              <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
                {landingSections.metrics.stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-[var(--landing-green-dark)]">
                      {stat.value}
                    </div>
                    <div className="text-xs text-[var(--landing-green-mid)] font-medium mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 opacity-40" aria-hidden="true">
                {['Logo', 'Logo', 'Logo'].map((_, i) => (
                  <div
                    key={i}
                    className="h-6 w-20 rounded bg-[var(--landing-green-mid)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--landing-green-mid)] uppercase tracking-widest"
                  >
                    Partner
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section
          id="resources"
          className="bg-[var(--landing-beige-wash)] py-16 sm:py-20 scroll-mt-20"
          aria-labelledby="landing-testimonials-title"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2
              id="landing-testimonials-title"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--landing-green-dark)] text-center mb-12"
            >
              {landingSections.testimonials.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {landingSections.testimonials.items.map((item) => (
                <article
                  key={item.name}
                  className="p-6 rounded-xl bg-white border border-[var(--landing-beige)] flex flex-col gap-4"
                >
                  <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className="fill-[var(--landing-accent)] text-[var(--landing-accent)]"
                        aria-hidden
                      />
                    ))}
                  </div>
                  <blockquote className="text-sm text-[var(--landing-green-mid)] leading-relaxed italic flex-1">
                    &ldquo;{item.quote}&rdquo;
                  </blockquote>
                  <footer className="flex items-center gap-3 pt-2 border-t border-[var(--landing-beige)]">
                    <div
                      className="w-9 h-9 rounded-full bg-[var(--landing-green-dark)] text-white text-xs font-bold flex items-center justify-center shrink-0"
                      aria-hidden
                    >
                      {item.initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--landing-green-dark)]">{item.name}</div>
                      <div className="text-xs text-[var(--landing-green-mid)]">{item.role}</div>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          id="pricing"
          className="bg-[var(--landing-green-dark)] py-14 sm:py-16 scroll-mt-20"
          aria-labelledby="landing-cta-title"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <h2 id="landing-cta-title" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {landingSections.finalCta.title}
            </h2>
            <p className="text-white/75 text-base">{landingSections.finalCta.description}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <AuthLink
                to="/register"
                className="px-6 py-3 rounded-xl bg-[var(--landing-accent)] hover:brightness-105 text-[var(--landing-green-dark)] font-bold text-sm transition shadow-lg"
              >
                {landingSections.finalCta.ctaPrimary}
              </AuthLink>
              <a
                href={demoHref}
                className="px-6 py-3 rounded-xl border border-white/30 text-white hover:bg-white/10 font-bold text-sm transition"
              >
                {landingSections.finalCta.ctaSecondary}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="about" className="bg-white border-t border-[var(--landing-beige)] py-10 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <BrandLogo size={28} />
            <span className="font-bold text-sm text-[var(--landing-green-dark)]">{brand.name}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-5 text-xs text-[var(--landing-green-mid)] font-medium">
            <Link to="/privacy" className="hover:text-[var(--landing-green-dark)] transition">
              {footer.privacyLabel}
            </Link>
            <Link to="/userdata" className="hover:text-[var(--landing-green-dark)] transition">
              {footer.userDataLabel}
            </Link>
            <a href={`mailto:${brand.supportEmail}`} className="hover:text-[var(--landing-green-dark)] transition">
              {footer.contactLabel}
            </a>
          </div>

          <span className="text-xs text-[var(--landing-green-mid)] font-medium text-center sm:text-right">
            {footer.copyright()}
          </span>
        </div>
      </footer>
    </div>
  );
}
