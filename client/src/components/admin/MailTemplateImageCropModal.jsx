import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Crop, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import {
  CROP_ASPECT_PRESETS,
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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectId, setAspectId] = useState('free');
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying, setApplying] = useState(false);

  const aspectPreset = CROP_ASPECT_PRESETS.find((p) => p.id === aspectId) || CROP_ASPECT_PRESETS[0];
  const aspect = aspectPreset.ratio;

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

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} size="lg" zIndex={1100}>
      <ModalHeader
        title="Crop image"
        subtitle={`Adjust framing for ${fileName || 'uploaded image'} before inserting into template.`}
        icon={Crop}
        onClose={handleClose}
      />
      <ModalBody className="space-y-4">
        <div className="relative w-full h-[min(50vh,360px)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              objectFit="contain"
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
                onClick={() => setAspectId(preset.id)}
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

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] shrink-0">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-action-primary)]"
            aria-label="Crop zoom"
          />
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
