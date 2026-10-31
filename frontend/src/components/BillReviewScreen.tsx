import { useMemo, useState } from 'react';
import {
  Boxes,
  Calculator,
  CheckCheck,
  Download,
  Languages,
  Mic,
  Plus,
  Trash2
} from 'lucide-react';
import type {
  BillExtractionResponse,
  ExtractedBillItem
} from '@shared/types';
import {
  REVIEW_FIELDS,
  arithmeticMismatch,
  formatCurrency,
  itemsTotal,
  lineMismatchCount,
  round2,
  type ReviewFieldKey
} from '../lib/review';
import { LANGUAGE_LABEL, SPEECH_LOCALE, type Language } from '../lib/demo';
import {
  AlertBanner,
  Button,
  Chip,
  ConfidenceBadge,
  ReviewStatusChip,
  ScreenShell,
  SectionCard,
  TopBar,
  cx
} from './ui';
import WhisperFlowModal from './WhisperFlowModal';

interface BillReviewScreenProps {
  extraction: BillExtractionResponse;
  usedFallback: boolean;
  onChange: (bill: BillExtractionResponse) => void;
  onBack: () => void;
  onOpenArchitect: () => void;
  onExport: () => void;
}

const toInputValue = (value: string | number | null): string =>
  value === null || value === undefined ? '' : String(value);

