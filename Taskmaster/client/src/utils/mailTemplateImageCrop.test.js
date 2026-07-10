import { describe, it, expect } from 'vitest';
import {
  CROP_ASPECT_PRESETS,
  CROP_FREE_MIN_PX,
  CROP_ZOOM_MIN,
  buildCroppedFileName,
  buildInitialFreeCropSize,
  clampFreeCropSize,
  resolveCropMimeType,
} from './mailTemplateImageCrop';

describe('mailTemplateImageCrop helpers', () => {
  it('exposes free and common email aspect presets', () => {
    const ids = CROP_ASPECT_PRESETS.map((p) => p.id);
    expect(ids).toEqual(['free', '16:9', '4:3', '1:1']);
    expect(CROP_ASPECT_PRESETS.find((p) => p.id === 'free')?.ratio).toBeUndefined();
    expect(CROP_ASPECT_PRESETS.find((p) => p.id === '1:1')?.ratio).toBe(1);
  });

  it('resolves png vs jpeg mime from source type', () => {
    expect(resolveCropMimeType('image/png')).toBe('image/png');
    expect(resolveCropMimeType('image/jpeg')).toBe('image/jpeg');
    expect(resolveCropMimeType('')).toBe('image/jpeg');
  });

  it('builds cropped file names with correct extension', () => {
    expect(buildCroppedFileName('banner.png', 'image/png')).toBe('banner-cropped.png');
    expect(buildCroppedFileName('photo.jpg', 'image/jpeg')).toBe('photo-cropped.jpg');
    expect(buildCroppedFileName('noext', 'image/jpeg')).toBe('noext-cropped.jpg');
  });

  it('allows zooming out below 1 for wide email banners', () => {
    expect(CROP_ZOOM_MIN).toBeLessThan(1);
  });

  it('builds and clamps free crop dimensions inside the container', () => {
    expect(buildInitialFreeCropSize(400, 300)).toEqual({ width: 368, height: 276 });
    expect(clampFreeCropSize({ width: 10, height: 500 }, 400, 300)).toEqual({
      width: CROP_FREE_MIN_PX,
      height: 300,
    });
  });
});
