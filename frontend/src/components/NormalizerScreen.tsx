import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Boxes,
  Database,
  Download,
  KeyRound,
  Link2,
  RefreshCw,
  Table2,
  X
} from 'lucide-react';
import type {
  NormalizationResponse,
  NormalizationTable
} from '@shared/types';
import {
  AlertBanner,
  Button,
  Chip,
  LoadingState,
  Toggle,
  TopBar,
  cx
} from './ui';
import ThreeCanvas from './ThreeCanvas';

const TABLE_ACCENTS: Record<string, string> = {
  Customers: 'bg-emerald-400',
  Bills: 'bg-sky-400',
  BillItems: 'bg-amber-400',
  Products: 'bg-violet-400'
};

function tableAccent(name: string, index: number): string {
  return (
    TABLE_ACCENTS[name] ??
    ['bg-emerald-400', 'bg-sky-400', 'bg-amber-400', 'bg-violet-400', 'bg-pink-400'][
      index % 5
    ]
  );
}

function SchemaTableView({
  normalization,
  selectedName,
  onSelect
}: {
  normalization: NormalizationResponse;
  selectedName: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {normalization.tables.map((table, index) => {
        const selected = table.name === selectedName;
        return (
          <section
            key={table.name}
            className={cx(
              'overflow-hidden rounded-2xl border bg-slate-950/60 transition',
              selected
                ? 'border-emerald-400/60'
                : 'border-slate-800'
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(selected ? null : table.name)}
              className="flex w-full items-center justify-between gap-2 border-b border-slate-800 px-3.5 py-2.5 text-left"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cx(
                    'h-2.5 w-2.5 rounded-full',
                    tableAccent(table.name, index)
                  )}
                />
                <span className="text-sm font-semibold text-white">
                  {table.name}
                </span>
              </span>
              <Chip tone="slate">{table.fields.length} fields</Chip>
            </button>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wide text-slate-500">
                  <th className="px-3.5 py-2 font-medium">Field</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-3.5 py-2 text-right font-medium">Key</th>
                </tr>
              </thead>
              <tbody>
                {table.fields.map((field) => (
                  <tr
                    key={field.name}
                    className="border-t border-slate-800/70 text-xs"
                  >
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-200">
                      {field.name}
                    </td>
                    <td className="px-2 py-2 text-[10px] uppercase text-slate-500">
                      {field.type}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      {field.primaryKey ? (
                        <Chip tone="amber">
                          <KeyRound className="h-2.5 w-2.5" />
                          PK
                        </Chip>
                      ) : field.foreignKey ? (
                        <Chip tone="sky">
                          <Link2 className="h-2.5 w-2.5" />
                          FK
                        </Chip>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function TableInspector({
  table,
  normalization,
  onClose
}: {
  table: NormalizationTable;
  normalization: NormalizationResponse;
  onClose: () => void;
}) {
  const fieldNames = useMemo(
    () => new Set(table.fields.map((field) => field.name)),
    [table]
  );

  const relevantDependencies = normalization.dependencies.filter(
    (dependency) =>
      [...dependency.determinant, ...dependency.dependent].some((field) =>
        fieldNames.has(field)
      )
  );

  return (
    <div className="animate-bv-fade-up rounded-2xl border border-slate-700 bg-slate-900/95 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Table inspection
          </p>
          <h3 className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-white">
            <Database className="h-4 w-4 text-emerald-300" />
            {table.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {table.fields.map((field) => (
          <div
            key={field.name}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] text-slate-200">
                {field.name}
              </p>
              {field.foreignKey ? (
                <p className="truncate text-[9px] text-sky-300/80">
                  → {field.foreignKey}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[9px] uppercase text-slate-500">
                {field.type}
              </span>
              {field.primaryKey ? (
                <Chip tone="amber">PK</Chip>
              ) : field.foreignKey ? (
                <Chip tone="sky">FK</Chip>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Functional dependencies
        </p>
        {relevantDependencies.length === 0 ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            No inferred functional dependencies touch this table yet. They appear
            here once the LLM suggests them.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {relevantDependencies.map((dependency, index) => (
              <li
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] text-slate-200">
                    {dependency.determinant.join(', ')} →{' '}
                    {dependency.dependent.join(', ')}
                  </p>
                  <Chip
                    tone={dependency.status === 'confirmed' ? 'emerald' : 'amber'}
                  >
                    {dependency.status}
                  </Chip>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                  {dependency.explanation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface NormalizerScreenProps {
  normalization: NormalizationResponse | null;
  loading: boolean;
  usedFallback: boolean;
  onBack: () => void;
  onReload: () => void;
  onExport: () => void;
}

export default function NormalizerScreen({
  normalization,
  loading,
  usedFallback,
  onBack,
  onReload,
  onExport
}: NormalizerScreenProps) {
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [animationSignal, setAnimationSignal] = useState(0);
  const [webglBlocked, setWebglBlocked] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const inspectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedName(null);
  }, [normalization?.source]);

  useEffect(() => {
    if (!selectedName) return;
    const timer = window.setTimeout(() => {
      inspectorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedName]);

  useEffect(() => {
    if (loading) {
      const timer = window.setTimeout(() => setSlowHint(true), 2500);
      return () => {
        window.clearTimeout(timer);
        setSlowHint(false);
      };
    }
    setSlowHint(false);
    return undefined;
  }, [loading]);

  const selectedTable =
    normalization?.tables.find((table) => table.name === selectedName) ?? null;

  const show3d = view === '3d' && !webglBlocked;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col">
        <TopBar
          title="Database architect"
          subtitle={
            normalization
              ? `${normalization.tables.length} tables · ${normalization.relationships.length} relationships`
              : 'Normalizing the bill record'
          }
          onBack={onBack}
          right={
            normalization ? (
              <Chip
                tone={normalization.status === 'verified' ? 'emerald' : 'amber'}
              >
                {normalization.status}
              </Chip>
            ) : null
          }
        />

        <div className="flex-1 px-4 pb-8">
          <div className="mt-3 flex items-center justify-between gap-2">
            <Toggle
              ariaLabel="Visualization mode"
              active={show3d ? 'left' : 'right'}
              onChange={(side) => setView(side === 'left' ? '3d' : '2d')}
              leftLabel={
                <>
                  <Box className="h-3.5 w-3.5" />
                  3D
                </>
              }
              rightLabel={
                <>
                  <Table2 className="h-3.5 w-3.5" />
                 2D
                </>
              }
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => {
                  setWebglBlocked(false);
                  setAnimationSignal((value) => value + 1);
                  setView('3d');
                }}
                aria-label="Replay normalization animation"
              >
                Replay
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={onExport}
                aria-label="Export bill"
              >
                Export
              </Button>
            </div>
          </div>

          {usedFallback ? (
            <div className="mt-3">
              <AlertBanner tone="info" title="Demo schema loaded">
                The normalization service was unreachable, so the verified mock
                schema is being visualized. Interactions stay fully live.
              </AlertBanner>
            </div>
          ) : null}

          {webglBlocked && view === '3d' ? (
            <div className="mt-3">
              <AlertBanner
                tone="warning"
                title="WebGL unavailable"
                action={
                  <Button size="sm" variant="secondary" onClick={onReload}>
                    Retry
                  </Button>
                }
              >
                Your device or browser blocked the 3D canvas. The 2D schema view
                below has the same information.
              </AlertBanner>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40">
              <LoadingState label="Splitting the flat record into normalized tables…" />
              {slowHint ? (
                <p className="px-4 pb-4 text-center text-[10px] text-slate-500">
                  Still working — the demo fallback will kick in if the service
                  does not respond.
                </p>
              ) : null}
            </div>
          ) : normalization ? (
            <>
              {show3d ? (
                <div className="mt-3">
                  <ThreeCanvas
                    normalization={normalization}
                    selectedTableName={selectedName}
                    animationSignal={animationSignal}
                    onSelectTable={(name) => setSelectedName(name)}
                    onWebGLUnavailable={() => setWebglBlocked(true)}
                    className="relative h-[380px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_50%_30%,#0f2b3a_0%,#020617_70%)] sm:h-[440px]"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {normalization.tables.map((table, index) => (
                        <span
                          key={table.name}
                          className="inline-flex items-center gap-1 text-[9px] text-slate-400"
                        >
                          <span
                            className={cx(
                              'h-1.5 w-1.5 rounded-full',
                              tableAccent(table.name, index)
                            )}
                          />
                          {table.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-500">
                      Drag to orbit · pinch to zoom · tap a table
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <SchemaTableView
                    normalization={normalization}
                    selectedName={selectedName}
                    onSelect={setSelectedName}
                  />
                </div>
              )}

              <div ref={inspectorRef} className="mt-3">
                {selectedTable ? (
                  <TableInspector
                    table={selectedTable}
                    normalization={normalization}
                    onClose={() => setSelectedName(null)}
                  />
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-3">
                    <p className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Boxes className="h-4 w-4 text-sky-300" />
                      {show3d
                        ? 'Tap any 3D table block to inspect keys and dependencies.'
                        : 'Tap a table header to inspect keys and dependencies.'}
                    </p>
                  </div>
                )}
              </div>

              <section className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-white">
                    Relationships
                  </h2>
                  <Chip tone="slate">
                    {normalization.relationships.length}
                  </Chip>
                </div>
                <div className="space-y-1.5">
                  {normalization.relationships.map((relationship, index) => (
                    <div
                      key={`${relationship.from}-${relationship.to}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[10px] text-slate-200">
                          {relationship.from}
                        </p>
                        <p className="truncate font-mono text-[10px] text-slate-500">
                          → {relationship.to}
                        </p>
                      </div>
                      <Chip tone="sky">{relationship.label}</Chip>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-white">
                    Functional dependencies
                  </h2>
                  <Chip tone="slate">
                    {normalization.dependencies.length}
                  </Chip>
                </div>
                <div className="space-y-2">
                  {normalization.dependencies.map((dependency, index) => (
                    <article
                      key={index}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] text-slate-200">
                          {dependency.determinant.join(', ')} →{' '}
                          {dependency.dependent.join(', ')}
                        </p>
                        <Chip
                          tone={
                            dependency.status === 'confirmed'
                              ? 'emerald'
                              : 'amber'
                          }
                        >
                          {dependency.status}
                        </Chip>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                        {dependency.explanation}
                      </p>
                    </article>
                  ))}
                  {normalization.dependencies.length === 0 ? (
                    <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-[11px] text-slate-500">
                      No functional dependencies were inferred for this bill.
                    </p>
                  ) : null}
                </div>
              </section>

              <p className="mt-5 text-center text-[9px] leading-relaxed text-slate-600">
                Source: {normalization.source} · Schema is fixed at runtime; this
                visualization never triggers database DDL.
              </p>
            </>
          ) : (
            <div className="mt-6">
              <AlertBanner
                tone="error"
                title="Normalization unavailable"
                action={
                  <Button size="sm" variant="secondary" onClick={onReload}>
                    Retry
                  </Button>
                }
              >
                We could not load the schema. Retry to pull the verified demo
                normalization.
              </AlertBanner>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
