let initialized = false;

export const initDatadogRum = () => {
  const applicationId = import.meta.env.VITE_DD_APPLICATION_ID?.trim();
  const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN?.trim();
  const site = import.meta.env.VITE_DD_SITE?.trim() || 'datadoghq.com';

  if (!applicationId || !clientToken || initialized) return false;

  import('@datadog/browser-rum')
    .then(({ datadogRum }) => {
      datadogRum.init({
        applicationId,
        clientToken,
        site,
        service: import.meta.env.VITE_DD_SERVICE || 'coreknot-web',
        env: import.meta.env.VITE_DD_ENV || import.meta.env.MODE,
        version: import.meta.env.VITE_DD_VERSION || import.meta.env.VITE_SENTRY_RELEASE,
        sessionSampleRate: Number(import.meta.env.VITE_DD_SESSION_SAMPLE_RATE) || 100,
        sessionReplaySampleRate: Number(import.meta.env.VITE_DD_REPLAY_SAMPLE_RATE) || 0,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      });
      initialized = true;
    })
    .catch(() => {
      /* optional dependency */
    });

  return true;
};

export const setDatadogUser = (user) => {
  if (!initialized || !user) return;
  import('@datadog/browser-rum')
    .then(({ datadogRum }) => {
      datadogRum.setUser({
        id: String(user._id || user.id || ''),
        email: user.email || undefined,
        name: user.name || undefined,
      });
    })
    .catch(() => {});
};

export const clearDatadogUser = () => {
  if (!initialized) return;
  import('@datadog/browser-rum')
    .then(({ datadogRum }) => {
      datadogRum.clearUser();
    })
    .catch(() => {});
};
