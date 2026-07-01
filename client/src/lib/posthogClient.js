import posthog from 'posthog-js';
import { hasAnalyticsConsent } from './cookieConsent';
import {
  getPostHogHost,
  getPostHogProjectToken,
  isPostHogConfigured,
} from '../config/posthog';

let initialized = false;

function applyConsentState() {
  if (!initialized || !isPostHogConfigured()) return;
  if (hasAnalyticsConsent()) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export function initPostHog() {
  if (typeof window === 'undefined' || initialized) return;
  const token = getPostHogProjectToken();
  if (!token) return;

  posthog.init(token, {
    api_host: getPostHogHost(),
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    opt_out_capturing_by_default: true,
    autocapture: true,
  });

  initialized = true;
  applyConsentState();
}

export function shutdownPostHog() {
  if (!initialized) return;
  posthog.opt_out_capturing();
  posthog.reset();
  initialized = false;
}

export function syncPostHogConsent() {
  applyConsentState();
}

export function identifyPostHogUser(user) {
  if (!initialized || !user || !hasAnalyticsConsent()) return;
  const id = String(user._id || user.id || '').trim();
  if (!id) return;
  posthog.identify(id, {
    email: user.email || undefined,
    name: user.name || undefined,
    department: user.departmentId?.name || user.departmentId?.slug || undefined,
  });
}

export function resetPostHogUser() {
  if (!initialized) return;
  posthog.reset();
}

export function capturePostHogPageview(path) {
  if (!initialized || !hasAnalyticsConsent()) return;
  const pathname = trim(path) || window.location.pathname;
  posthog.capture('$pageview', { $current_url: window.location.origin + pathname });
}

function trim(value) {
  return String(value || '').trim();
}

export function getPostHogClient() {
  return initialized ? posthog : null;
}
