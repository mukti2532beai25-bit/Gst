import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Languages,
  Mic,
  UploadCloud
} from 'lucide-react';

export const DEMO_ACTIONS = {
  loadSample: 'load-sample',
  voiceQuantity: 'voice-quantity',
  voiceVernacular: 'voice-vernacular'
} as const;

interface DemoPresetBarProps {
  onSelectPreset: (action: string) => void;
  isDemoMode: boolean;
}

const PRESETS = [
  {
    action: DEMO_ACTIONS.loadSample,
    label: 'Load Sample Bill',
    icon: UploadCloud
  },
  {
    action: DEMO_ACTIONS.voiceQuantity,
    label: "Simulate Voice: 'Change qty to 8'",
    icon: Mic
  },
  {
    action: DEMO_ACTIONS.voiceVernacular,
    label: "Simulate Vernacular: 'Atta 2 Peti'",
    icon: Languages
  }
] as const;

export default function DemoPresetBar({
  onSelectPreset,
  isDemoMode
}: DemoPresetBarProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isDemoMode) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-violet-500/20 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-3 py-2 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <FlaskConical size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Demo presets
              </p>
              <p className="truncate text-[11px] text-slate-400">
                Hackathon mode · offline-safe fallbacks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Collapse demo presets' : 'Expand demo presets'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {isOpen ? (
              <ChevronUp size={18} aria-hidden="true" />
            ) : (
              <ChevronDown size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        {isOpen && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {PRESETS.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                type="button"
                onClick={() => onSelectPreset(action)}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 transition active:scale-[0.98] hover:border-violet-500/50 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:text-sm"
              >
                <Icon size={15} className="text-violet-300" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
