/**
 * ============================================
 * LOGGER PROFESIONAL - SISTEMA DE REGISTRO
 * ============================================
 * 
 * Este es el sistema de "caja negra" de la aplicación.
 * Registra TODO lo que pasa, como las cámaras de seguridad.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Definir formatos
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

// Configurar niveles de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Configurar colores (para consola)
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};
winston.addColors(colors);

// Crear el logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: customFormat,
  defaultMeta: { service: 'culqi-backend' },
  transports: [
    // Console transport (solo en desarrollo)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      silent: process.env.NODE_ENV === 'test',
    }),
    
    // File transport para todos los logs
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File transport solo para errores
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File transport solo para HTTP requests
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      level: 'http',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  
  // No salir en excepciones manejadas
  exitOnError: false,
});

// Logger para HTTP requests (usado por Morgan)
logger.httpStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Métodos de utilidad
logger.payment = (paymentId, message, meta = {}) => {
  logger.info(`[PAYMENT:${paymentId}] ${message}`, {
    ...meta,
    payment_id: paymentId,
  });
};

logger.api = (endpoint, message, meta = {}) => {
  logger.info(`[API:${endpoint}] ${message}`, {
    ...meta,
    endpoint,
  });
};

logger.errorWithContext = (context, error, meta = {}) => {
  logger.error(`[${context}] ${error.message}`, {
    ...meta,
    error: error.toString(),
    stack: error.stack,
  });
};

module.exports = logger;