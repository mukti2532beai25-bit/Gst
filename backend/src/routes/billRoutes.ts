import { Router } from 'express';
import * as billController from '../controllers/billController';
import { uploadBillImage } from '../middleware/upload';
import { asyncHandler } from '../utils/http';

export const billRouter = Router();

billRouter.post('/upload', uploadBillImage, asyncHandler(billController.uploadBill));
billRouter.get('/:id/normalization', asyncHandler(billController.getNormalization));
billRouter.get('/:id/export', asyncHandler(billController.exportBill));
billRouter.post('/:id/confirm', asyncHandler(billController.confirmBill));
billRouter.get('/:id', asyncHandler(billController.getBill));
billRouter.patch('/:id', asyncHandler(billController.updateBill));
