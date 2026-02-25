import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types/api-response';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta
): void {
  const response: ApiResponse<T> = { success: true, data, message };
  if (meta) response.meta = meta;
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  data: any = null
): void {
  res.status(statusCode).json({ success: false, data, message });
}
