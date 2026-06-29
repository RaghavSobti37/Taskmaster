/**
 * CoreKnot marketing & product copy — single source of truth.
 *
 * Information architecture:
 * 1. Landing — value prop, feature pillars, sign-in CTAs
 * 2. Auth — login/register, PWA install guide
 * 3. App shell — sidebar, onboarding tour, command palette
 * 4. Hub modules — CRM, Office, Management, Admin console
 * 5. Legal — privacy, user data deletion
 *
 * Icon keys on feature pillars map to lucide-react in the landing page.
 */

export const brand = {
  name: 'CoreKnot',
  tagline: 'Workspace Suite',
  /** Meta, PWA, OG — keep manifest.json in sync manually */
  description: 'Project management, CRM, and team workspace for modern operations.',
  pwaDescription: 'Project management, CRM, and team workspace for modern operations.',
  parentOrg: 'The Shakti Collective',
  copyrightYear: 2026,
  supportEmail: 'privacy@theshakticollective.in',
  siteUrl: 'https://tsccoreknot.com/',
};

export const landingHero = {
  eyebrow: 'Introducing CoreKnot Workspace',
  title: 'Master Your Team',
  titleAccent: 'Workflows & Campaigns',
  description:
    'CoreKnot unifies project tracking, CRM pipeline management, email campaigns, and team operations in one secure workspace.',
  qualifiers: [
    'Projects, tasks, CRM, and email in one place',
    'Built for coordinated team operations',
    'Secure sign-in with role-based access',
  ],
  ctaPrimary: 'Sign In to Workspace',
  ctaSecondary: 'Create Free Account',
};

export const landingSections = {
  features: {
    title: 'Purpose-Built for Modern Operations',
    description:
      'Replace fragmented tooling with coordinated workflows — from daily tasks and attendance to CRM follow-ups and campaign dispatch.',
  },
};

/** Public landing feature grid — outcome-first copy */
export const landingFeaturePillars = [
  {
    icon: 'Briefcase',
    title: 'Projects & Tasks',
    description:
      'Track priorities, assignees, and review stages on high-density boards built for fast-moving teams.',
  },
  {
    icon: 'Users',
    title: 'CRM Pipeline',
    description:
      'Import leads, manage client status, schedule follow-ups, and keep CRM data in sync with your workflows.',
  },
  {
    icon: 'Mail',
    title: 'Email Campaigns',
    description:
      'Design newsletters, send via secure SMTP or Resend, and review opens, clicks, and delivery metrics.',
  },
  {
    icon: 'Calendar',
    title: 'Team Calendar',
    description:
      'Align deadlines and schedules with local calendar entries and optional Google Calendar sync.',
  },
];

export const loginCopy = {
  subtitle:
    'Sign in to manage projects, tasks, CRM lists, attendance, and team operations in one workspace.',
  installCta: 'Install CoreKnot app',
  installCtaInstalled: 'App install guide',
};

export const registerCopy = {
  title: 'Create Account',
  subtitle: 'Join your team on CoreKnot — projects, CRM, and ops in one workspace.',
  submitLabel: 'Create Account',
  signInPrompt: 'Already have an account?',
  signInLink: 'Sign in',
};

export const inAppFeatures = {
  missionTitle: 'Mission Ready',
  missionBody:
    'CoreKnot syncs with your Google account where enabled. Your workspace data is saved securely and updates across devices in real time.',
};

export const footer = {
  privacyLabel: 'Privacy Policy',
  userDataLabel: 'User Data Deletion',
  contactLabel: 'Contact Support',
  copyright: (year = brand.copyrightYear) =>
    `© ${year} ${brand.name} / ${brand.parentOrg}. All rights reserved.`,
};

export const legalCopy = {
  privacyAppliesLine: `Applies to ${brand.name} Workspace and cross-platform analytics pipelines.`,
  productNameInBody: brand.name,
};

/**
 * Three distinct artist surfaces — use in UI labels/tooltips to reduce confusion.
 */
export const artistProductGlossary = {
  artistPath: {
    label: 'Artist Path',
    summary: 'Accelerator program application intake and review (admin).',
  },
  artistOs: {
    label: 'Artist OS',
    summary: 'Internal roster tooling for TSC team — gigs, finance, content, and analytics.',
  },
  artistWorkspace: {
    label: 'Artist Workspace',
    summary: 'Member portal for artists invited into the TSC ecosystem.',
  },
};

/** Onboarding welcome — shared product definition */
export const productSummary = {
  mobile:
    "CoreKnot is TSC's work hub — projects, tasks, CRM, attendance, email campaigns, and team ops in one place.",
  desktop:
    "CoreKnot is TSC's unified operations platform — project governance, CRM, attendance, finance docs, email campaigns, gamification, and admin tooling.",
};

export const meta = {
  title: brand.name,
  description: brand.description,
  ogImage: `${brand.siteUrl}icons/og-preview.png`,
  ogUrl: brand.siteUrl,
  themeColor: '#126d5e',
};
