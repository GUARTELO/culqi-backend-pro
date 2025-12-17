/**
 * Middleware centralizado para manejo de errores
 */

const logger = require('../../core/utils/logger');

const errorHandler = (err, req, res, next) => {
  // Loggear el error
  logger.errorWithContext('ERROR_HANDLER', err, {
    requestId: req.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  // Determinar el tipo de error
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An internal server error occurred';
  let details = null;
  
  // Error de validación de Joi
  if (err.isJoi) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));
  }
  
  // Error de autenticación
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'AUTHENTICATION_ERROR';
    message = 'Invalid or expired token';
  }
  
  // Error de rate limiting
  if (err.statusCode === 429) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = err.message;
  }
  
  // Error de Culqi
  if (err.culqiError) {
    statusCode = err.statusCode || 400;
    errorCode = err.errorCode || 'PAYMENT_ERROR';
    message = err.message || 'Payment processing failed';
    details = err.details;
  }
  
  // Construir respuesta de error
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    },
  };
  
  // Solo incluir detalles en desarrollo
  if (details && process.env.NODE_ENV === 'development') {
    errorResponse.error.details = details;
  }
  
  // Solo incluir stack trace en desarrollo
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }
  
  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;