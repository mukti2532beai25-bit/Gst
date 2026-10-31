import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillExtractionResponse } from '../../../shared/types';

export type WhisperLanguage = 'en' | 'hi' | 'pa';

const LANGUAGE_CODES: Record<WhisperLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  pa: 'pa-IN'
};

interface BrowserSpeechAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechAlternative;
}

interface BrowserSpeechResultList {
  readonly length: number;
  [index: number]: BrowserSpeechResult;
}

interface BrowserSpeechResultEvent extends Event {
  results: BrowserSpeechResultList;
  resultIndex: number;
}

interface BrowserSpeechErrorEvent extends Event {
  error: string;
  message?: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechResultEvent) => void) | null;
  onerror: ((event: BrowserSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

interface VoiceCorrectionResponse {
  bill: BillExtractionResponse;
  corrections: Array<{
    field: string;
    itemId?: string;
    originalValue: string | null;
    correctedValue: string;
  }>;
  readBack: string;
  warnings: string[];
}

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL || 'http://localhost:5000';

function getRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechWindow;
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Type your correction below instead.';
    case 'no-speech':
      return 'No speech was detected. Try again or type your correction below.';
    case 'audio-capture':
      return 'No microphone was found. Type your correction below instead.';
    case 'network':
      return 'Speech recognition needs a network connection. Type your correction below.';
    default:
      return `Speech recognition error (${code}). Type your correction below.`;
  }
}

function speakText(text: string, language: WhisperLanguage): void {
  if (!text || typeof window === 'undefined') return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE_CODES[language];
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Read-back is an enhancement; failure must never break the correction UI.
  }
}

export function useWhisperFlow() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<BillExtractionResponse | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const languageRef = useRef<WhisperLanguage>('en');

  const [isRecordingSupported] = useState(() => getRecognitionConstructor() !== null);

  const startListening = useCallback((language: WhisperLanguage) => {
    setError(null);
    setFeedbackMessage(null);
    languageRef.current = language;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError(
        'Speech recognition is not supported in this browser. Type your correction below instead.'
      );
      return;
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      // Ignore stale recognisers that are already stopped.
    }

    const recognition = new Recognition();
    recognition.lang = LANGUAGE_CODES[language];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const alternative = event.results[index]?.[0];
        if (alternative?.transcript) {
          parts.push(alternative.transcript);
        }
      }
      setTranscript(parts.join(' ').trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setError(describeSpeechError(event.error));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setTranscript('');
      setIsListening(true);
    } catch {
      setIsListening(false);
      setError('Unable to start the microphone. Type your correction below instead.');
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // The recogniser may already have ended.
    }
    setIsListening(false);
  }, []);

  const submitVoiceCorrection = useCallback(
    async (billId: string, customTranscript?: string) => {
      const text = (customTranscript ?? transcript).trim();

      if (!billId) {
        setError('No bill is selected for correction.');
        return;
      }

      if (!text) {
        setError('Speak or type a correction first.');
        return;
      }

      setIsProcessing(true);
      setError(null);
      setFeedbackMessage(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/bills/${encodeURIComponent(billId)}/corrections/voice`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ transcript: text })
          }
        );

        if (!response.ok) {
          throw new Error(`Voice correction failed (${response.status}).`);
        }

        const data = (await response.json()) as VoiceCorrectionResponse;
        setBill(data.bill);
        setTranscript(text);
        setFeedbackMessage(data.readBack);
        speakText(data.readBack, languageRef.current);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Voice correction failed. Please try again.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [transcript]
  );

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Nothing to clean up.
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
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
  };
}

export default useWhisperFlow;
