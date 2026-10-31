import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getBill } from './store';
import { extractBill, BillLanguage } from './services/ocr';
import { applyVoiceCorrection, buildReadBack } from './services/whisperflow';
import { applyManualCorrection } from './services/corrections';
import { addVocabulary, listVocabulary } from './services/vocabulary';
import { getNormalization } from './services/normalization';
import {
  isSupportedAudioFile,
  transcribeAudio
} from './services/transcription';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const PORT = process.env.PORT || 5000;

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseLanguage(value: unknown): BillLanguage | undefined {
  return value === 'en' || value === 'hi' || value === 'pa' ? value : undefined;
}

function firstUploadedFile(req: express.Request): Express.Multer.File | undefined {
  if (!Array.isArray(req.files)) return undefined;
  return req.files[0];
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BahiVerse Backend' });
});

app.get('/api/bills/:id', (req, res) => {
  res.json(getBill(req.params.id));
});

app.get('/api/bills/:id/normalization', (req, res) => {
  res.json(getNormalization(req.params.id));
});

app.post('/api/bills/upload', upload.any(), async (req, res) => {
  const file = firstUploadedFile(req);
  const language = parseLanguage(req.body?.language);
  const billId = readString(req.body?.billId) ?? `bill-${Date.now()}`;

  const outcome = await extractBill(
    {
      image: file?.buffer,
      mimeType: file?.mimetype,
      language
    },
    billId
  );

  res.json(outcome.bill);
});

app.post('/api/bills/:id/corrections/voice', upload.any(), (req, res) => {
  const transcript =
    readString(req.body?.transcript) ?? readString(req.body?.text);
  const targetItemId = readString(req.body?.itemId);
  const bill = getBill(req.params.id);

  if (!transcript) {
    res.json({
      bill,
      corrections: [],
      readBack: buildReadBack(bill),
      warnings: [
        'No transcript supplied. Audio transcription is unavailable in demo mode; the bill is unchanged.'
      ]
    });
    return;
  }

  res.json(applyVoiceCorrection(transcript, bill, targetItemId));
});

/**
 * Fallback for mobile browsers that do not expose the Web Speech API. The
 * recording is sent to a Whisper-compatible endpoint when configured; otherwise
 * the filename or an explicit fallback transcript keeps the demo usable.
 */
app.post(
  '/api/bills/:id/corrections/voice-file',
  upload.any(),
  async (req, res, next) => {
    try {
      const file = firstUploadedFile(req);

      if (!file) {
        res.status(400).json({ error: 'Audio file is required.' });
        return;
      }

      if (!isSupportedAudioFile(file.originalname, file.mimetype)) {
        res.status(400).json({
          error: 'Unsupported audio format. Upload a .wav, .webm or .m4a file.'
        });
        return;
      }

      const bill = getBill(req.params.id);
      const outcome = await transcribeAudio({
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        language: parseLanguage(req.body?.language) ?? bill.language,
        fallbackTranscript:
          readString(req.body?.transcript) ??
          readString(req.body?.fallbackTranscript)
      });

      const result = applyVoiceCorrection(
        outcome.transcript,
        bill,
        readString(req.body?.itemId)
      );

      res.json({
        ...result,
        warnings: outcome.warning
          ? [outcome.warning, ...result.warnings]
          : result.warnings,
        transcript: outcome.transcript,
        transcriptionSource: outcome.source
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/bills/:id/corrections', (req, res) => {
  const bill = getBill(req.params.id);
  const result = applyManualCorrection(bill, {
    field: readString(req.body?.field),
    itemId: readString(req.body?.itemId),
    itemIndex:
      typeof req.body?.itemIndex === 'number' ? req.body.itemIndex : undefined,
    itemField: readString(req.body?.itemField),
    value: req.body?.value
  });

  if (!result.applied) {
    res.status(400).json({ ...result, error: result.warning ?? 'Correction rejected.' });
    return;
  }

  res.json(result);
});

app.get('/api/bills/:id/readback', (req, res) => {
  const bill = getBill(req.params.id);
  const language = parseLanguage(req.query.language) ?? bill.language;
  res.json({ language, text: buildReadBack(bill, language) });
});

app.get('/api/vocabulary', (req, res) => {
  res.json(listVocabulary());
});

app.post('/api/vocabulary', (req, res) => {
  const spokenOrWrittenTerm = readString(req.body?.spokenOrWrittenTerm);
  const canonicalValue = readString(req.body?.canonicalValue);
  const valueType = readString(req.body?.valueType);

  if (!spokenOrWrittenTerm || !canonicalValue || !valueType) {
    res.status(400).json({
      error: 'spokenOrWrittenTerm, canonicalValue and valueType are required.'
    });
    return;
  }

  res.status(201).json(
    addVocabulary({ spokenOrWrittenTerm, canonicalValue, valueType })
  );
});

// Final guard: never leak an HTML stack trace to the mobile client.
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Unexpected server error';
    res.status(500).json({ error: message });
  }
);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`BahiVerse API listening on port ${PORT}`);
  });
}

export default app;
