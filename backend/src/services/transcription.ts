import type { BillLanguage } from './ocr';

export type TranscriptionSource = 'whisper' | 'filename' | 'fallback';

export interface TranscriptionInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  language?: BillLanguage;
  fallbackTranscript?: string;
}

export interface TranscriptionOutcome {
  transcript: string;
  source: TranscriptionSource;
  warning?: string;
}

const SUPPORTED_EXTENSIONS = ['.wav', '.webm', '.m4a'];
const SUPPORTED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a'
]);
const GENERIC_FILENAMES = new Set([
  'audio',
  'clip',
  'demo',
  'file',
  'new',
  'recording',
  'sample',
  'temp',
  'upload',
  'voice'
]);

export function isSupportedAudioFile(
  filename: string,
  mimeType: string
): boolean {
  const lowerName = filename.toLowerCase();
  if (SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return true;
  }

  const baseMimeType = mimeType.toLowerCase().split(';')[0].trim();
  return SUPPORTED_MIME_TYPES.has(baseMimeType);
}

function transcriptFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;
  if (GENERIC_FILENAMES.has(cleaned.toLowerCase())) return null;
  return cleaned.length >= 3 ? cleaned : null;
}

function extractTranscript(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const record = payload as Record<string, unknown>;
  for (const key of ['text', 'transcript', 'result']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function transcribeWithWhisper(
  input: TranscriptionInput
): Promise<string | null> {
  const endpoint = process.env.WHISPER_API_URL;
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], {
        type: input.mimeType || 'audio/wav'
      }),
      input.filename
    );
    formData.append('model', process.env.WHISPER_MODEL || 'whisper-1');

    if (input.language) {
      formData.append('language', input.language);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: process.env.WHISPER_API_KEY
        ? { authorization: `Bearer ${process.env.WHISPER_API_KEY}` }
        : undefined,
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Whisper provider responded with ${response.status}`);
    }

    return extractTranscript((await response.json()) as unknown);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Tries the configured Whisper-compatible provider first. Mobile recordings
 * still produce a usable correction when the provider is missing or offline by
 * falling back to an explicit transcript or the uploaded filename.
 */
export async function transcribeAudio(
  input: TranscriptionInput
): Promise<TranscriptionOutcome> {
  if (process.env.WHISPER_API_URL) {
    try {
      const transcript = await transcribeWithWhisper(input);
      if (transcript) {
        return { transcript, source: 'whisper' };
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'unknown transcription error';
      return fallbackOutcome(
        input,
        `Whisper transcription failed (${reason}); used local fallback transcript.`
      );
    }
  }

  return fallbackOutcome(
    input,
    process.env.WHISPER_API_URL
      ? 'Whisper returned an empty transcript; used local fallback transcript.'
      : 'Whisper API not configured; used local fallback transcript.'
  );
}

function fallbackOutcome(
  input: TranscriptionInput,
  warning: string
): TranscriptionOutcome {
  const explicit = input.fallbackTranscript?.trim();
  if (explicit) {
    return { transcript: explicit, source: 'fallback', warning };
  }

  const filenameTranscript = transcriptFromFilename(input.filename);
  if (filenameTranscript) {
    return {
      transcript: filenameTranscript,
      source: 'filename',
      warning
    };
  }

  return { transcript: 'total dasso', source: 'fallback', warning };
}
