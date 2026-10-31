import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud
} from 'lucide-react';
import type { BillExtractionResponse } from '@shared/types';
import { uploadBillImage, type ApiResult } from '../lib/api';
import {
  AlertBanner,
  Button,
  Chip,
  ScreenShell,
  SectionCard,
  TopBar,
  cx
} from './ui';

const MAX_BYTES = 12 * 1024 * 1024;

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CaptureScreenProps {
  onBack: () => void;
  onExtracted: (result: ApiResult<BillExtractionResponse>) => void;
}

export default function CaptureScreen({
  onBack,
  onExtracted
}: CaptureScreenProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const acceptFile = (next: File | null) => {
    setError(null);
    if (!next) return;

    if (!next.type.startsWith('image/')) {
      setError('Please choose a JPG, PNG, WEBP or HEIC image of the bill.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('Image is larger than 12 MB. Try a smaller photo or compress it.');
      return;
    }

    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
    setFile(next);
  };

  const clearFile = () => {
    setFile(null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setError(null);
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const handleExtract = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setProgress(8);

    intervalRef.current = window.setInterval(() => {
      setProgress((value) => (value >= 92 ? value : value + 7));
    }, 220);

    const result = await uploadBillImage(file);

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(100);
    setUploading(false);
    onExtracted(result);
  };

  return (
    <ScreenShell>
      <TopBar
        title="Capture bill"
        subtitle="Camera, gallery or drag & drop"
        onBack={onBack}
        right={<Chip tone="emerald">Step 1 of 3</Chip>}
      />

      <div className="flex-1 px-4 pb-8">
        <SectionCard
          title="Bill image"
          hint="Keep the whole bill in frame with good lighting."
          className="mt-4"
          right={<Chip tone="slate">OCR ready</Chip>}
        >
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              <img
                src={preview}
                alt="Selected bill preview"
                className="max-h-72 w-full object-contain"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent px-3 pb-3 pt-8">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">
                    {file?.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {file ? prettySize(file.size) : ''} · ready to extract
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={uploading}
                  aria-label="Remove image"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900/80 text-rose-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                acceptFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={cx(
                'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition',
                dragging
                  ? 'border-emerald-400 bg-emerald-400/10'
                  : 'border-slate-700 bg-slate-950/60'
              )}
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-800/80 text-emerald-300">
                <ImagePlus className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">
                Drop a bill photo here
              </p>
              <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-slate-400">
                Works with handwritten Punjabi, Hindi and English bills. JPG, PNG
                or WEBP up to 12 MB.
              </p>
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button
                  icon={<Camera className="h-4 w-4" />}
                  onClick={() => cameraRef.current?.click()}
                >
                  Open camera
                </Button>
                <Button
                  variant="secondary"
                  icon={<UploadCloud className="h-4 w-4" />}
                  onClick={() => galleryRef.current?.click()}
                >
                  Choose from gallery
                </Button>
              </div>
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              acceptFile(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              acceptFile(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />

          {error ? (
            <div className="mt-3">
              <AlertBanner tone="error" title="Could not use this image">
                {error}
              </AlertBanner>
            </div>
          ) : null}
        </SectionCard>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              If the OCR service is unreachable, BahiVerse automatically loads the
              verified demo extraction so you can keep reviewing without
              interruption.
            </p>
          </div>
        </div>

        <div className="mt-4">
          {uploading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                Reading handwriting & figures…
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Stage 1 of 3 · OCR extraction {Math.min(progress, 100)}%
              </p>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              disabled={!file}
              onClick={handleExtract}
              icon={<ScanLine className="h-4 w-4" />}
            >
              Extract bill details
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            On-device crop assist
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-sky-400" />
            Nothing leaves your demo workspace
          </span>
        </div>
      </div>
    </ScreenShell>
  );
}
