import { generateUploadButton, generateUploadDropzone, generateReactHelpers } from '@uploadthing/react';

/** Match axios: relative /api so session cookies stay on the page origin (Vite/Vercel proxy). */
const explicitUploadthingUrl = (import.meta.env.VITE_UPLOADTHING_URL || '').trim();
const uploadthingUrl = explicitUploadthingUrl || '/api/uploadthing';

const resolveRequestUrl = (input) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input?.url) return String(input.url);
  return '';
};

const shouldIncludeCredentials = (requestUrl) => {
  if (requestUrl.includes('ingest.uploadthing.com')) return false;
  if (!requestUrl) return true;
  if (requestUrl.startsWith('/')) return true;
  if (typeof window !== 'undefined' && requestUrl.startsWith(window.location.origin)) return true;
  return requestUrl.includes('/api/uploadthing');
};

const uploadFetch = (input, init = {}) => {
  const requestUrl = resolveRequestUrl(input);
  const includeCredentials = shouldIncludeCredentials(requestUrl);
  return fetch(input, { ...init, ...(includeCredentials ? { credentials: 'include' } : {}) });
};

const UploadButton = generateUploadButton({ url: uploadthingUrl });
const UploadDropzone = generateUploadDropzone({ url: uploadthingUrl });
const { useUploadThing, uploadFiles } = generateReactHelpers({ url: uploadthingUrl, fetch: uploadFetch });

export { UploadButton, UploadDropzone, useUploadThing, uploadFiles };
