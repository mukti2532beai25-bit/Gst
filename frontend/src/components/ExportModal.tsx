import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  ShieldAlert,
  Table2
} from 'lucide-react';
import type { BillExtractionResponse } from '@shared/types';
import { downloadBillCsv, downloadBillJson } from '../lib/export';
import { formatCurrency, itemsTotal } from '../lib/review';
import { AlertBanner, Button, Chip, Modal } from './ui';

interface ExportModalProps {
  open: boolean;
  bill: BillExtractionResponse | null;
  onClose: () => void;
}

export default function ExportModal({ open, bill, onClose }: ExportModalProps) {
  const [downloaded, setDownloaded] = useState<'json' | 'csv' | null>(null);

  if (!bill) return null;

  const total = itemsTotal(bill);

  const handleDownload = (format: 'json' | 'csv') => {
    if (format === 'json') {
      downloadBillJson(bill);
    } else {
      downloadBillCsv(bill);
    }
    setDownloaded(format);
    window.setTimeout(() => setDownloaded(null), 2600);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export bill"
      subtitle={`${bill.fields.billNumber.value ?? bill.billId} · ${
        bill.items.length
      } line item(s)`}
      footer={
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div>
        <AlertBanner tone="warning" title="Draft - Review Required">
          This export is generated from an unverified OCR draft. Confirm the bill
          in the review screen before filing it in your books.
        </AlertBanner>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Customer
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-white">
              {String(bill.fields.customerName.value ?? '—')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Grand total
            </p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-white">
              {formatCurrency(bill.fields.grandTotal.value)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Items total
            </p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-white">
              {formatCurrency(total)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Status
            </p>
            <div className="mt-1">
              {bill.status === 'confirmed' ? (
                <Chip tone="emerald">confirmed</Chip>
              ) : (
                <Chip tone="amber">needs review</Chip>
              )}
            </div>
          </div>
        </div>

        {downloaded ? (
          <div className="mt-3 animate-bv-fade-up">
            <AlertBanner tone="success" title={`${downloaded.toUpperCase()} downloaded`}>
              The draft file {downloaded === 'json' ? 'JSON' : 'CSV'} was saved to your
              device.
            </AlertBanner>
          </div>
        ) : null}

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={() => handleDownload('json')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-left transition active:scale-[0.99] active:border-emerald-400/50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <FileText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                JSON export
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                Full extraction with confidence, review status and warnings.
              </span>
            </span>
            {downloaded === 'json' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Download className="h-4 w-4 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDownload('csv')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-left transition active:scale-[0.99] active:border-sky-400/50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <Table2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                CSV export
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                Spreadsheet-ready header fields plus every line item row.
              </span>
            </span>
            {downloaded === 'csv' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Download className="h-4 w-4 text-slate-400" />
            )}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <p className="text-[10px] leading-relaxed text-slate-400">
            Exports include a machine-readable disclaimer and an export timestamp.
            Do not import into accounting software until the review status reads
            confirmed.
          </p>
        </div>
      </div>
    </Modal>
  );
}
