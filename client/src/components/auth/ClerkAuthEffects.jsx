import { isClerkConfigured } from '../../config/clerk';
import ClerkGoogleOneTap from './ClerkGoogleOneTap';
import ClerkSessionBridge from './ClerkSessionBridge';

/** Clerk hooks only mount when ClerkProvider is active. */
export default function ClerkAuthEffects() {
  if (!isClerkConfigured()) return null;
  return (
    <>
      <ClerkSessionBridge />
      <ClerkGoogleOneTap />
    </>
  );
}
