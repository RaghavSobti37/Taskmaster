# Lighthouse performance & accessibility — detailed report

**Base URL:** http://127.0.0.1:4173
**Generated:** 2026-07-08T11:28:42.549Z
**Routes:** 11

## Score summary (all pages)

| Page | Route | Perf | A11y | Top slowdown |
| --- | --- | ---: | ---: | --- |
| Landing | `/` | — | — | — |
| Login | `/login` | — | — | — |
| Register | `/register` | — | — | — |
| Forgot password | `/forgot-password` | — | — | — |
| Reset password | `/reset-password` | — | — | — |
| OTP verification | `/relegends` | — | — | — |
| Google OAuth success | `/auth/google/success` | — | — | — |
| Meta OAuth callback | `/oauth/meta/callback` | — | — | — |
| Privacy policy | `/privacy` | — | — | — |
| User data deletion | `/userdata` | — | — | — |
| Unsubscribe | `/unsubscribe` | — | — | — |

---

## Per-page breakdown

### Landing (`/`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Login (`/login`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Register (`/register`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Forgot password (`/forgot-password`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Reset password (`/reset-password`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### OTP verification (`/relegends`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Google OAuth success (`/auth/google/success`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Meta OAuth callback (`/oauth/meta/callback`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Privacy policy (`/privacy`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### User data deletion (`/userdata`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

### Unsubscribe (`/unsubscribe`)

| Category | Score |
| --- | ---: |
| Performance | — |
| Accessibility | — |
| Best practices | — |
| SEO | — |

**Core Web Vitals / timing:**

- **first-contentful-paint:** undefined
- **largest-contentful-paint:** undefined
- **total-blocking-time:** undefined
- **cumulative-layout-shift:** undefined
- **speed-index:** undefined
- **interactive:** undefined

---

## Cross-cutting themes

Protected app routes share one JS bundle; scores cluster when the shell loads the same chunks. Typical wins:

- **unused-javascript** — code-split heavy routes (charts, email editor, workflow canvas) and defer below-the-fold widgets.
- **uses-rel-preconnect** — preconnect API origin used on first paint.
- **render-blocking-resources** — ensure critical CSS inlined or loaded async in production build.
- **LCP ~3.4–3.9s** on dashboard — stagger non-critical React Query fetches (already partially done in v1.9.10).

Re-run: `npm run build && npm run preview` then `LH_BASE_URL=http://localhost:4173 npm run lighthouse -- --prod`
