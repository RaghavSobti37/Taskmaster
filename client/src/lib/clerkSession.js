let clerkSignOutHandler = null;

export const registerClerkSignOut = (handler) => {
  clerkSignOutHandler = typeof handler === 'function' ? handler : null;
};

export const clerkSignOutIfNeeded = async () => {
  if (!clerkSignOutHandler) return;
  try {
    await clerkSignOutHandler();
  } catch {
    // Clerk session may already be cleared
  }
};
