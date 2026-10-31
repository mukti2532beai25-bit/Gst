import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  RefreshCw,
  Sparkles,
  Table2
} from 'lucide-react';
import type {
  BillExtractionResponse,
  ReviewStatus
} from '../../shared/types';
import { API_BASE_URL } from './components/api';
import DemoPresetBar, { DEMO_ACTIONS } from './components/DemoPresetBar';
import VocabularyLearnCard from './components/VocabularyLearnCard';
import WhisperFlowModal from './components/WhisperFlowModal';
import {
  DEMO_BILL,
  cloneBill,
  sampleBillFile
} from './components/demoFixtures';
import {
  applyVernacularTerms,
  detectVocabularySuggestions,
  mergeVocabularySuggestions,
  type VocabularyEntry,
  type VocabularySuggestion
} from './components/vocabularyDetector';

interface VoiceApiResponse {
  bill: BillExtractionResponse;
  readBack: string;
  warnings: string[];
}

const ARITHMETIC_WARNING = /(line items total|does not match|arithmetic mismatch)/i;

const NUMBER_WORDS: Record<string, number> = {
  ek: 1,
  ik: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  tin: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  saat: 7,
  sat: 7,
  seven: 7,
  aath: 8,
  ath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10
};

function formatMoney(value: number | null): string {
  return value === null ? '—' : `₹${value.toFixed(2)}`;
}

function formatFieldValue(value: string | number | null): string {
  return value === null ? '—' : String(value);
}

