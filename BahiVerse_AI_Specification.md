# BahiVerse AI — Product & Architecture Specification

**Status:** Baseline specification
**Branch:** `feature/ocr-whisperflow`
**Audience:** Frontend, backend, and AI engineers

---

## 1. Product Summary

BahiVerse AI is a mobile-first digital ledger for small shopkeepers. It turns a photo of a handwritten bill into structured ledger data, lets the shopkeeper correct that data by voice in their own language, and teaches the system the shop's local vocabulary over time. It also visualises how the resulting bill data can be normalised into a relational database, rendered as an interactive 3D scene.

The product is a **human-in-the-loop** system. OCR, language models, and voice services are assistive; the shopkeeper confirms or corrects every important value. The system must remain demonstrable even when external AI services are unavailable.

## 2. Goals

1. Digitise handwritten bills in **English, Hindi, and Punjabi**.
2. Attach a **confidence score** and a **review flag** to every extracted field and line item.
3. Provide a **voice-first correction and read-back layer** ("WhisperFlow") for natural-language edits.
4. Learn **shop-specific vernacular vocabulary** (e.g. `chini` → `Sugar`, `peti` → `Box`).
5. Visualise **relational normalisation** of bill data in **3D** using Three.js.
6. Keep the database schema **fixed and migration-safe** at runtime.

## 3. Non-Goals

- No runtime DDL, no dynamic Prisma migrations driven by uploaded files.
- No unverified tax inference. Tax values are only accepted when present on the bill or explicitly confirmed by the user.
- No automatic confirmation of low-confidence fields without user review.
- No replacement of statutory accounting/tax software.

## 4. Grounding Contracts

All clients and services share the contracts in `shared/types.ts`. The database models live in `backend/prisma/schema.prisma`. Mock fixtures in `backend/src/mockData.ts` are the canonical demo fallback.

Core contracts:

- `BillExtractionResponse` — bill header fields, line items, warnings, language, review status.
- `FieldItem<T>` — `{ value, confidence, reviewStatus }` for every scalar field.
- `ExtractedBillItem` — description, quantity, unit, unit price, line total, review status.
- `NormalizationResponse` — tables, relationships, functional dependencies.
- `NormalizationTable`, `NormalizationTableField`, `NormalizationRelationship`, `FunctionalDependency` — normalisation visualiser payload.
- `ReviewStatus` — `pending | confirmed | corrected`.

No service may define a parallel, conflicting representation of these shapes.

## 5. User Journeys

### 5.1 Bill Capture and Digitisation

1. Shopkeeper opens the mobile web app and captures/uploads a bill photo.
2. Backend stores the image reference and creates a `ProcessingJob` for the OCR stage.
3. OCR extracts header fields and line items in the detected language (`en`, `hi`, `pa`).
4. Each field/item receives a confidence score and `reviewStatus: "pending"`.
5. The response includes warnings when totals do not reconcile or confidence is low.
6. The UI highlights low-confidence fields for review.

**Fallback:** if OCR fails, times out, or returns an invalid payload, the backend responds with `MOCK_EXTRACTION` and marks the job as degraded. The app never shows a blank bill screen.

### 5.2 Voice-First Correction (WhisperFlow)

Examples of natural corrections:

- "Do bhaiya, quantity paanch kilo kar do." → quantity = 5 kg
- "Customer da naam Ravi Kumar hai." → customerName = "Ravi Kumar"
- "Sugar di price forty-two rakho." → unitPrice = 42

Flow:

1. Shopkeeper taps the microphone on a field or on the bill.
2. Audio is transcribed (or the transcript is supplied directly in demo mode).
3. The correction parser maps the utterance to a known field/item and value.
4. The edited field is set to `reviewStatus: "corrected"`.
5. A `Correction` record captures original value, corrected value, and source (`voice`).
6. The system speaks back the updated value for confirmation.

**Fallback:** if transcription or parsing fails, the API returns the unchanged bill plus a warning. The manual edit path remains available.

### 5.3 Spoken Read-Back

The read-back layer converts bill data into a short utterance in the bill language, reading back the values that are pending or recently corrected. It is deterministic and must not depend on an external LLM.

### 5.4 Vernacular Vocabulary Memory

Shopkeepers use local terms that generic OCR/LLMs mishandle. The system stores mappings against a business:

| spokenOrWrittenTerm | canonicalValue | valueType |
| ------------------- | -------------- | --------- |
| chini               | Sugar          | product   |
| peti                | Box            | unit      |
| atta                | Wheat Flour    | product   |

- Mappings are suggested when a term is repeatedly corrected.
- Only `confirmedByUser: true` mappings are applied automatically.
- Mapping application is deterministic string normalisation before persistence.

### 5.5 3D Normalisation Visualiser

1. Backend returns a `NormalizationResponse` for a bill.
2. Frontend renders each `NormalizationTable` as a node in 3D space.
3. `NormalizationRelationship` entries become labelled edges (one-to-one, one-to-many, many-to-one).
4. Table fields identify primary and foreign keys.
5. `FunctionalDependency` entries are shown as inferred/confirmed annotations.
6. The scene is touch-friendly: orbit/pan/zoom gestures, large tap targets, mobile-first layout.

