export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'The requested resource was not found.'
    }
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.statusCode || error.status || 500;
  const message = status >= 500 ? 'Unexpected server error.' : error.message;

  if (status >= 500) {
    req.app.locals.logger?.error?.({ requestId: req.id, error });
  }

  return res.status(status).json({
    error: {
      code: error.code || 'internal_error',
      message,
      ...(error.details ? { details: error.details } : {})
    }
  });
}
