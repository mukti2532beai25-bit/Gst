import { Router } from 'express';
import * as businessController from '../controllers/businessController';
import { asyncHandler } from '../utils/http';

export const businessRouter = Router();

businessRouter.get('/:id/vocabulary', asyncHandler(businessController.getVocabulary));
businessRouter.post('/:id/vocabulary', asyncHandler(businessController.createVocabulary));
