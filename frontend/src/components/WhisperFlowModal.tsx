import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Keyboard,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Volume2,
  X
} from 'lucide-react';
import type { BillExtractionResponse } from '../../../shared/types';
import { useWhisperFlow, type WhisperLanguage } from '../hooks/useWhisperFlow';

const QUICK_COMMANDS = [
  'Change quantity to 8',
  'Customer name is Ravi',
  'Paanch kilo chini'
] as const;

const WAVE_HEIGHTS = [12, 24, 36, 20, 44, 28, 16, 32, 22];

interface WhisperFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string;
  onCorrectionApplied: (updatedBill: BillExtractionResponse) => void;
  currentLanguage: WhisperLanguage;
}

export default function WhisperFlowModal({
  isOpen,
  onClose,
  billId,
  onCorrectionApplied,
  currentLanguage
}: WhisperFlowModalProps) {
  const {
    isListening,
    transcript,
    isProcessing,
    feedbackMessage,
    error,
    bill,
    isRecordingSupported,
    startListening,
    stopListening,
    submitVoiceCorrection,
    setTranscript
  } = useWhisperFlow();

  const [manualText, setManualText] = useState('');
  const onCorrectionAppliedRef = useRef(onCorrectionApplied);

  useEffect(() => {
    onCorrectionAppliedRef.current = onCorrectionApplied;
  }, [onCorrectionApplied]);

  useEffect(() => {
    if (bill) {
      onCorrectionAppliedRef.current(bill);
    }
  }, [bill]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submitManual = () => {
    const text = manualText.trim();
    if (!text || isProcessing) return;
    setTranscript(text);
    setManualText('');
    void submitVoiceCorrection(billId, text);
  };

  const runQuickCommand = (command: string) => {
    if (isProcessing) return;
    setTranscript(command);
    void submitVoiceCorrection(billId, command);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whisperflow-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="whisperflow-title" className="text-base font-semibold text-white">
                WhisperFlow
              </h2>
              <p className="text-xs text-slate-400">
                Voice correction · {currentLanguage.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close WhisperFlow"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 px-5 pt-5">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-5">
            <div className="flex h-12 items-center justify-center gap-1.5" aria-hidden="true">
              {WAVE_HEIGHTS.map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className={`w-1.5 rounded-full transition-colors ${
                    isListening ? 'animate-pulse bg-rose-400' : 'bg-slate-700'
                  } motion-reduce:animate-none`}
                  style={{
                    height: `${height}px`,
                    animationDelay: `${index * 90}ms`
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                isListening ? stopListening() : startListening(currentLanguage)
              }
              disabled={isProcessing}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
              aria-pressed={isListening}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/50 ${
                isListening
                  ? 'bg-rose-600 shadow-rose-900/50'
                  : 'bg-violet-600 shadow-violet-900/50'
              }`}
            >
              {isListening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/35 motion-reduce:animate-none" />
              )}
              {isProcessing ? (
                <Loader2 size={30} className="animate-spin" aria-hidden="true" />
              ) : (
                <Mic size={30} aria-hidden="true" />
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              {isListening
                ? 'Listening… tap the microphone to stop.'
                : isRecordingSupported
                  ? 'Tap to speak your correction.'
                  : 'Microphone unavailable — type your correction below.'}
            </p>
          </div>

          {transcript && (
            <div className="flex items-start gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
              <Mic
                size={16}
                className="mt-0.5 shrink-0 text-violet-300"
                aria-hidden="true"
              />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300">
                  Live transcript
                </p>
                <p className="mt-1 text-sm text-violet-100">{transcript}</p>
              </div>
            </div>
          )}

          {feedbackMessage && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <Volume2
                size={16}
                className="mt-0.5 shrink-0 text-emerald-300"
                aria-hidden="true"
              />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                  Read-back confirmation
                </p>
                <p className="mt-1 text-sm text-emerald-100">{feedbackMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
            >
              <AlertCircle
                size={16}
                className="mt-0.5 shrink-0 text-amber-300"
                aria-hidden="true"
              />
              <p className="text-sm text-amber-100">{error}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Quick demo commands
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => runQuickCommand(command)}
                  disabled={isProcessing}
                  className="min-h-11 rounded-full border border-slate-700 bg-slate-800 px-3.5 py-2 text-left text-xs text-slate-200 transition active:scale-95 hover:border-violet-500/50 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  {command}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitManual();
            }}
            className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3"
          >
            <label
              htmlFor="whisperflow-manual-input"
              className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              <Keyboard size={14} aria-hidden="true" />
              Type a correction
            </label>
            <div className="flex items-center gap-2">
              <input
                id="whisperflow-manual-input"
                type="text"
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                placeholder="e.g. Change quantity to 8"
                maxLength={200}
                disabled={isProcessing}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!manualText.trim() || isProcessing}
                aria-label="Send typed correction"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition active:scale-95 hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {isProcessing ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
