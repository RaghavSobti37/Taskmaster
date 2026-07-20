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
  supportEmail: 'helloworld@theshakticollective',
  siteUrl: 'https://tsccoreknot.com/',
};

export const landingNavLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Resources', href: '#resources' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
];

export const landingHero = {
  eyebrow: 'Introducing CoreKnot Workspace',
  title: 'Unify Your Projects, Team & Campaigns',
  description:
    'The all-in-one workspace for modern teams — manage projects, nurture client relationships, run email campaigns, and keep everyone aligned without switching tools.',
  desktopDownloadUrl: [
    'https://github.com',
    ['Raghav', 'Sobti37'].join(''),
    'Taskmaster',
    'releases',
    'tag',
    'v1.0.8-beta.3',
  ].join('/'),
  desktopDownloadCta: 'Download CoreKnot Beta',
  trustBadges: [
    { label: 'No credit card required', icon: 'CreditCard' },
    { label: 'Secure & role-based access', icon: 'Shield' },
    { label: 'Built for growing teams', icon: 'Users' },
  ],
  ctaPrimary: 'Get Started Free',
  ctaSecondary: 'Book a Demo',
};

export const landingSections = {
  features: {
    title: 'Purpose-Built for Modern Operations',
    description:
      'Everything your team needs to plan, execute, and grow — coordinated in one secure workspace.',
  },
  metrics: {
    headline: 'Trusted by teams that get things done',
    stats: [
      { value: '500+', label: 'Active Teams' },
      { value: '10K+', label: 'Projects Managed' },
      { value: '98%', label: 'Customer Satisfaction' },
    ],
  },
  testimonials: {
    title: 'Loved by Teams, Proven by Results',
    items: [
      {
        quote:
          'CoreKnot replaced four separate tools for us. Our project delivery time dropped by 30% in the first quarter.',
        name: 'Sarah Chen',
        role: 'Operations Director',
        initials: 'SC',
      },
      {
        quote:
          'The CRM pipeline and email campaigns in one place changed how we follow up with clients. Nothing falls through the cracks anymore.',
        name: 'Marcus Rivera',
        role: 'Head of Growth',
        initials: 'MR',
      },
      {
        quote:
          'Finally a workspace that our whole team actually uses. Onboarding was smooth and the calendar sync just works.',
        name: 'Priya Sharma',
        role: 'Project Lead',
        initials: 'PS',
      },
    ],
  },
  finalCta: {
    title: 'Ready to simplify your workflow?',
    description: 'Start your free account today. No credit card required.',
    ctaPrimary: 'Get Started Free',
    ctaSecondary: 'Book a Demo',
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
  subtitle: 'Projects, CRM, attendance, and team ops in one workspace.',
  installCta: 'Install CoreKnot app',
  installCtaInstalled: 'App install guide',
};

export const registerCopy = {
  title: 'Request access',
  subtitle: 'CoreKnot is invite-only. Ask your organisation admin to add you, or send a request below.',
  submitLabel: 'Request access',
  signInPrompt: 'Already have credentials?',
  signInLink: 'Sign in',
  closedSystemNote: 'Your admin will create your account and share a temporary password. Self sign-up is disabled.',
  successMessage: 'Request sent. Your organisation admin will add you and share login credentials.',
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
