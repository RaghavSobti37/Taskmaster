/** Deploy target: app (tsccoreknot.com) | landing | auth */
const mode = () => import.meta.env.VITE_SITE_MODE || 'app';

export const SITE_MODE = mode();

export const isAppSite = () => mode() === 'app';
export const isLandingSite = () => mode() === 'landing';
export const isAuthSite = () => mode() === 'auth';
