import { getPostHogClient } from './posthog';
import { hasAnalyticsConsent } from './cookieConsent';

/** Report Core Web Vitals to PostHog when analytics consent granted. */
export async function initReportWebVitals() {
  if (typeof window === 'undefined') return;

  try {
    const { onCLS, onINP, onLCP, onTTFB, onFCP } = await import('web-vitals');

    const send = (metric) => {
      if (!hasAnalyticsConsent()) return;
      const ph = getPostHogClient();
      ph?.capture?.('web_vital', {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        navigationType: metric.navigationType,
        path: window.location.pathname,
      });
    };

    onCLS(send);
    onINP(send);
    onLCP(send);
    onTTFB(send);
    onFCP(send);
  } catch {
    /* web-vitals optional */
  }
}