**Fallback:** if the normalisation API fails, the client uses `MOCK_NORMALIZATION` and displays a "demo data" badge.

## 6. Architecture

```
frontend/ (React + Vite + Tailwind + Three.js)
    │  typed against shared/types.ts
    ▼
backend/ (Express + TypeScript + Prisma)
    ├── OCR adapter        → external OCR or MOCK_EXTRACTION
    ├── WhisperFlow adapter → transcription + correction parser
    ├── Vocabulary memory  → VocabularyMapping
    └── Normalisation service → NormalizationResponse or MOCK_NORMALIZATION
    ▼
PostgreSQL (fixed Prisma schema)
```

### 6.1 Backend Modules

- `src/index.ts` — Express bootstrap, CORS, JSON, route registration, health check.
- `src/mockData.ts` — canonical demo fixtures; never delete.
- OCR adapter — accepts an image, returns `BillExtractionResponse`; always wraps failures with fallback.
- WhisperFlow adapter — accepts transcript or audio, returns corrections + updated `BillExtractionResponse`.
- Vocabulary service — CRUD for `VocabularyMapping`, deterministic application.
- Normalisation service — returns `NormalizationResponse`; fixed mapping to the four core tables.
- Job tracking — `ProcessingJob` rows describe stage/status; failures are recorded, not thrown to the client as blank states.

### 6.2 Fixed Database Schema

The runtime schema is exactly `backend/prisma/schema.prisma`:

- `Business`
- `Customer`
- `Product`
- `Bill`
- `BillItem`
- `VocabularyMapping`
- `Correction`
- `ProcessingJob`

Uploaded files must never trigger DDL or `prisma migrate` at runtime. Schema changes happen only through reviewed development migrations.

## 7. API Surface (baseline)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/health` | Liveness check |
| GET | `/api/bills/:id` | Fetch bill extraction |
| GET | `/api/bills/:id/normalization` | Fetch normalisation graph |
| POST | `/api/bills/upload` | Upload bill image, run OCR pipeline |
| POST | `/api/bills/:id/corrections` | Apply manual or voice correction |
| POST | `/api/bills/:id/voice` | WhisperFlow transcription/correction |
| GET | `/api/bills/:id/readback` | Spoken read-back text |
| GET | `/api/vocabulary` | List vocabulary mappings |
| POST | `/api/vocabulary` | Confirm a vocabulary mapping |

All bill-shaped responses must validate against `BillExtractionResponse`. All normalisation responses must validate against `NormalizationResponse`.

## 8. Confidence and Review Rules

- `confidence` is a number from `0` to `1`.
- Default `reviewStatus` for machine-extracted values is `pending`.
- Values below the review threshold (default `0.80`) are visually flagged and must not be auto-confirmed.
- User-edited values become `corrected`; explicitly accepted values become `confirmed`.
- Totals are recomputed from line items only when the user confirms; a mismatch produces a warning and never silently overwrites the bill total.

## 9. Language Handling

- Supported bill languages: `en`, `hi`, `pa`.
- UI copy must be mobile-first and legible at small sizes.
- WhisperFlow should preserve the speaker's language in read-back.
- Transliteration and vernacular terms are handled by the vocabulary layer, not hard-coded per endpoint.

## 10. Resilience Requirements

1. Every external AI/OCR/voice call has a timeout and a fallback.
2. Fallbacks return valid contract objects, never empty screens or unhandled 500s.
3. `MOCK_EXTRACTION` and `MOCK_NORMALIZATION` must remain importable and unmodified in shape.
4. Failures are recorded as `ProcessingJob.errorMessage` where a bill exists.
5. Demo mode must work with no external API keys, using the fixtures.
6. Client-side rendering must not assume network success.

## 11. Mobile-First UI Requirements

- Layouts designed for 360–430 px widths first, then scaled up.
- Minimum touch target 44×44 px.
- No hover-only interactions; every action has a tap equivalent.
- Camera capture and microphone permissions are requested only on user action.
- 3D canvas supports touch orbit/pan/zoom and pauses animation when off-screen.
- Low-confidence fields are highlighted with both colour and text/icon (not colour alone).

## 12. Security and Data Handling

- Uploaded images are stored outside the repository (`uploads/` is git-ignored).
- Secrets (`DATABASE_URL`, provider keys) live in `.env`; never committed.
- No bill image or transcript is sent to third parties without explicit configuration.
- Correction records preserve an audit trail of original and corrected values.

## 13. Definition of Done

- Shared contracts compile across frontend and backend.
- OCR, voice, and normalisation paths all have verified fallbacks.
- Mobile UI is usable at 360 px width.
- `npm run build` succeeds in `backend/` and `frontend/`.
- No runtime DDL or dynamic migrations exist.
- Conventional commits are pushed to `feature/ocr-whisperflow`.
