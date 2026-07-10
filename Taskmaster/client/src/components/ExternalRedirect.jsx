import { useEffect } from 'react';

/** Full-page redirect for cross-subdomain marketing/auth routes on the main app host. */
export default function ExternalRedirect({ to }) {
  useEffect(() => {
    if (to) window.location.replace(to);
  }, [to]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground text-sm">
      Redirecting…
    </div>
  );
}
