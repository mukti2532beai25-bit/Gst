import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Layers3,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store
} from 'lucide-react';
import { DEMO_RECENT_BILLS, LANGUAGE_LABEL, type Business } from '../lib/demo';
import {
  Chip,
  ConfidenceBadge,
  ScreenShell,
  SectionCard,
  cx
} from './ui';
import { formatCurrency } from '../lib/review';

interface DashboardProps {
  businesses: Business[];
  business: Business;
  onBusinessChange: (businessId: string) => void;
  onScan: () => void;
  onOpenBill: (billId: string) => void;
  onOpenArchitect: () => void;
}

const stats = [
  { label: 'Bills today', value: '12', icon: FileText, tone: 'text-sky-300' },
  { label: 'Need review', value: '3', icon: Clock3, tone: 'text-amber-300' },
  { label: 'Auto-synced', value: '98%', icon: ShieldCheck, tone: 'text-emerald-300' }
];

export default function Dashboard({
  businesses,
  business,
  onBusinessChange,
  onScan,
  onOpenBill,
  onOpenArchitect
}: DashboardProps) {
  return (
    <ScreenShell>
      <div className="safe-top px-4 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-emerald-950 shadow-lg shadow-emerald-500/20">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                BahiVerse AI
              </p>
              <h1 className="text-base font-semibold leading-tight text-white">
                Namaste, {business.owner.split(' ')[0]}
              </h1>
            </div>
          </div>
          <Chip tone="emerald">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Demo live
          </Chip>
        </header>

        <div className="mt-4">
          <label
            htmlFor="business-select"
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400"
          >
            <Store className="h-3.5 w-3.5" />
            Business
          </label>
          <div className="relative">
            <select
              id="business-select"
              value={business.id}
              onChange={(event) => onBusinessChange(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20"
            >
              {businesses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {LANGUAGE_LABEL[item.preferredLanguage]}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-slate-500">
            {business.location} · Preferred language {LANGUAGE_LABEL[business.preferredLanguage]}
          </p>
        </div>

        <section className="relative mt-5 overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-900 p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative">
            <Chip tone="emerald">
              <Sparkles className="h-3 w-3" />
              OCR + Voice corrections
            </Chip>
            <h2 className="mt-3 text-balance text-xl font-bold leading-snug text-white">
              Snap a handwritten bill. Let BahiVerse do the khata work.
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Extract totals & line items in seconds, fix them with your voice, and
              watch your ledger normalize into a clean 3D schema.
            </p>
            <button
              type="button"
              onClick={onScan}
              className="mt-4 flex w-full items-center justify-between rounded-2xl bg-emerald-400 px-4 py-3.5 text-left font-semibold text-emerald-950 shadow-lg shadow-emerald-500/25 transition active:scale-[0.99] active:bg-emerald-300"
            >
              <span className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-950/10">
                  <ScanLine className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm">Scan a Bill</span>
                  <span className="block text-[10px] font-medium text-emerald-900/80">
                    Camera or upload · Punjabi / Hindi / English
                  </span>
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="glass-panel flex flex-col gap-2 p-3"
            >
              <Icon className={cx('h-4 w-4', tone)} />
              <div>
                <p className="text-lg font-bold leading-none text-white">{value}</p>
                <p className="mt-1 text-[10px] text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <SectionCard
          title="Recent bills"
          hint="Tap a bill to reopen its review"
          className="mt-4"
          right={<Chip tone="slate">{DEMO_RECENT_BILLS.length}</Chip>}
        >
          <ul className="divide-y divide-slate-800">
            {DEMO_RECENT_BILLS.map((bill) => (
              <li key={bill.id}>
                <button
                  type="button"
                  onClick={() => onOpenBill(bill.id)}
                  className="flex w-full items-center gap-3 py-3 text-left transition active:opacity-70"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-800/70 text-slate-300">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-white">
                        {bill.customer}
                      </span>
                      {bill.status === 'needs_review' ? (
                        <Chip tone="amber">review</Chip>
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {bill.billNumber} · {bill.when}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-100">
                      {formatCurrency(bill.amount)}
                    </span>
                    <ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 text-slate-500" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <button
          type="button"
          onClick={onOpenArchitect}
          className="glass-panel mt-4 flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400/20 to-violet-500/20 text-sky-300">
            <Boxes className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">
              3D Database Architect
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
              Explore how this bill splits into Customers, Bills, BillItems &
              Products.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>

        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-600">
          <ConfidenceBadge confidence={0.94} />
          <span>Confidence-aware review keeps your khata audit-ready.</span>
        </div>
      </div>
    </ScreenShell>
  );
}
