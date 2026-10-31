import type { Request, Response } from 'express';
import { pickUploadedFile } from '../middleware/upload';
import * as billService from '../services/billService';
import { HttpError } from '../utils/http';
import { asRecord, parseFormat } from '../utils/validation';

export async function uploadBill(req: Request, res: Response): Promise<void> {
  const file = pickUploadedFile(req);
  if (!file) {
    throw new HttpError(400, "No bill image uploaded. Use multipart field 'image'.");
  }

  const imageUrl = `/uploads/${file.filename}`;
  const body = asRecord(req.body ?? {}, 'body');
  const bill = await billService.createUploadedBill({ imageUrl, body });

  res.status(201).json({
    billId: bill.id,
    imageUrl: bill.sourceImageUrl ?? imageUrl
  });
}

export async function getBill(req: Request, res: Response): Promise<void> {
  const bill = await billService.getBillResponse(req.params.id);
  res.json(bill);
}

export async function updateBill(req: Request, res: Response): Promise<void> {
  const bill = await billService.patchBill(req.params.id, req.body);
  res.json(bill);
}

export async function confirmBill(req: Request, res: Response): Promise<void> {
  const bill = await billService.confirmBill(req.params.id);
  res.json(bill);
}

export async function getNormalization(req: Request, res: Response): Promise<void> {
  const normalization = await billService.getNormalization(req.params.id);
  res.json(normalization);
}

export async function exportBill(req: Request, res: Response): Promise<void> {
  const format = parseFormat(req.query.format);
  const result = await billService.exportBill(req.params.id, format);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.status(200).send(result.content);
}
