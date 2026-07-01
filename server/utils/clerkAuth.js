const { createClerkClient, verifyToken } = require('@clerk/backend');

const isClerkConfigured = () => Boolean(process.env.CLERK_SECRET_KEY?.trim());

let clerkClient;
const getClerkClient = () => {
  if (!isClerkConfigured()) return null;
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY.trim() });
  }
  return clerkClient;
};

const verifyClerkSessionToken = async (token) => {
  if (!isClerkConfigured()) {
    throw new Error('Clerk is not configured');
  }
  return verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY.trim() });
};

const loadClerkProfile = async (clerkUserId) => {
  const client = getClerkClient();
  if (!client) {
    throw new Error('Clerk is not configured');
  }
  const clerkUser = await client.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (entry) => entry.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim()
    || clerkUser.username
    || primaryEmail?.split('@')[0]
    || 'User';
  return {
    clerkId: clerkUser.id,
    email: primaryEmail?.toLowerCase().trim() || '',
    name,
    avatar: clerkUser.imageUrl || undefined,
  };
};

module.exports = {
  isClerkConfigured,
  getClerkClient,
  verifyClerkSessionToken,
  loadClerkProfile,
};
