import type { Request, Response } from 'express';
import * as vocabularyService from '../services/vocabularyService';

export async function getVocabulary(req: Request, res: Response): Promise<void> {
  const businessId = req.params.id;
  const vocabulary = await vocabularyService.getVocabulary(businessId);
  res.json({ businessId, vocabulary });
}

export async function createVocabulary(req: Request, res: Response): Promise<void> {
  const businessId = req.params.id;
  const mapping = await vocabularyService.addVocabulary(businessId, req.body);
  res.status(201).json(mapping);
}
