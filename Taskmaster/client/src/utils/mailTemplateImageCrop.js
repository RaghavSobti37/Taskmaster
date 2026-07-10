/** Aspect presets for mail template image cropping */
export const CROP_ASPECT_PRESETS = [
  { id: 'free', label: 'Free', ratio: undefined },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
];

export const CROP_ZOOM_MIN = 0.35;
export const CROP_ZOOM_MAX = 3;
export const CROP_FREE_MIN_PX = 72;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Initial free crop box — react-easy-crop needs explicit cropSize when aspect is free */
export const buildInitialFreeCropSize = (containerWidth, containerHeight) => {
  const width = Math.round(containerWidth * 0.92);
  const height = Math.round(containerHeight * 0.92);
  return {
    width: clamp(width, CROP_FREE_MIN_PX, containerWidth),
    height: clamp(height, CROP_FREE_MIN_PX, containerHeight),
  };
};

export const clampFreeCropSize = (size, containerWidth, containerHeight) => ({
  width: clamp(Math.round(size?.width || 0), CROP_FREE_MIN_PX, containerWidth),
  height: clamp(Math.round(size?.height || 0), CROP_FREE_MIN_PX, containerHeight),
});

export const resolveCropMimeType = (sourceType) => (
  String(sourceType || '').toLowerCase().includes('png') ? 'image/png' : 'image/jpeg'
);

export const buildCroppedFileName = (originalName, mimeType) => {
  const base = String(originalName || 'image').replace(/\.[^.]+$/, '');
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return `${base}-cropped.${ext}`;
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.addEventListener('load', () => resolve(image));
  image.addEventListener('error', () => reject(new Error('Failed to load image')));
  image.src = src;
});

/**
 * Export a cropped region from an image source URL as a Blob.
 * @param {string} imageSrc - object URL or remote URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {string} [mimeType='image/jpeg']
 * @param {number} [quality=0.92]
 */
export const getCroppedImageBlob = async (imageSrc, pixelCrop, mimeType = 'image/jpeg', quality = 0.92) => {
  if (!imageSrc || !pixelCrop?.width || !pixelCrop?.height) {
    throw new Error('Invalid crop area');
  }
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const width = Math.round(pixelCrop.width);
  const height = Math.round(pixelCrop.height);
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Crop export failed'));
    }, mimeType, quality);
  });
};

export const blobToCroppedFile = (blob, originalName, sourceType) => {
  const mimeType = blob?.type || resolveCropMimeType(sourceType);
  return new File([blob], buildCroppedFileName(originalName, mimeType), { type: mimeType });
};
