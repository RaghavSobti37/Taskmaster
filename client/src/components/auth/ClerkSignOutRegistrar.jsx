import { useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { registerClerkSignOut } from '../../lib/clerkSession';

export default function ClerkSignOutRegistrar() {
  const { signOut } = useClerk();

  useEffect(() => {
    registerClerkSignOut(() => signOut());
    return () => registerClerkSignOut(null);
  }, [signOut]);

  return null;
}
