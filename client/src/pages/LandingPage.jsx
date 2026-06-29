import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Briefcase,
  Mail,
  Users,
  ArrowRight,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MarketingPageBackground from '../components/MarketingPageBackground';
import MarketingThemeToggle from '../components/MarketingThemeToggle';
import BrandLogo from '../components/brand/BrandLogo';
import { authUrl, appUrl, hasSameOriginAuthRoutes } from '../config/siteUrls';
import {
  brand,
  footer,
  landingFeaturePillars,
  landingHero,
  landingSections,
} from '../constants/marketingContent';

const FEATURE_ICONS = { Briefcase, Mail, Users, Calendar };

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

export default function LandingPage() {
  const { user } = useAuth();

  if (user) {
    if (hasSameOriginAuthRoutes()) {
      return <Navigate to="/dashboard" replace />;
    }
    window.location.replace(appUrl('/dashboard'));
    return null;
  }

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden">
      <MarketingPageBackground />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 relative z-10">
          <BrandLogo size={40} />
          <div>
            <span className="font-bold text-base tracking-tight text-foreground block">{brand.name}</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">{brand.tagline}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <MarketingThemeToggle />
          <Link to="/privacy" className="text-xs text-[var(--color-text-secondary)] hover:text-foreground transition hidden sm:inline">
            {footer.privacyLabel}
          </Link>
          <AuthLink to="/login" className="px-4 py-2 rounded-xl bg-card hover:bg-background border border-border text-xs font-bold text-foreground transition">
            Sign In
          </AuthLink>
          <AuthLink to="/register" className="px-4 py-2 rounded-xl bg-[var(--color-brand-teal)] hover:bg-[var(--color-action-hover)] text-xs font-bold text-[var(--color-brand-cream)] transition shadow-lg shadow-[var(--color-brand-teal)]/20">
            Get Started
          </AuthLink>
        </div>
      </header>

      <main id="main-content">
        <section className="w-full max-w-6xl mx-auto px-6 pt-16 pb-14 text-center flex flex-col justify-center relative z-10" aria-labelledby="landing-hero-title">
          <div className="w-full max-w-3xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-brand-pumpkin)]/10 border border-[var(--color-brand-pumpkin)]/20 text-[var(--color-brand-pumpkin)] text-xs font-bold">
              <Sparkles size={12} aria-hidden /> {landingHero.eyebrow}
            </div>
            <h1 id="landing-hero-title" className="w-full text-4xl sm:text-6xl font-black tracking-tight text-foreground leading-tight text-balance">
              {landingHero.title}{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-brand-teal)] to-[var(--color-action-primary)]">
                {landingHero.titleAccent}
              </span>
            </h1>
            <p className="block w-full mx-auto text-base md:text-lg text-[var(--color-text-secondary)] text-center leading-relaxed font-medium" style={{ maxWidth: '700px' }}>
              {landingHero.description}
            </p>
            <ul className="mx-auto max-w-xl space-y-1.5 text-left text-sm text-[var(--color-text-secondary)]" aria-label="What CoreKnot includes">
              {landingHero.qualifiers.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-pumpkin)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
              <AuthLink
                to="/login"
                className="px-6 py-3.5 rounded-xl bg-[var(--color-brand-teal)] hover:bg-[var(--color-action-hover)] text-[var(--color-brand-cream)] font-bold text-sm transition flex items-center gap-2 shadow-xl shadow-[var(--color-brand-teal)]/25 group"
              >
                {landingHero.ctaPrimary} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden />
              </AuthLink>
              <AuthLink
                to="/register"
                className="px-6 py-3.5 rounded-xl bg-card hover:bg-background text-foreground border border-border font-bold text-sm transition"
              >
                {landingHero.ctaSecondary}
              </AuthLink>
            </div>
          </div>
        </section>

        <section className="bg-card/90 backdrop-blur-sm border-y border-border py-16 relative z-10" aria-labelledby="landing-features-title">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row gap-8 items-start w-full max-w-6xl mx-auto mb-12">
              <h2 id="landing-features-title" className="w-full md:w-1/3 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                {landingSections.features.title}
              </h2>
              <p className="w-full md:w-2/3 text-[var(--color-text-secondary)] text-base md:text-lg leading-relaxed whitespace-normal">
                {landingSections.features.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {landingFeaturePillars.map((feat) => {
                const Icon = FEATURE_ICONS[feat.icon] ?? Briefcase;
                return (
                  <div
                    key={feat.title}
                    className="p-6 rounded-2xl bg-background border border-border flex gap-4 items-start hover:border-[var(--color-brand-teal)] transition shadow-sm hover:shadow-md"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-teal)]/10 border border-[var(--color-brand-teal)]/20 text-[var(--color-brand-teal)] flex items-center justify-center shrink-0">
                      <Icon size={24} aria-hidden />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h3 className="font-bold text-base text-foreground">{feat.title}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{feat.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-background border-t border-border py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row sm:items-start items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo size={32} />
            <span className="font-bold text-sm text-foreground">{brand.name}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-[var(--color-text-secondary)] font-medium">
            <Link to="/privacy" className="hover:text-foreground">{footer.privacyLabel}</Link>
            <Link to="/userdata" className="hover:text-foreground">{footer.userDataLabel}</Link>
            <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground">{footer.contactLabel}</a>
          </div>

          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            {footer.copyright()}
          </span>
        </div>
      </footer>
    </div>
  );
}
