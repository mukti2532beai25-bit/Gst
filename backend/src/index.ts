import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getBill } from './store';
import { extractBill, BillLanguage } from './services/ocr';
import { applyVoiceCorrection, buildReadBack } from './services/whisperflow';
import { applyManualCorrection } from './services/corrections';
import { addVocabulary, listVocabulary } from './services/vocabulary';
import { getNormalization } from './services/normalization';

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
