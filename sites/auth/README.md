# CoreKnot auth site

Deploy this folder as a **separate Vercel project** on `auth.tsccoreknot.com`.

Auth routes (same slugs as the main app):

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/relegends` (OTP)
- `/auth/google/success`

After login, users redirect to `https://tsccoreknot.com/dashboard` (session cookie domain: `.tsccoreknot.com`).
