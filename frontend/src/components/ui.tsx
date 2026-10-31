import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  ShieldAlert,
  X
} from 'lucide-react';
import type { ReviewStatus } from '@shared/types';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

type Tone = 'emerald' | 'amber' | 'sky' | 'slate' | 'rose' | 'violet';

const toneStyles: Record<Tone, string> = {
  emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  sky: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  slate: 'border-slate-600/60 bg-slate-800/60 text-slate-300',
  rose: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  violet: 'border-violet-400/30 bg-violet-400/10 text-violet-200'
};

export function ScreenShell({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('min-h-[100dvh] bg-slate-950 text-slate-100', className)}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
        {children}
      </div>
    </div>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  right
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/85 px-4 pb-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-300 transition active:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:bg-emerald-600',
  secondary:
    'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-800 border border-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/70 active:bg-slate-800',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500 active:bg-rose-600',
  amber: 'bg-amber-400 text-amber-950 shadow-lg shadow-amber-400/20 hover:bg-amber-300'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}) {
  const sizes = {
    sm: 'px-3 py-2 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-5 py-3.5 text-sm rounded-2xl gap-2'
  } as const;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        sizes[size],
        buttonVariants[variant],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function ConfidenceBadge({
  confidence,
  showLabel = false
}: {
  confidence: number;
  showLabel?: boolean;
}) {
  const high = confidence >= 0.85;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums',
        high ? toneStyles.emerald : toneStyles.amber
      )}
      title={`OCR confidence ${Math.round(confidence * 100)}%`}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          high ? 'bg-emerald-400' : 'bg-amber-400'
        )}
      />
      {showLabel ? 'Confidence ' : ''}
      {Math.round(confidence * 100)}%
    </span>
  );
}

const reviewTone: Record<ReviewStatus, Tone> = {
  pending: 'amber',
  corrected: 'sky',
  confirmed: 'emerald'
};

export function ReviewStatusChip({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
        toneStyles[reviewTone[status]]
      )}
    >
      {status}
    </span>
  );
}

export function AlertBanner({
  tone = 'warning',
  title,
  children,
  action
}: {
  tone?: 'warning' | 'error' | 'info' | 'success';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const config = {
    warning: { style: toneStyles.amber, Icon: AlertTriangle },
    error: { style: toneStyles.rose, Icon: ShieldAlert },
    info: { style: toneStyles.sky, Icon: Info },
    success: { style: toneStyles.emerald, Icon: CheckCircle2 }
  } as const;
  const { style, Icon } = config[tone];

  return (
    <div className={cx('rounded-xl border px-3 py-2.5', style)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{title}</p>
          {children ? (
            <div className="mt-1 text-[11px] leading-relaxed opacity-90">
              {children}
            </div>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  hint,
  right,
  children,
  className
}: {
  title?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('glass-panel p-4', className)}>
      {title ? (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
          </div>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  className
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 animate-bv-fade-in bg-slate-950/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'animate-bv-fade-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-900 shadow-2xl sm:max-w-lg sm:rounded-3xl',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="safe-bottom border-t border-slate-800 bg-slate-900/95 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

export function Chip({
  tone = 'slate',
  children,
  className
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Toggle({
  active,
  onChange,
  leftLabel,
  rightLabel,
  ariaLabel
}: {
  active: 'left' | 'right';
  onChange: (value: 'left' | 'right') => void;
  leftLabel: ReactNode;
  rightLabel: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 p-0.5"
    >
      {(['left', 'right'] as const).map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          aria-pressed={active === side}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
            active === side
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {side === 'left' ? leftLabel : rightLabel}
        </button>
      ))}
    </div>
  );
}
