#!/usr/bin/env node

/**
 * ============================================
 * SERVER.JS - ENTRY POINT PROFESIONAL
 * ============================================
 */

// 1. Cargar variables de entorno SOLO en local
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 2. Imports principales
const app = require('./src/app');
const logger = require('./src/core/utils/logger');

// 3. Configuración de red
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 4. Referencia del servidor (IMPORTANTE)
let server;

// 5. Arranque del servidor
server = app.listen(PORT, HOST, () => {
  logger.info('🚀 Backend Culqi iniciado correctamente', {
    service: 'culqi-backend',
    environment: process.env.NODE_ENV,
    host: HOST,
    port: PORT,
    node: process.version,
    timestamp: new Date().toISOString()
  });
});

// 6. Optimización para cloud / load balancers
server.keepAliveTimeout = 65 * 1000; // 65s
server.headersTimeout = 70 * 1000;   // 70s

// 7. Apagado elegante (SIGTERM / SIGINT)
const gracefulShutdown = (signal) => {
  logger.info(`${signal} recibido. Cerrando servidor...`);

  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forzando cierre del proceso');
    process.exit(1);
  }, 10000);
};

// 8. Señales del sistema
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // nodemon / pm2

// 9. Manejo de errores críticos
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });

  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// 10. Export para testing
module.exports = server;