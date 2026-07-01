import { ClerkProvider } from '@clerk/clerk-react';
import { clerkPublishableKey, isClerkEnabled } from '../lib/clerkConfig';
import ClerkSignOutRegistrar from './ClerkSignOutRegistrar';

export default function ClerkAuthProvider({ children }) {
  if (!isClerkEnabled()) {
    return children;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkSignOutRegistrar />
      {children}
    </ClerkProvider>
  );
}
