// src/api/v1/payments/routes.js
/**

* ======================================================
* PAYMENTS ROUTER - API V1
* ======================================================
*
* Este archivo define TODAS las rutas HTTP relacionadas
* al módulo de pagos.
*
* RESPONSABILIDAD:
* * Definir endpoints
* * Encadenar middlewares
* * Delegar lógica al controller
*
* NO debe contener lógica de negocio.
  */

'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });

// =========================
// DEPENDENCIAS PRINCIPALES
// =========================

const paymentController = require('./controller');

// =========================
// MIDDLEWARES (OPCIONALES)
// =========================

// Estos middlewares se dejan preparados para producción
// Se activan cuando los tengas implementados

// const authenticate = require('../../../middleware/authenticate');
// const authorize = require('../../../middleware/authorize');
// const validatePayment = require('../../../validators/payment.validator');
// const rateLimiter = require('../../../middleware/rateLimiter');
// const requestId = require('../../../middleware/requestId');
// const sanitize = require('../../../middleware/sanitize');

// =========================
// MIDDLEWARE GLOBAL DEL ROUTER
// =========================

// router.use(requestId);
// router.use(sanitize);

// ======================================================
// RUTA PRINCIPAL: PROCESAR PAGO
// ======================================================

/**

* @route   POST /api/v1/payments/process
* @desc    Procesa un pago con Culqi
* @access  Public / Private (según configuración)
* @body    {
* ```
         token,
  ```
* ```
         amount,
  ```
* ```
         currency_code,
  ```
* ```
         email,
  ```
* ```
         description,
  ```
* ```
         metadata
  ```
* ```
       }
  ```

*/
// AGREGAR ESTO justo después de la línea 56:

// Ruta principal para compatibilidad
router.post('/', paymentController.processPayment);

// También mantener la ruta con /process para futuras versiones
router.post('/process', paymentController.processPayment);

// ======================================================
// ESTADÍSTICAS DE PAGOS
// ======================================================

/**

* @route   GET /api/v1/payments/stats
* @desc    Retorna estadísticas internas del módulo
* @access  Private (Admin)
  */
  router.get(
  '/stats',
  // authenticate,
  // authorize('admin'),
  paymentController.getStats
  );

// ======================================================
// VERIFICAR ESTADO DE UN PAGO
// ======================================================

/**

* @route   GET /api/v1/payments/verify/:paymentId
* @desc    Verifica el estado de un pago específico
* @access  Public / Private
  */
  router.get(
  '/verify/:paymentId',
  // authenticate,
  paymentController.verifyPayment
  );

// ======================================================
// HEALTH CHECK DEL SERVICIO
// ======================================================

/**

* @route   GET /api/v1/payments/health
* @desc    Verifica la salud del microservicio de pagos
* @access  Public
  */
  router.get('/health', (req, res) => {
  res.status(200).json({
  success: true,
  service: 'payments-api',
  status: 'operational',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV,
  memory: process.memoryUsage(),
  });
  });

// ======================================================
// MÉTODOS DE PAGO DISPONIBLES
// ======================================================

/**

* @route   GET /api/v1/payments/methods
* @desc    Lista métodos de pago soportados
* @access  Public
  */
  router.get('/methods', (req, res) => {
  res.status(200).json({
  success: true,
  methods: [
  {
  type: 'card',
  provider: 'culqi',
  brands: ['Visa', 'Mastercard', 'American Express', 'Diners Club'],
  currencies: ['PEN', 'USD'],
  limits: {
  min_amount: 1.0,
  max_amount: Number(process.env.MAX_PAYMENT_AMOUNT) || 500000,
  },
  supports_recurring: false,
  supports_refunds: true,
  },
  ],
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV,
  });
  });

// ======================================================
// WEBHOOK CULQI
// ======================================================

/**

* @route   POST /api/v1/payments/webhook
* @desc    Endpoint para eventos enviados por Culqi
* @access  Public (verificar firma en producción)
  */
  router.post('/webhook', async (req, res) => {
  try {
  const eventType = req.body?.type || 'unknown';

  // TODO:
  // - Verificar firma (x-culqi-signature)
  // - Validar payload
  // - Persistir evento

  console.log('[CULQI WEBHOOK]', eventType);

  res.status(200).json({
  received: true,
  processed: false,
  event: eventType,
  timestamp: new Date().toISOString(),
  });
  } catch (error) {
  res.status(200).json({
  received: true,
  processed: false,
  error: error.message,
  });
  }
  });

// ======================================================
// ENDPOINT DE PRUEBA (SOLO DESARROLLO)
// ======================================================

if (process.env.NODE_ENV === 'development') {
router.get('/test', (req, res) => {
res.status(200).json({
success: true,
message: 'Payment API operativa',
available_endpoints: [
'POST   /api/v1/payments/process',
'GET    /api/v1/payments/stats',
'GET    /api/v1/payments/verify/:paymentId',
'GET    /api/v1/payments/health',
'GET    /api/v1/payments/methods',
],
controller_methods: Object.keys(paymentController).filter(
(key) => typeof paymentController[key] === 'function'
),
timestamp: new Date().toISOString(),
});
});
}

// ======================================================
// EXPORT
// ======================================================

module.exports = router;
