/**
 * Middleware para logging detallado de requests
 */

const logger = require('../../core/utils/logger');

const requestLogger = (req, res, next) => {
  // Solo loggear en desarrollo o si es una request importante
  const shouldLog = process.env.NODE_ENV === 'development' || 
                   req.path.includes('/api/v1/payments');
  
  if (shouldLog) {
    const startTime = Date.now();
    
    // Interceptar el método end de response
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - startTime;
      
      // Datos sensibles que no debemos loggear
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.token) sanitizedBody.token = '***REDACTED***';
      if (sanitizedBody.cvv) sanitizedBody.cvv = '***REDACTED***';
      if (sanitizedBody.card_number) sanitizedBody.card_number = '***REDACTED***';
      
      logger.http(`Request completed`, {
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        body: Object.keys(sanitizedBody).length > 0 ? sanitizedBody : undefined,
      });
      
      // Llamar al original
      originalEnd.apply(res, args);
    };
  }
  
  next();
};

module.exports = requestLogger;