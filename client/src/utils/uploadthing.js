import { generateUploadButton, generateUploadDropzone, generateReactHelpers } from '@uploadthing/react';

const url = import.meta.env.VITE_UPLOADTHING_URL || 'http://localhost:5000/api/uploadthing';

const uploadFetch = (input, init = {}) => fetch(input, { ...init, credentials: 'include' });

export const UploadButton = generateUploadButton({ url });
export const UploadDropzone = generateUploadDropzone({ url });
export const { useUploadThing, uploadFiles } = generateReactHelpers({ url, fetch: uploadFetch });