const parseNumber = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function BillReviewScreen({
  extraction,
  usedFallback,
  onChange,
  onBack,
  onOpenArchitect,
  onExport
}: BillReviewScreenProps) {
  const [draft, setDraft] = useState<BillExtractionResponse>(extraction);
  const [whisperOpen, setWhisperOpen] = useState(false);
  const [whisperKey, setWhisperKey] = useState<ReviewFieldKey>('grandTotal');
  const [confirmedFlash, setConfirmedFlash] = useState(false);

  const mismatch = useMemo(() => arithmeticMismatch(draft), [draft]);
  const badLines = useMemo(() => lineMismatchCount(draft), [draft]);
  const computedTotal = useMemo(() => itemsTotal(draft), [draft]);

  const commit = (next: BillExtractionResponse) => {
    setDraft(next);
    onChange(next);
  };

  const setFieldValue = (
    key: ReviewFieldKey,
    value: string | number | null
  ) => {
    const fields = {
      ...draft.fields,
      [key]: {
        ...draft.fields[key],
        value,
        reviewStatus: 'corrected' as const
      }
    } as BillExtractionResponse['fields'];
    commit({ ...draft, fields, status: 'needs_review' });
  };

  const updateItem = (index: number, patch: Partial<ExtractedBillItem>) => {
    const items = draft.items.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, ...patch, reviewStatus: 'corrected' as const }
        : item
    );
    commit({ ...draft, items, status: 'needs_review' });
  };

  const updateItemNumber = (
    index: number,
    field: 'quantity' | 'unitPrice' | 'lineTotal',
    raw: string
  ) => {
    const item = draft.items[index];
    const value = parseNumber(raw);
    const patch: Partial<ExtractedBillItem> = { [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? value : item.quantity;
      const unitPrice = field === 'unitPrice' ? value : item.unitPrice;
      patch.lineTotal =
        quantity !== null && unitPrice !== null
          ? round2(quantity * unitPrice)
          : item.lineTotal;
    }

    updateItem(index, patch);
  };

  const addItem = () => {
    const items: ExtractedBillItem[] = [
      ...draft.items,
      {
        description: 'New item',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        lineTotal: 0,
        reviewStatus: 'pending'
      }
    ];
    commit({ ...draft, items, status: 'needs_review' });
  };

  const removeItem = (index: number) => {
    if (draft.items.length <= 1) return;
    commit({
      ...draft,
      items: draft.items.filter((_, itemIndex) => itemIndex !== index),
      status: 'needs_review'
    });
  };

  const confirmAll = () => {
    const fields = Object.fromEntries(
      Object.entries(draft.fields).map(([key, field]) => [
        key,
        { ...field, reviewStatus: 'confirmed' as const }
      ])
    ) as BillExtractionResponse['fields'];
    commit({
      ...draft,
      fields,
      items: draft.items.map((item) => ({
        ...item,
        reviewStatus: 'confirmed' as const
      })),
      status: 'confirmed',
      warnings: []
    });
    setConfirmedFlash(true);
    window.setTimeout(() => setConfirmedFlash(false), 2600);
  };

  const openWhisper = (key: ReviewFieldKey) => {
    setWhisperKey(key);
    setWhisperOpen(true);
  };

  const highConfidenceCount = REVIEW_FIELDS.filter(
    (field) => draft.fields[field.key].confidence >= 0.85
  ).length;

  const whisperFields = REVIEW_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: toInputValue(draft.fields[field.key].value as string | number | null)
  }));

  const language = draft.language as Language;

  return (
    <ScreenShell>
      <TopBar
        title="Review bill"
        subtitle={`${toInputValue(draft.fields.billNumber.value) || 'Untitled'} · ${
          LANGUAGE_LABEL[language] ?? language
        }`}
        onBack={onBack}
        right={
          draft.status === 'confirmed' ? (
            <Chip tone="emerald">Confirmed</Chip>
          ) : (
            <Chip tone="amber">Needs review</Chip>
          )
        }
      />

      <div className="flex-1 px-4 pb-4">
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Languages className="h-3.5 w-3.5" />
            {LANGUAGE_LABEL[language] ?? language} handwriting
          </div>
          <Chip tone="slate">
            {highConfidenceCount}/{REVIEW_FIELDS.length} high confidence
          </Chip>
        </div>

        {usedFallback ? (
          <div className="mt-3">
            <AlertBanner tone="info" title="Demo extraction loaded">
              The OCR service was unreachable, so BahiVerse is using the verified
              mock bill. Every review control stays fully functional.
            </AlertBanner>
          </div>
        ) : null}

        {confirmedFlash ? (
          <div className="mt-3 animate-bv-fade-up">
            <AlertBanner tone="success" title="Bill confirmed">
              Draft marked as confirmed and ready for export.
            </AlertBanner>
          </div>
        ) : null}

        <SectionCard
          title="Bill details"
          hint="Tap a field to correct it. Badges show OCR confidence."
          className="mt-3"
          right={
            draft.status === 'confirmed' ? null : (
              <button
                type="button"
                onClick={confirmAll}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 transition active:bg-emerald-400/20"
              >
                <CheckCheck className="h-3 w-3" />
                Confirm all
              </button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REVIEW_FIELDS.map((field) => {
              const current = draft.fields[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor={`field-${field.key}`}
                      className="text-[11px] font-medium text-slate-300"
                    >
                      {field.label}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge confidence={current.confidence} />
                      {current.reviewStatus !== 'pending' ? (
                        <ReviewStatusChip status={current.reviewStatus} />
                      ) : null}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      id={`field-${field.key}`}
                      type={field.inputType}
                      inputMode={field.numeric ? 'decimal' : 'text'}
                      step={field.numeric ? '0.01' : undefined}
                      value={toInputValue(
                        current.value as string | number | null
                      )}
                      placeholder={field.placeholder}
                      onChange={(event) => {
                        if (field.numeric) {
                          setFieldValue(field.key, parseNumber(event.target.value));
                        } else {
                          setFieldValue(field.key, event.target.value);
                        }
                      }}
                      className={cx(
                        'field-input',
                        field.numeric ? 'pr-14 tabular-nums' : ''
                      )}
                    />
                    {field.numeric ? (
                      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openWhisper(field.key)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-slate-800 text-emerald-300 transition hover:bg-slate-700"
                          aria-label={`Correct ${field.label} with voice`}
                        >
                          <Mic className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="mt-3 space-y-2">
          {draft.warnings.map((warning, index) => (
            <AlertBanner
              key={`${warning}-${index}`}
              tone="warning"
              title="Extraction warning"
            >
              {warning}
            </AlertBanner>
          ))}

          {mismatch.hasMismatch ? (
            <AlertBanner
              tone="error"
              title="Arithmetic mismatch"
              action={
                <Button
                  size="sm"
                  variant="amber"
                  onClick={() => setFieldValue('grandTotal', mismatch.expected)}
                >
                  Fix total
                </Button>
              }
            >
              Line items add up to {formatCurrency(mismatch.expected)} but the
              grand total says {formatCurrency(mismatch.actual)} (difference{' '}
              {formatCurrency(Math.abs(mismatch.difference))}).
            </AlertBanner>
          ) : (
            <AlertBanner tone="success" title="Totals reconcile">
              Line items and grand total agree at{' '}
              {formatCurrency(mismatch.expected)}.
            </AlertBanner>
          )}

          {badLines > 0 ? (
            <AlertBanner tone="warning" title={`${badLines} line item(s) need attention`}>
              Quantity × unit price does not match the line total. Edit the row or
              re-enter the rate.
            </AlertBanner>
          ) : null}
        </div>

        <SectionCard
          title="Line items"
          hint="Editable table · auto-recalculates line totals"
          className="mt-3"
          right={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={addItem}
            >
              Add
            </Button>
          }
        >
          <div className="space-y-2.5">
            {draft.items.map((item, index) => {
              const lineDiff =
                item.quantity !== null &&
                item.unitPrice !== null &&
                item.lineTotal !== null
                  ? round2(item.quantity * item.unitPrice - item.lineTotal)
                  : 0;
              const lineBad = Math.abs(lineDiff) > 0.5;

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[10px] font-semibold text-slate-500">
                      #{index + 1}
                    </span>
                    <input
                      value={item.description}
                      onChange={(event) =>
                        updateItem(index, { description: event.target.value })
                      }
                      aria-label={`Item ${index + 1} description`}
                      className="field-input flex-1 py-2 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={draft.items.length <= 1}
                      aria-label={`Remove item ${index + 1}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 text-rose-300 transition hover:bg-slate-800 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
                        Qty
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={toInputValue(item.quantity)}
                        onChange={(event) =>
                          updateItemNumber(index, 'quantity', event.target.value)
                        }
                        className="field-input py-1.5 text-xs tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
                        Unit
                      </span>
                      <input
                        value={item.unit ?? ''}
                        onChange={(event) =>
                          updateItem(index, { unit: event.target.value || null })
                        }
                        className="field-input py-1.5 text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
                        Rate
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={toInputValue(item.unitPrice)}
                        onChange={(event) =>
                          updateItemNumber(index, 'unitPrice', event.target.value)
                        }
                        className="field-input py-1.5 text-xs tabular-nums"
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
                        Line total
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={toInputValue(item.lineTotal)}
                        onChange={(event) =>
                          updateItemNumber(index, 'lineTotal', event.target.value)
                        }
                        className={cx(
                          'field-input py-1.5 text-xs tabular-nums',
                          lineBad ? 'border-amber-400/70' : ''
                        )}
                      />
                    </label>
                    <div className="flex flex-col items-end gap-1 pb-0.5">
                      <ReviewStatusChip status={item.reviewStatus} />
                      {lineBad ? (
                        <span className="text-[9px] font-medium text-amber-300">
                          off by {formatCurrency(Math.abs(lineDiff))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
              <Calculator className="h-3.5 w-3.5 text-emerald-300" />
              Items total
            </span>
            <span className="text-sm font-bold tabular-nums text-white">
              {formatCurrency(computedTotal)}
            </span>
          </div>
        </SectionCard>

        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
          <p className="text-[10px] leading-relaxed text-amber-200/80">
            This bill remains a draft until you confirm it. Exports are stamped
            "Draft - Review Required" so nothing reaches your books unverified.
          </p>
        </div>
      </div>

      <div className="safe-bottom sticky bottom-0 z-20 border-t border-slate-800 bg-slate-950/90 px-4 pt-3 backdrop-blur">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setWhisperOpen(true)}
            icon={<Mic className="h-4 w-4" />}
          >
            Speak
          </Button>
          <Button
            className="flex-[1.4]"
            onClick={onOpenArchitect}
            icon={<Boxes className="h-4 w-4" />}
          >
            3D Architect
          </Button>
          <Button
            variant="secondary"
            onClick={onExport}
            aria-label="Export bill"
            className="px-3.5"
            icon={<Download className="h-4 w-4" />}
          >
            <span className="sr-only">Export</span>
          </Button>
        </div>
      </div>

      <WhisperFlowModal
        open={whisperOpen}
        onClose={() => setWhisperOpen(false)}
        fields={whisperFields}
        defaultKey={whisperKey}
        locale={SPEECH_LOCALE[language] ?? 'en-IN'}
        onApply={(key, value) => setFieldValue(key, value)}
      />
    </ScreenShell>
  );
}
