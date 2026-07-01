/** Clerk theme + copy for auth panels (teal #0B3B31 panel, logo accent). */
export const AUTH_PANEL_TEAL = '#0B3B31';
export const AUTH_ACCENT = '#126d5e';
export const AUTH_ACCENT_BRIGHT = '#2dd4bf';

export const clerkAuthLocalization = {
  applicationName: 'CoreKnot',
  signIn: {
    start: {
      title: 'Sign in to CoreKnot',
      subtitle: 'Welcome back. Continue to your workspace.',
    },
  },
  signUp: {
    start: {
      title: 'Join CoreKnot',
      subtitle: 'Create your account to access the workspace.',
    },
  },
};

export const clerkAuthAppearance = {
  variables: {
    colorPrimary: AUTH_ACCENT_BRIGHT,
    colorPrimaryForeground: AUTH_PANEL_TEAL,
    colorBackground: 'transparent',
    colorForeground: '#ecfdf5',
    colorMuted: '#0f4f42',
    colorMutedForeground: '#99f6e4',
    colorInput: '#d1fae5',
    colorInputBackground: 'rgba(255, 255, 255, 0.08)',
    colorInputForeground: '#f0fdf4',
    colorNeutral: '#6ee7b7',
    colorDanger: '#fca5a5',
    colorSuccess: '#6ee7b7',
    colorWarning: '#fcd34d',
    colorText: '#ecfdf5',
    colorTextSecondary: '#a7f3d0',
    borderRadius: '0.625rem',
  },
  elements: {
    rootBox: { width: '100%' },
    card: {
      backgroundColor: 'transparent',
      boxShadow: 'none',
      border: 'none',
    },
    cardBox: { boxShadow: 'none' },
    headerTitle: { color: '#ecfdf5', fontWeight: 600 },
    headerSubtitle: { color: '#a7f3d0' },
    socialButtonsBlockButton: {
      borderColor: 'rgba(167, 243, 208, 0.25)',
      color: '#ecfdf5',
    },
    formFieldLabel: { color: '#d1fae5' },
    formFieldInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(167, 243, 208, 0.2)',
      color: '#f0fdf4',
    },
    formButtonPrimary: {
      backgroundColor: AUTH_ACCENT_BRIGHT,
      color: AUTH_PANEL_TEAL,
      fontWeight: 600,
    },
    footer: { display: 'none' },
    footerAction: { display: 'none' },
    footerActionLink: { display: 'none' },
    footerPages: { display: 'none' },
    identityPreviewEditButton: { color: AUTH_ACCENT_BRIGHT },
    formFieldAction: { color: AUTH_ACCENT_BRIGHT },
    alertText: { color: '#fecaca' },
  },
};

export const clerkAuthShellClass =
  'relative z-10 flex w-full justify-center '
  + '[&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full [&_.cl-card]:w-full '
  + '[&_.cl-card]:shadow-none [&_.cl-card]:border-0 [&_.cl-card]:bg-transparent '
  + '[&_.cl-cardBox]:shadow-none [&_.cl-footer]:!hidden [&_.cl-footerAction]:!hidden '
  + '[&_.cl-internal-b3fm6y]:!hidden [&_.cl-badge]:!hidden';
