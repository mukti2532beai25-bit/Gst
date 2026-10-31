# Developer 3 Integration Summary & Handoff Guide

## 1. Live Backend Endpoints (on `feature/ocr-whisperflow`)
- `POST /api/bills/upload`: Multi-part bill upload with OCR fallback to `MOCK_EXTRACTION`.
- `POST /api/bills/:id/corrections/voice`: WhisperFlow voice command parser (handles quantity changes, price adjustments, and customer name changes with auto-recalculation across Hindi/Punjabi vernacular).
- `POST /api/bills/:id/corrections/voice-file`: Mobile audio-upload fallback (`.wav`, `.webm`, `.m4a`) that forwards to `WHISPER_API_URL` when configured and otherwise uses the filename or supplied fallback transcript.
- `POST /api/bills/:id/corrections`: Manual field and line-item corrections.
- `GET /api/bills/:id/readback`: Spoken TTS read-back summary generator.
- `GET /api/vocabulary` & `POST /api/vocabulary`: Vernacular shorthand store (e.g., chini -> Sugar, peti -> Box).
- `GET /api/bills/:id/normalization`: Relational decomposition payload ready for the 3D normalizer.

## 2. Frontend UI Components Ready for Dev 1
- `<WhisperFlowModal/>` (`frontend/src/components/WhisperFlowModal.tsx`):
  - Floating microphone voice capture modal.
  - Web Speech API integration with manual typing fallback and quick-command chips.
- `<VocabularyLearnCard/>` (`frontend/src/components/VocabularyLearnCard.tsx`):
  - Auto-learn prompt triggering on vernacular edits with direct POST to `/api/vocabulary`.
- `<DemoPresetBar/>` (`frontend/src/components/DemoPresetBar.tsx`):
  - 1-click preset bar for presentations (loads sample bill, simulates voice corrections, tests vernacular terms).
- `useWhisperFlow()` (`frontend/src/hooks/useWhisperFlow.ts`):
  - Reusable hook handling browser microphone access, speech recognition, and TTS playback.

## 3. End-to-End Demo Script (2-Minute Judging Walkthrough)
1. **0:00 - 0:20 (The Problem):** Show sample bill with vernacular shorthand (*chini*, *peti*) and an arithmetic discrepancy.
2. **0:20 - 0:45 (Capture & OCR):** Click "Load Sample Bill"; show extracted fields with review badges and the grand total warning.
3. **0:45 - 1:10 (WhisperFlow Correction):** Click mic or "Simulate Voice ('Change qty to 8')"; observe quantity update to 8, line total recalculate to ₹336, arithmetic warning clear, and TTS spoken feedback play.
4. **1:10 - 1:30 (Vernacular Memory):** Show `<VocabularyLearnCard/>` suggesting to remember *chini* -> *Sugar*; click "Save to Shop Vocabulary".
5. **1:30 - 2:00 (Structured Export & 3D View):** Hand off the confirmed review data for the 3D table decomposition and JSON export.
