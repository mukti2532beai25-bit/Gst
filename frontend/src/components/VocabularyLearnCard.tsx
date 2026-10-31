import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { postJson } from './api';
import type {
  VocabularyEntry,
  VocabularySuggestion
} from './vocabularyDetector';

interface VocabularyLearnCardProps {
  suggestion: VocabularySuggestion | null;
  onDismiss: () => void;
  onSaved?: (entry: VocabularyEntry) => void;
}

export default function VocabularyLearnCard({
  suggestion,
  onDismiss,
  onSaved
}: VocabularyLearnCardProps) {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsSaving(false);
  }, [
    suggestion?.spokenOrWrittenTerm,
    suggestion?.canonicalValue,
    suggestion?.valueType
  ]);

  if (!suggestion) return null;

  const saveMapping = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const saved = await postJson<VocabularyEntry>('/api/vocabulary', {
        spokenOrWrittenTerm: suggestion.spokenOrWrittenTerm,
        canonicalValue: suggestion.canonicalValue,
        valueType: suggestion.valueType
      });
      onSaved?.(saved);
    } catch {
      // Offline demo fallback: remember the mapping for this browser session.
      const localEntry: VocabularyEntry = {
        id: `local-${Date.now()}`,
        spokenOrWrittenTerm: suggestion.spokenOrWrittenTerm,
        canonicalValue: suggestion.canonicalValue,
        valueType: suggestion.valueType,
        confirmedByUser: true
      };

      try {
        window.localStorage.setItem(
          `bahiverse:vocabulary:${suggestion.valueType}:${suggestion.spokenOrWrittenTerm}`,
          JSON.stringify(localEntry)
        );
      } catch {
        // Private browsing may block storage; the in-memory callback still works.
      }

      if (onSaved) {
        onSaved(localEntry);
      } else {
        onDismiss();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg shadow-emerald-950/20 transition"
    >
      <div className="flex items-start gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20 motion-reduce:animate-none" />
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            <Sparkles size={13} aria-hidden="true" />
            Learned term
          </div>
          <p className="mt-1 text-sm leading-relaxed text-emerald-50">
            Remember this for this shop? Next time &apos;
            {suggestion.spokenOrWrittenTerm}&apos; will automatically be digitized
            as &apos;{suggestion.canonicalValue}&apos;.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void saveMapping()}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition active:scale-[0.98] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} aria-hidden="true" />
              )}
              Save to Shop Vocabulary
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 px-4 py-2 text-sm font-medium text-emerald-100 transition active:scale-[0.98] hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <X size={16} aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
