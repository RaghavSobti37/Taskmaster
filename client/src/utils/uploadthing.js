import { generateUploadButton, generateUploadDropzone } from '@uploadthing/react';

const url = import.meta.env.VITE_UPLOADTHING_URL || 'http://localhost:5000/api/uploadthing';

export const UploadButton = generateUploadButton({ url });
export const UploadDropzone = generateUploadDropzone({ url });
