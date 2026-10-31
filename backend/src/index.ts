import express from 'express';
import cors from 'cors';
import { MOCK_EXTRACTION, MOCK_NORMALIZATION } from './mockData';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BahiVerse Backend' });
});

app.get('/api/bills/:id', (req, res) => {
  res.json(MOCK_EXTRACTION);
});

app.get('/api/bills/:id/normalization', (req, res) => {
  res.json(MOCK_NORMALIZATION);
});

app.listen(PORT, () => {
  console.log(`BahiVerse API listening on port ${PORT}`);
});