function statusClasses(status: ReviewStatus): string {
  switch (status) {
    case 'confirmed':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
    case 'corrected':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
}

function sumLineItems(bill: BillExtractionResponse): number {
  return bill.items.reduce(
    (total, item) => total + (typeof item.lineTotal === 'number' ? item.lineTotal : 0),
    0
  );
}

function reconcileWarnings(bill: BillExtractionResponse): BillExtractionResponse {
  const lineTotal = sumLineItems(bill);
  const grandTotal = bill.fields.grandTotal.value;

  if (
    typeof grandTotal === 'number' &&
    Math.abs(lineTotal - grandTotal) < 0.01
  ) {
    return {
      ...bill,
      warnings: bill.warnings.filter(
        (warning) => !ARITHMETIC_WARNING.test(warning)
      )
    };
  }

  return bill;
}

function parseSpokenNumber(text: string): number | null {
  const digitMatch = text.match(/\d+(?:[.,]\d+)?/);
  if (digitMatch) {
    return Number(digitMatch[0].replace(',', '.'));
  }

  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  for (const token of tokens) {
    if (token in NUMBER_WORDS) return NUMBER_WORDS[token];
  }

  return null;
}

function applyLocalVoice(
  bill: BillExtractionResponse,
  transcript: string
): BillExtractionResponse {
  const next = cloneBill(bill);
  const text = transcript.toLowerCase();
  const item = next.items[0];
  const spokenNumber = parseSpokenNumber(text);

  if (
    item &&
    spokenNumber !== null &&
    /(quantity|qty|kilo|kilogram|kg|peti|box)/i.test(text)
  ) {
    item.quantity = spokenNumber;
    if (/(kilo|kilogram|kg)/i.test(text)) item.unit = 'kg';
    if (/(peti|box)/i.test(text)) item.unit = 'Box';
    if (item.unitPrice !== null) {
      item.lineTotal = Number((spokenNumber * item.unitPrice).toFixed(2));
    }
    item.reviewStatus = 'corrected';
  }

  if (/(customer|grahak|naam|name is)/i.test(text)) {
    const match = text.match(
      /(?:name is|naam|name)\s+([\p{L}][\p{L}\s.'-]{1,40})/iu
    );
    const customerName = match?.[1]?.replace(/[.,!?;:]+$/u, '').trim();
    if (customerName) {
      next.fields.customerName = {
        value: customerName,
        confidence: 1,
        reviewStatus: 'corrected'
      };
    }
  }

  return next;
}

function buildLocalReadBack(bill: BillExtractionResponse): string {
  const billNumber = bill.fields.billNumber.value ?? '—';
  const customer = bill.fields.customerName.value ?? '—';
  const total = bill.fields.grandTotal.value ?? '—';

  if (bill.language === 'hi') {
    return `बिल ${billNumber}, ग्राहक ${customer}, कुल ${total} रुपये।`;
  }

  if (bill.language === 'pa') {
    return `ਬਿੱਲ ${billNumber}, ਗਾਹਕ ${customer}, ਕੁੱਲ ${total} ਰੁਪਏ।`;
  }

  return `Bill ${billNumber}, customer ${customer}, total ${total} rupees.`;
}

function speakText(text: string, language: BillExtractionResponse['language']): void {
  if (!text || typeof window === 'undefined') return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
      language === 'hi' ? 'hi-IN' : language === 'pa' ? 'pa-IN' : 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // TTS is an enhancement; the visual read-back card remains the source of truth.
  }
}

export default function App() {
  const [bill, setBill] = useState<BillExtractionResponse | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<VocabularySuggestion[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoMode] = useState(true);

  const activeSuggestion = suggestions[0] ?? null;
  const lineTotal = bill ? sumLineItems(bill) : 0;
  const grandTotal = bill?.fields.grandTotal.value ?? null;
  const hasMismatch =
    typeof grandTotal === 'number' && Math.abs(lineTotal - grandTotal) >= 0.01;

  const loadSampleBill = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setSuggestions([]);

    try {
      const form = new FormData();
      form.append('bill', sampleBillFile(), 'demo-bill-001.png');
      form.append('billId', 'demo-bill-001');
      form.append('language', 'pa');

      const response = await fetch(`${API_BASE_URL}/api/bills/upload`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status}).`);
      }

      const loaded = (await response.json()) as BillExtractionResponse;
      if (!loaded || !Array.isArray(loaded.items)) {
        throw new Error('Invalid bill payload.');
      }

      setBill(loaded);
      setStatusMessage(
        'Sample bill loaded: 5 kg Sugar at ₹42 = ₹210, grand total ₹336.'
      );
    } catch {
      setBill(cloneBill(DEMO_BILL));
      setErrorMessage(
        'Backend offline — loaded the bundled demo bill with local fixtures.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runVoicePreset = useCallback(
    async (transcript: string, vernacular: boolean) => {
      const previous = bill ?? cloneBill(DEMO_BILL);

      setIsLoading(true);
      setStatusMessage(null);
      setErrorMessage(null);

      let updated = previous;
      let readBack: string | null = null;
      let usedFallback = false;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/bills/${encodeURIComponent(previous.billId)}/corrections/voice`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ transcript })
          }
        );

        if (!response.ok) {
          throw new Error(`Voice preset failed (${response.status}).`);
        }

        const data = (await response.json()) as VoiceApiResponse;
        if (!data.bill || !Array.isArray(data.bill.items)) {
          throw new Error('Invalid voice payload.');
        }

        updated = data.bill;
        readBack = data.readBack;
      } catch {
        updated = applyLocalVoice(previous, transcript);
        usedFallback = true;
      }

      if (vernacular) {
        updated = applyVernacularTerms(updated, transcript);
      }

      const reconciled = reconcileWarnings(updated);
      setBill(reconciled);
      setSuggestions((existing) =>
        mergeVocabularySuggestions(
          existing,
          detectVocabularySuggestions(transcript, previous, reconciled)
        )
      );
      speakText(readBack ?? buildLocalReadBack(reconciled), reconciled.language);
      setStatusMessage(
        vernacular
          ? 'Vernacular preset applied: Atta → Wheat Flour, Peti → Box.'
          : 'Voice preset applied: quantity 8 kg, line total and grand total ₹336.'
      );
      setErrorMessage(
        usedFallback
          ? 'Backend offline — voice preset applied with local fixtures.'
          : null
      );
      setIsLoading(false);
    },
    [bill]
  );

  const handlePreset = useCallback(
    (action: string) => {
      if (action === DEMO_ACTIONS.loadSample) {
        void loadSampleBill();
      } else if (action === DEMO_ACTIONS.voiceQuantity) {
        void runVoicePreset('Change quantity to 8', false);
      } else if (action === DEMO_ACTIONS.voiceVernacular) {
        void runVoicePreset('Atta 2 Peti', true);
      }
    },
    [loadSampleBill, runVoicePreset]
  );

  const handleCorrectionApplied = useCallback(
    (updatedBill: BillExtractionResponse, transcript = '') => {
      const reconciled = reconcileWarnings(updatedBill);
      setBill(reconciled);
      setSuggestions((existing) =>
        mergeVocabularySuggestions(
          existing,
          detectVocabularySuggestions(transcript, bill, reconciled)
        )
      );
      setStatusMessage('Voice correction applied.');
      setErrorMessage(null);
    },
    [bill]
  );

  const handleVocabularySaved = useCallback((entry: VocabularyEntry) => {
    setSuggestions((existing) => existing.slice(1));
    setStatusMessage(
      entry.id.startsWith('local-')
        ? `Saved '${entry.spokenOrWrittenTerm}' locally — backend offline.`
        : `Saved '${entry.spokenOrWrittenTerm}' → '${entry.canonicalValue}' to shop vocabulary.`
    );
  }, []);

  const handleDismissSuggestion = useCallback(() => {
    setSuggestions((existing) => existing.slice(1));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DemoPresetBar onSelectPreset={handlePreset} isDemoMode={isDemoMode} />

      <main className="mx-auto w-full max-w-4xl px-3 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
              <Sparkles size={14} aria-hidden="true" />
              Mobile Ledger Intelligence
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              BahiVerse AI
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Handwritten bills, voice corrections, and shop vocabulary memory.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSampleBill()}
            disabled={isLoading}
            aria-label="Load sample bill"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-violet-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={18} aria-hidden="true" />
            )}
          </button>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        )}

        {statusMessage && (
          <div className="mb-3 flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{statusMessage}</p>
          </div>
        )}

        {bill ? (
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-slate-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-white">Bill review</h2>
                <p className="text-xs text-slate-400">
                  {bill.billId} · {bill.language.toUpperCase()} ·{' '}
                  {bill.status.replace('_', ' ')}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                  hasMismatch
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                {hasMismatch ? 'Review totals' : 'Totals reconciled'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-slate-800 px-4 py-4 sm:grid-cols-4 sm:px-5">
              {[
                { label: 'Bill no.', field: bill.fields.billNumber },
                { label: 'Bill date', field: bill.fields.billDate },
                { label: 'Customer', field: bill.fields.customerName },
                { label: 'Grand total', field: bill.fields.grandTotal }
              ].map(({ label, field }) => (
                <div key={label} className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {label === 'Grand total'
                      ? formatMoney(
                          typeof field.value === 'number' ? field.value : null
                        )
                      : formatFieldValue(field.value)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {Math.round(field.confidence * 100)}% confidence
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Item</th>
                    <th className="px-3 py-3 font-medium">Qty</th>
                    <th className="px-3 py-3 font-medium">Unit</th>
                    <th className="px-3 py-3 font-medium">Rate</th>
                    <th className="px-3 py-3 font-medium">Line total</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bill.items.map((item, index) => (
                    <tr key={item.id ?? `${item.description}-${index}`}>
                      <td className="px-4 py-3 font-medium text-slate-100 sm:px-5">
                        {item.description}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {item.quantity ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {item.unit ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {formatMoney(item.unitPrice)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-100">
                        {formatMoney(item.lineTotal)}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusClasses(
                            item.reviewStatus
                          )}`}
                        >
                          {item.reviewStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3 text-xs sm:px-5">
              <span className="text-slate-400">
                Line items: <strong className="text-slate-200">{formatMoney(lineTotal)}</strong>
              </span>
              <span className="text-slate-400">
                Grand total:{' '}
                <strong className="text-slate-200">
                  {formatMoney(typeof grandTotal === 'number' ? grandTotal : null)}
                </strong>
              </span>
            </div>

            {bill.warnings.length > 0 && (
              <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:px-5">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                  <AlertTriangle size={13} aria-hidden="true" />
                  Warnings
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs text-amber-100/90">
                  {bill.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <VocabularyLearnCard
                key={
                  activeSuggestion
                    ? `${activeSuggestion.spokenOrWrittenTerm}:${activeSuggestion.valueType}`
                    : 'no-suggestion'
                }
                suggestion={activeSuggestion}
                onDismiss={handleDismissSuggestion}
                onSaved={handleVocabularySaved}
              />
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center">
            <Table2 size={36} className="mx-auto text-slate-600" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              No bill loaded yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
              Use &apos;Load Sample Bill&apos; in the demo bar to open the
              uncorrected 5 kg Sugar bill, or tap the microphone to try a voice
              correction.
            </p>
            <button
              type="button"
              onClick={() => void loadSampleBill()}
              disabled={isLoading}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-violet-500 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {isLoading ? (
                <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
              ) : null}
              Load Sample Bill
            </button>
          </section>
        )}
      </main>

      {!isVoiceOpen && (
        <button
          type="button"
          onClick={() => setIsVoiceOpen(true)}
          aria-label="Open WhisperFlow voice correction"
          className="fixed bottom-6 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-white shadow-2xl shadow-violet-950/50 transition active:scale-95 hover:bg-violet-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/50 sm:right-8"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/25 motion-reduce:animate-none" />
          <Mic size={26} aria-hidden="true" />
        </button>
      )}

      <WhisperFlowModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        billId={bill?.billId ?? 'demo-bill-001'}
        onCorrectionApplied={handleCorrectionApplied}
        currentLanguage={bill?.language ?? 'pa'}
      />
    </div>
  );
}
