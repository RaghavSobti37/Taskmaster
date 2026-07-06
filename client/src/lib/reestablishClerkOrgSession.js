import axios from 'axios';
import { fetchClerkEstablishToken } from './clerkEstablishToken';
import { AXIOS_SKIP_TOAST } from './notifications';

/**
 * Re-run clerk-establish after Clerk active org changes (org-first switch / choose page).
 */
export async function reestablishClerkOrgSession({
  getToken,
  setActive,
  orgId,
  confirmSessionFromEstablish,
}) {
  const tokenResult = await fetchClerkEstablishToken({
    getToken,
    setActive,
    pinnedOrgId: '',
    activeOrgId: orgId,
  });

  if (!tokenResult.ok) {
    const message = tokenResult.error?.message || 'Could not refresh workspace session';
    throw new Error(message);
  }

  const establishResponse = await axios.post(
    '/api/auth/clerk-establish',
    {
      token: tokenResult.token,
      ...(orgId ? { organizationId: orgId } : {}),
    },
    { withCredentials: true, ...AXIOS_SKIP_TOAST },
  );

  if (establishResponse?.data?._id) {
    await confirmSessionFromEstablish(establishResponse.data);
    return establishResponse.data;
  }

  throw new Error('Session could not be established');
}
