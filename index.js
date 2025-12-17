/**
 * ============================================================
 * INDEX.JS - PUNTO DE ENTRADA DE LA APP
 * ============================================================
 */

'use strict';

require('dotenv').config(); // Carga variables de entorno desde .env
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./src/core/utils/logger');

// Importar PaymentController
const paymentController = require('./src/api/v1/payments/controller');

// Crear app
const app = express();

// ============================================================
// CONFIGURACIÓN DE CORS - DEBE IR PRIMERO
// ============================================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080', 
  'http://localhost:5173',
  'https://localhost:3000',
  'https://goldinfiniti.web.app',
  'https://goldinfiniti.firebaseapp.com',
  'https://www.goldinfiniti.com',
  'https://goldinfiniti.com'
];

// Configuración detallada de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Verificar si el origen está permitido
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ Origen permitido: ${origin}`);
      return callback(null, true);
    } else {
      console.log(`🚫 Origen bloqueado: ${origin}`);
      return callback(new Error('Origen no permitido por CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin',
    'x-api-key',
    'x-request-id'
  ],
  exposedHeaders: [
    'Content-Length',
    'ETag',
    'X-Request-Id'
  ],
  credentials: true,
  maxAge: 86400, // 24 horas
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Aplicar CORS - ESTO ES CLAVE
app.use(cors(corsOptions));

// ============================================================
// MIDDLEWARE PERSONALIZADO CORS (FALLBACK)
// ============================================================
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Solo establecer header si el origen está en la lista permitida
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // Headers CORS estándar
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, x-api-key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin'); // IMPORTANTE para caché
  
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ============================================================
// HELMET CONFIGURADO PARA CORS
// ============================================================
app.use(helmet({
  // Deshabilitar políticas que bloquean CORS
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  
  // CSP configurado para permitir tus dominios
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://goldinfiniti.web.app",
        "https://goldinfiniti.firebaseapp.com",
        "https://www.goldinfiniti.com",
        "https://goldinfiniti.com",
        "ws://localhost:*",
        "http://localhost:*"
      ],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));

// ============================================================
// MIDDLEWARES RESTANTES
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging HTTP
const morganFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'combined';
app.use(morgan(morganFormat, { stream: logger.httpStream }));

// ============================================================
// RUTAS
// ============================================================

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    service: 'Culqi Payment Processor',
    version: '1.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV,
    cors: {
      enabled: true,
      allowedOrigins: allowedOrigins,
      currentOrigin: req.headers.origin || 'none'
    },
    timestamp: new Date().toISOString(),
    endpoints: {
      payments: '/api/v1/payments',
      health: '/health',
      corsTest: '/api/cors-test'
    },
  });
});

// Rutas de pagos
app.post('/api/v1/payments', paymentController.processPayment);
app.get('/api/v1/payments/stats', paymentController.getStats);
app.get('/api/v1/payments/:paymentId/verify', paymentController.verifyPayment);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    cors: {
      origin: req.headers.origin || 'no-origin',
      allowed: allowedOrigins.includes(req.headers.origin || '')
    },
    timestamp: new Date().toISOString(),
  });
});

// Ruta específica para test de CORS
app.get('/api/cors-test', (req, res) => {
  res.json({
    test: 'CORS Configuration',
    yourOrigin: req.headers.origin || 'No Origin header',
    allowed: allowedOrigins.includes(req.headers.origin || ''),
    allowedOrigins: allowedOrigins,
    timestamp: new Date().toISOString(),
    headers: {
      'Access-Control-Allow-Origin': req.headers.origin || 'not-set',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
});

// ============================================================
// ENDPOINT DE PRUEBA DE EMAIL
// ============================================================
app.post('/api/email/test', async (req, res) => {
  try {
    const path = require('path');
    const emailService = require(path.join(__dirname, 'src/services/payment/emailService'));
    
    // 1. Verificar servicio
    console.log('🔍 Verificando servicio de email...');
    const serviceInfo = await emailService.verifyService();
    
    // 2. Probar envío de correo
    const { to = "tuemail@gmail.com", testType = "comprobante" } = req.body;
    
    let result;
    
    if (testType === "comprobante") {
      // Probar envío de comprobante
      result = await emailService.enviarCorreoComprobante(to, [
        { nombre: "Camiseta Premium", cantidad: 2, precio: 89.90 },
        { nombre: "Pantalón Jeans", cantidad: 1, precio: 129.90 },
        { nombre: "Zapatos de Cuero", cantidad: 1, precio: 199.90 }
      ], "boleta");
    } 
    else if (testType === "confirmation") {
      // Probar confirmación de pago
      result = await emailService.sendPaymentConfirmation({
        id: "test_" + Date.now(),
        amount: 50970, // 509.70 soles en centavos
        currency: "PEN",
        customer_email: to,
        description: "Compra de prueba - Golden Infinity",
        status: "succeeded",
        created_at: Math.floor(Date.now() / 1000),
        metadata: {
          items: JSON.stringify([
            { nombre: "Producto Test 1", cantidad: 1, precio: 299.90 },
            { nombre: "Producto Test 2", cantidad: 2, precio: 89.90 }
          ])
        }
      });
    }
    else if (testType === "notification") {
      // Probar notificación administrativa
      result = await emailService.sendPaymentNotification({
        id: "test_" + Date.now(),
        amount: 50970,
        currency: "PEN",
        customer_email: to,
        status: "succeeded",
        created_at: Math.floor(Date.now() / 1000),
        description: "Compra de prueba",
        source: { type: "card", object: "card" }
      });
    }
    
    // 3. Responder
    res.json({
      success: true,
      message: "Prueba de email completada",
      testType: testType,
      recipient: to,
      serviceInfo: serviceInfo,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en prueba de email:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// LEVANTAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`🚀 Servidor corriendo en ${HOST}:${PORT} [${process.env.NODE_ENV}]`);
  console.log(`=========================================`);
  console.log(`🌐 BACKEND CULQI - CORS CONFIGURADO`);
  console.log(`=========================================`);
  console.log(`📍 Local:  http://localhost:${PORT}`);
  console.log(`📍 Red:    http://${HOST}:${PORT}`);
  console.log(`📍 Puerto: ${PORT}`);
  console.log(``);
  console.log(`✅ CORS CONFIGURADO PARA:`);
  allowedOrigins.forEach(origin => {
    console.log(`   • ${origin}`);
  });
  console.log(``);
  console.log(`🔍 PRUEBAS DE CORS:`);
  console.log(`   curl -X OPTIONS http://localhost:${PORT}/api/cors-test \\`);
  console.log(`        -H "Origin: https://goldinfiniti.web.app" \\`);
  console.log(`        -H "Access-Control-Request-Method: GET" \\`);
  console.log(`        -v`);
  console.log(``);
  console.log(`📊 VERIFICAR:`);
  console.log(`   http://localhost:${PORT}/api/cors-test`);
  console.log(`=========================================`);
});

module.exports = app;