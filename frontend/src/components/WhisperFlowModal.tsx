import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Mic,
  MicOff,
  Quote,
  RotateCcw,
  Volume2,
  Wand2
} from 'lucide-react';
import { REVIEW_FIELDS, cleanTranscript, type ReviewFieldKey } from '../lib/review';
import { AlertBanner, Button, Chip, Modal, cx } from './ui';

interface SpeechAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechResultLike {
  isFinal?: boolean;
  length: number;
  [index: number]: SpeechAlternativeLike;
}

interface SpeechResultsLike {
  length: number;
  [index: number]: SpeechResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultsLike;
}

interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const DEMO_TRANSCRIPTS: Record<ReviewFieldKey, string> = {
  billNumber: 'Bill number is B-102',
  billDate: 'Bill date is 2026-10-31',
  customerName: 'Customer name is Ravi Kumar',
  grandTotal: 'Grand total is 336'
};

const WAVE_BARS = [0.35, 0.6, 0.9, 0.55, 1, 0.7, 0.45, 0.8, 0.4];

interface WhisperFlowField {
  key: ReviewFieldKey;
  label: string;
  value: string;
}

interface WhisperFlowModalProps {
  open: boolean;
  onClose: () => void;
  fields: WhisperFlowField[];
  defaultKey?: ReviewFieldKey;
  locale: string;
  onApply: (key: ReviewFieldKey, value: string | number) => void;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

function speak(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export default function WhisperFlowModal({
  open,
  onClose,
  fields,
  defaultKey = 'grandTotal',
  locale,
  onApply
}: WhisperFlowModalProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const sessionRef = useRef(0);

  const [target, setTarget] = useState<ReviewFieldKey>(defaultKey);
  const [status, setStatus] = useState<'idle' | 'listening' | 'recognized'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [appliedValue, setAppliedValue] = useState<string | null>(null);
  const [spoken, setSpoken] = useState(false);

  const stopEverything = () => {
    sessionRef.current += 1;
    if (demoTimerRef.current) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    if (!open) {
      stopEverything();
      return;
    }
    setTarget(defaultKey);
    setStatus('idle');
    setTranscript('');
    setInterim('');
    setError(null);
    setDemoMode(false);
    setAppliedValue(null);
    setSpoken(false);
    transcriptRef.current = '';
    interimRef.current = '';
  }, [open, defaultKey]);

  useEffect(() => stopEverything, []);

  const finishWithTranscript = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus('idle');
      setError('We did not catch that. Try again a little closer to the mic.');
      return;
    }
    transcriptRef.current = trimmed;
    interimRef.current = '';
    setTranscript(trimmed);
    setInterim('');
    setStatus('recognized');
  };

  const startDemo = (reason?: string) => {
    const session = sessionRef.current;
    setDemoMode(true);
    setStatus('listening');
    setError(reason ?? null);
    setAppliedValue(null);
    setSpoken(false);
    transcriptRef.current = '';
    interimRef.current = '';
    demoTimerRef.current = window.setTimeout(() => {
      if (sessionRef.current !== session) return;
      finishWithTranscript(DEMO_TRANSCRIPTS[target]);
    }, 2200);
  };

  const startListening = () => {
    setError(null);
    setAppliedValue(null);
    setSpoken(false);
    setTranscript('');
    setInterim('');
    transcriptRef.current = '';
    interimRef.current = '';

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      startDemo('Live speech recognition is unavailable here — running a demo transcript.');
      return;
    }

    const session = ++sessionRef.current;

    try {
      const recognition = new Ctor();
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        if (sessionRef.current !== session) return;
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const alternative = result[0];
          if (!alternative) continue;
          if (result.isFinal) {
            finalText += alternative.transcript;
          } else {
            interimText += alternative.transcript;
          }
        }
        if (finalText) {
          transcriptRef.current = `${transcriptRef.current} ${finalText}`.trim();
          setTranscript(transcriptRef.current);
        }
        interimRef.current = interimText;
        setInterim(interimText);
      };

      recognition.onerror = (event) => {
        if (sessionRef.current !== session) return;
        recognitionRef.current = null;
        setStatus('idle');
        if (event.error === 'no-speech' || event.error === 'network' || event.error === 'not-allowed') {
          startDemo('Microphone unavailable — running a demo transcript instead.');
        } else {
          setError('Voice capture failed. You can retry or type the correction.');
        }
      };

      recognition.onend = () => {
        if (sessionRef.current !== session) return;
        recognitionRef.current = null;
        if (demoTimerRef.current) return;
        const captured = transcriptRef.current || interimRef.current;
        if (captured) {
          finishWithTranscript(captured);
        } else {
          setStatus('idle');
          setError('We did not catch that. Try again a little closer to the mic.');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setStatus('listening');
    } catch {
      startDemo('Could not start the microphone — running a demo transcript.');
    }
  };

  const stopListening = () => {
    if (demoTimerRef.current) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
      finishWithTranscript(DEMO_TRANSCRIPTS[target]);
      return;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current = null;
        finishWithTranscript(transcriptRef.current || interim);
      }
    }
  };

  const toggleMic = () => {
    if (status === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  const reset = () => {
    stopEverything();
    setStatus('idle');
    setTranscript('');
    setInterim('');
    setError(null);
    setAppliedValue(null);
    setSpoken(false);
    transcriptRef.current = '';
    interimRef.current = '';
    setDemoMode(false);
  };

  const applyCorrection = () => {
    const cleaned = cleanTranscript(transcript, target);
    if (cleaned === null) {
      setError(
        target === 'grandTotal'
          ? 'No amount recognised. Say the total including digits, e.g. "336".'
          : 'Could not read a value from that transcript. Please retry.'
      );
      return;
    }

    const meta = REVIEW_FIELDS.find((field) => field.key === target);
    onApply(target, cleaned);
    setAppliedValue(String(cleaned));
    setError(null);

    const spokenOk = speak(
      `${meta?.label ?? 'Field'} updated to ${String(cleaned)}. Please confirm.`
    );
    setSpoken(spokenOk);
  };

  const preview = interim || transcript;
  const activeField = fields.find((field) => field.key === target);
  const confirming = appliedValue !== null;

  return (
    <Modal
      open={open}
      onClose={() => {
        stopEverything();
        onClose();
      }}
      title="WhisperFlow correction"
      subtitle="Speak the fix. We update the field and read it back."
      footer={
        confirming ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={reset}>
              Correct another
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                stopEverything();
                onClose();
              }}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={reset}>
              Reset
            </Button>
            <Button
              className="flex-1"
              disabled={status !== 'recognized' || !transcript}
              onClick={applyCorrection}
              icon={<Wand2 className="h-4 w-4" />}
            >
              Apply correction
            </Button>
          </div>
        )
      }
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Field to correct
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {fields.map((field) => {
            const selected = field.key === target;
            return (
              <button
                key={field.key}
                type="button"
                disabled={status === 'listening'}
                onClick={() => {
                  setTarget(field.key);
                  setStatus('idle');
                  setTranscript('');
                  setInterim('');
                  setAppliedValue(null);
                  setError(null);
                  transcriptRef.current = '';
                  interimRef.current = '';
                }}
                className={cx(
                  'rounded-xl border px-3 py-2 text-left transition disabled:opacity-60',
                  selected
                    ? 'border-emerald-400/60 bg-emerald-400/10'
                    : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
                )}
              >
                <span
                  className={cx(
                    'block text-[10px] font-medium',
                    selected ? 'text-emerald-300' : 'text-slate-400'
                  )}
                >
                  {field.label}
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-white">
                  {field.value || '—'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-center">
          <div className="relative grid place-items-center">
            {status === 'listening' ? (
              <>
                <span className="absolute h-20 w-20 animate-bv-pulse-ring rounded-full bg-rose-500/20" />
                <span
                  className="absolute h-20 w-20 animate-bv-pulse-ring rounded-full bg-rose-500/10"
                  style={{ animationDelay: '0.7s' }}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={toggleMic}
              aria-label={status === 'listening' ? 'Stop listening' : 'Start listening'}
              className={cx(
                'relative grid h-20 w-20 place-items-center rounded-full text-white shadow-xl transition active:scale-95',
                status === 'listening'
                  ? 'bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-500/30'
                  : 'bg-gradient-to-br from-emerald-400 to-teal-600 text-emerald-950 shadow-emerald-500/25'
              )}
            >
              {status === 'listening' ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
          </div>

          <div className="mt-4 flex h-10 items-center gap-1.5" aria-hidden="true">
            {WAVE_BARS.map((scale, index) => (
              <span
                key={index}
                className={cx(
                  'w-1.5 rounded-full',
                  status === 'listening'
                    ? 'animate-bv-wave bg-emerald-400'
                    : 'bg-slate-700'
                )}
                style={{
                  height: `${Math.round(scale * 34) + 6}px`,
                  animationDelay: `${index * 0.08}s`
                }}
              />
            ))}
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            {status === 'listening'
              ? 'Listening… tap the mic to finish'
              : status === 'recognized'
                ? 'Transcript ready — apply or retry'
                : 'Tap the mic and say the correction'}
          </p>
          {demoMode ? (
            <div className="mt-2">
              <Chip tone="sky">Demo transcript mode</Chip>
            </div>
          ) : null}
        </div>

        {preview ? (
          <div className="mt-4 animate-bv-fade-up rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="flex items-start gap-2">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-sm leading-snug text-slate-100">
                {preview}
                {interim ? (
                  <span className="ml-1 animate-pulse text-slate-500">…</span>
                ) : null}
              </p>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Target: {activeField?.label ?? target}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3">
            <AlertBanner tone="warning" title="Heads up">
              {error}
            </AlertBanner>
          </div>
        ) : null}

        {confirming ? (
          <div className="mt-4 animate-bv-fade-up rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <p className="text-xs font-semibold text-emerald-100">
                {activeField?.label ?? 'Field'} updated to {appliedValue}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-200/80">
              <Volume2 className="h-3.5 w-3.5" />
              {spoken
                ? 'Spoken confirmation played for your review.'
                : 'Spoken confirmation is not supported on this device.'}
            </div>
          </div>
        ) : null}

        {status === 'recognized' ? (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              icon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Retry voice capture
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
