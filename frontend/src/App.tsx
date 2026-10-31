import { useCallback, useState } from 'react';
import type {
  BillExtractionResponse,
  NormalizationResponse
} from '@shared/types';
import Dashboard from './components/Dashboard';
import CaptureScreen from './components/CaptureScreen';
import BillReviewScreen from './components/BillReviewScreen';
import NormalizerScreen from './components/NormalizerScreen';
import ExportModal from './components/ExportModal';
import { LoadingState } from './components/ui';
import {
  DEMO_BUSINESSES,
  type Business
} from './lib/demo';
import {
  getBill,
  getNormalization,
  type ApiResult
} from './lib/api';

type Screen = 'dashboard' | 'capture' | 'review' | 'normalizer';

export default function App() {
  const [businesses] = useState<Business[]>(DEMO_BUSINESSES);
  const [businessId, setBusinessId] = useState(DEMO_BUSINESSES[0].id);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [extraction, setExtraction] = useState<BillExtractionResponse | null>(
    null
  );
  const [normalization, setNormalization] =
    useState<NormalizationResponse | null>(null);
  const [extractionFallback, setExtractionFallback] = useState(false);
  const [normalizationFallback, setNormalizationFallback] = useState(false);
  const [normalizationLoading, setNormalizationLoading] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reviewSession, setReviewSession] = useState(0);

  const business =
    businesses.find((item) => item.id === businessId) ?? businesses[0];

  const loadNormalization = useCallback(async (billId: string) => {
    setNormalizationLoading(true);
    setNormalization(null);
    const result = await getNormalization(billId);
    setNormalization(result.data);
    setNormalizationFallback(result.usedFallback);
    setNormalizationLoading(false);
  }, []);

  const handleBusinessChange = (nextId: string) => {
    setBusinessId(nextId);
    setExtraction(null);
    setNormalization(null);
    setExtractionFallback(false);
    setNormalizationFallback(false);
  };

  const applyExtraction = useCallback((result: ApiResult<BillExtractionResponse>) => {
    setExtraction(result.data);
    setExtractionFallback(result.usedFallback);
    setNormalization(null);
    setNormalizationFallback(false);
    setReviewSession((value) => value + 1);
    setScreen('review');
  }, []);

  const handleOpenBill = async (billId: string) => {
    setBillLoading(true);
    const result = await getBill(billId);
    setBillLoading(false);
    applyExtraction(result);
  };

  const handleOpenArchitect = async () => {
    const billId = extraction?.billId ?? 'demo-bill-001';
    setScreen('normalizer');

    if (!extraction) {
      const billResult = await getBill(billId);
      setExtraction(billResult.data);
      setExtractionFallback(billResult.usedFallback);
      setReviewSession((value) => value + 1);
    }

    await loadNormalization(billId);
  };

  if (billLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-slate-950 text-slate-100">
        <LoadingState label="Opening bill & restoring review state…" />
      </div>
    );
  }

  return (
    <>
      {screen === 'dashboard' ? (
        <Dashboard
          businesses={businesses}
          business={business}
          onBusinessChange={handleBusinessChange}
          onScan={() => setScreen('capture')}
          onOpenBill={handleOpenBill}
          onOpenArchitect={handleOpenArchitect}
        />
      ) : null}

      {screen === 'capture' ? (
        <CaptureScreen
          onBack={() => setScreen('dashboard')}
          onExtracted={applyExtraction}
        />
      ) : null}

      {screen === 'review' && extraction ? (
        <BillReviewScreen
          key={`${extraction.billId}-${reviewSession}`}
          extraction={extraction}
          usedFallback={extractionFallback}
          onChange={setExtraction}
          onBack={() => setScreen('dashboard')}
          onOpenArchitect={handleOpenArchitect}
          onExport={() => setExportOpen(true)}
        />
      ) : null}

      {screen === 'normalizer' ? (
        <NormalizerScreen
          normalization={normalization}
          loading={normalizationLoading}
          usedFallback={normalizationFallback}
          onBack={() => setScreen(extraction ? 'review' : 'dashboard')}
          onReload={() => {
            void loadNormalization(extraction?.billId ?? 'demo-bill-001');
          }}
          onExport={() => setExportOpen(true)}
        />
      ) : null}

      <ExportModal
        open={exportOpen}
        bill={extraction}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}
