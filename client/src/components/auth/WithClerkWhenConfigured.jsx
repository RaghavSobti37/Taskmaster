import React from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';

/** ponytail: Clerk hooks illegal without ClerkProvider — preview/CI may omit publishable key */
const CLERK_ABSENT = Object.freeze({ isLoaded: true, isSignedIn: false });

function WithClerkWhenConfiguredInner({ children }) {
  const clerk = useClerkAuth();
  return children(clerk);
}

/**
 * Render-prop: supplies Clerk auth state when configured, safe defaults otherwise.
 * @param {function({ isLoaded: boolean, isSignedIn: boolean }): React.ReactNode} children
 */
export default function WithClerkWhenConfigured({ children }) {
  if (!isClerkConfigured()) {
    return children(CLERK_ABSENT);
  }
  return (
    <WithClerkWhenConfiguredInner>
      {children}
    </WithClerkWhenConfiguredInner>
  );
}
