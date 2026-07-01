import { useEffect, useRef, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAuth } from '../../contexts/AuthContext';
import { exchangeClerkSession } from '../../utils/clerkExchange';

export default function useClerkSessionExchange({ onSuccess, enabled = true } = {}) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user, login } = useAuth();
  const [error, setError] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const exchangeAttemptRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isLoaded || !isSignedIn || user || exchangeAttemptRef.current) return;

    exchangeAttemptRef.current = true;
    let cancelled = false;

    (async () => {
      setExchanging(true);
      setError('');
      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable');
        }
        await exchangeClerkSession(token);
        if (cancelled) return;
        await login();
        if (cancelled) return;
        onSuccess?.();
      } catch (err) {
        if (cancelled) return;
        exchangeAttemptRef.current = false;
        setError(
          err.response?.data?.error
          || err.message
          || 'Could not establish CoreKnot session',
        );
      } finally {
        if (!cancelled) setExchanging(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, isLoaded, isSignedIn, user, getToken, login, onSuccess]);

  return { error, exchanging };
}
