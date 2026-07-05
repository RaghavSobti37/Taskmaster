import { uploadFinanceFiles, FINANCE_DOC_UPLOADER } from './financeUpload';

export { FINANCE_DOC_UPLOADER };

/**
 * Upload org document files via UploadThing (reuses financeDocUploader).
 * @param {File[]} files
 * @param {{ onProgress?: (pct: number) => void }} options
 */
export async function uploadOrgDocumentFiles(files, options) {
  return uploadFinanceFiles(files, options);
}
