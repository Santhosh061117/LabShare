import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('[Error]', req.method, req.path, err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = typeof err.status === 'number' ? err.status : 500;
  const message = err.message || 'An unexpected server error occurred.';

  res.status(statusCode).json({
    error: message,
    success: false
  });
}
