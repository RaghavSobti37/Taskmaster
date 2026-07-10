import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Crop, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import {
  CROP_ASPECT_PRESETS,
  CROP_FREE_MIN_PX,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  buildInitialFreeCropSize,
  clampFreeCropSize,
  getCroppedImageBlob,
  resolveCropMimeType,
} from '../../utils/mailTemplateImageCrop';

export default function MailTemplateImageCropModal({
  isOpen,
  imageSrc,
  fileName = 'image',
  sourceType = 'image/jpeg',
  onCancel,
  onConfirm,
}) {
  const containerRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectId, setAspectId] = useState('free');
  const [freeCropSize, setFreeCropSize] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying, setApplying] = useState(false);

  const aspectPreset = CROP_ASPECT_PRESETS.find((p) => p.id === aspectId) || CROP_ASPECT_PRESETS[0];
  const isFreeAspect = aspectId === 'free';

  const resetCropSession = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFreeCropSize(null);
    setCroppedAreaPixels(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    resetCropSession();
    return undefined;
  }, [isOpen, imageSrc, resetCropSession]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return undefined;
    const el = containerRef.current;
    const update = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isFreeAspect || !containerSize.width || !containerSize.height) return;
    setFreeCropSize((prev) => prev ?? buildInitialFreeCropSize(containerSize.width, containerSize.height));
  }, [isFreeAspect, containerSize.width, containerSize.height]);

  const handleAspectChange = (id) => {
    setAspectId(id);
    setFreeCropSize(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleFreeCropWidth = (width) => {
    if (!containerSize.width) return;
    setFreeCropSize((prev) => clampFreeCropSize(
      { width, height: prev?.height ?? containerSize.height * 0.92 },
      containerSize.width,
      containerSize.height,
    ));
  };

  const handleFreeCropHeight = (height) => {
    if (!containerSize.height) return;
    setFreeCropSize((prev) => clampFreeCropSize(
      { width: prev?.width ?? containerSize.width * 0.92, height },
      containerSize.width,
      containerSize.height,
    ));
  };

  const handleCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const mimeType = resolveCropMimeType(sourceType);
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, mimeType);
      await onConfirm(blob);
    } catch (err) {
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    if (applying) return;
    onCancel();
  };

  const cropperProps = isFreeAspect && freeCropSize
    ? { cropSize: freeCropSize }
    : { aspect: aspectPreset.ratio };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} size="lg" zIndex={1100}>
      <ModalHeader
        title="Crop image"
        subtitle={`Adjust framing for ${fileName || 'uploaded image'} before inserting into template.`}
        icon={Crop}
        onClose={handleClose}
      />
      <ModalBody className="space-y-4">
        <div
          ref={containerRef}
          className="relative w-full h-[min(50vh,360px)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
        >
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={CROP_ZOOM_MIN}
              maxZoom={CROP_ZOOM_MAX}
              restrictPosition={zoom > 1}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              style={{
                cropAreaStyle: {
                  border: '2px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.58)',
                },
              }}
              {...cropperProps}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
              <ImageIcon size={32} className="opacity-40" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Aspect
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CROP_ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleAspectChange(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                  aspectId === preset.id
                    ? 'bg-[var(--color-action-primary)] text-white border-[var(--color-action-primary)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/40'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {isFreeAspect && freeCropSize && containerSize.width > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                Crop width
              </span>
              <input
                type="range"
                min={CROP_FREE_MIN_PX}
                max={containerSize.width}
                step={1}
                value={freeCropSize.width}
                onChange={(e) => handleFreeCropWidth(Number(e.target.value))}
                className="w-full accent-[var(--color-action-primary)]"
                aria-label="Crop width"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                Crop height
              </span>
              <input
                type="range"
                min={CROP_FREE_MIN_PX}
                max={containerSize.height}
                step={1}
                value={freeCropSize.height}
                onChange={(e) => handleFreeCropHeight(Number(e.target.value))}
                className="w-full accent-[var(--color-action-primary)]"
                aria-label="Crop height"
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] shrink-0">
            Zoom
          </span>
          <input
            type="range"
            min={CROP_ZOOM_MIN}
            max={CROP_ZOOM_MAX}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-action-primary)]"
            aria-label="Crop zoom"
          />
          <span className="text-[10px] tabular-nums text-[var(--color-text-muted)] w-10 text-right">
            {zoom.toFixed(2)}×
          </span>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="ghost" onClick={handleClose} disabled={applying}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleApply} disabled={!croppedAreaPixels || applying}>
          {applying ? 'Applying…' : 'Apply crop'}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}
