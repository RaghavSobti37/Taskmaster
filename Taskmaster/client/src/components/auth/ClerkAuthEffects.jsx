import { isClerkConfigured } from '../../config/clerk';
import ClerkGoogleOneTap from './ClerkGoogleOneTap';
import ClerkOrgActivator from './ClerkOrgActivator';
import ClerkSessionBridge from './ClerkSessionBridge';
import ClerkStaleSessionRecovery from './ClerkStaleSessionRecovery';

/** Clerk hooks only mount when ClerkProvider is active. */
export default function ClerkAuthEffects() {
  if (!isClerkConfigured()) return null;
  return (
    <>
      <ClerkStaleSessionRecovery />
      <ClerkOrgActivator />
      <ClerkSessionBridge />
      <ClerkGoogleOneTap />
    </>
  );
}
