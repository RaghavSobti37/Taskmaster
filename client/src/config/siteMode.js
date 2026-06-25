/** Deploy target: app (tsccoreknot.com) | landing | auth */
export const SITE_MODE = import.meta.env.VITE_SITE_MODE || 'app';

export const isAppSite = () => SITE_MODE === 'app';
export const isLandingSite = () => SITE_MODE === 'landing';
export const isAuthSite = () => SITE_MODE === 'auth';
