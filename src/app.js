/**
 * ============================================
 * APP.JS - EL CEREBRO DE LA APLICACIÓN
 * ============================================
 * 
 * Aquí se configura TODO el sistema.
 * Es como el panel de control de una nave espacial.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Importar utilidades
const logger = require('./core/utils/logger');

// Importar middleware personalizado
const errorHandler = require('./api/middleware/errorHandler');
const requestLogger = require('./api/middleware/requestLogger');

// Importar rutas
const paymentRoutes = require('./api/v1/payments/routes');
const healthRoutes = require('./api/v1/health/routes');

// 1. Crear la aplicación Express
const app = express();

// ============================================
// 2. MIDDLEWARES (EN ORDEN CORRECTO)
// ============================================

// A. SEGURIDAD - Helmet (protección de headers)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
}));

// B. CORS - Control de acceso entre dominios
const corsOptions = {
  origin: function (origin, callback) {
    // EN DESARROLLO: Permitir estos orígenes locales
    if (process.env.NODE_ENV === 'development') {
      const allowedDevOrigins = [
        'http://127.0.0.1:5502',     // Tu Live Server actual
        'http://localhost:5502',     // Alternativa
        'http://localhost:3000',     // Por si pruebas directo
        'http://localhost:3001',     // Otro puerto común
        'https://goldinfiniti.com',  // Tu dominio en desarrollo
        'https://www.goldinfiniti.com',
      ];
      
      if (!origin || allowedDevOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // EN PRODUCCIÓN: Solo tu dominio real
    const allowedProdOrigins = [
      'https://goldinfiniti.com',      // TU DOMINIO
      'https://www.goldinfiniti.com',  // TU DOMINIO con www
    ];
    
    if (!origin || allowedProdOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚨 CORS bloqueado para origen:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Session-ID',
    'X-Device-Fingerprint',
  ],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 horas
};

app.use(cors(corsOptions));

// Preflight requests
app.options('*', cors(corsOptions));

// C. BODY PARSING - Parsear JSON y URL encoded
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    // Guardar el body original para verificación de webhooks
    req.rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 100,
}));

// D. COMPRESSION - Comprimir respuestas
app.use(compression({
  level: 6,
  threshold: 100 * 1024, // Comprimir solo sobre 100KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// E. RATE LIMITING - Limitar peticiones por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite por IP
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// F. REQUEST ID - Para trazabilidad
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || 
           `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// G. MORGAN - Logging HTTP
const morganFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'combined';
app.use(morgan(morganFormat, { 
  stream: logger.httpStream,
  skip: (req) => req.path === '/health' // No loggear health checks
}));

// H. MIDDLEWARE PERSONALIZADO - Request logger
app.use(requestLogger);

// I. RESPONSE TIME MIDDLEWARE - Medir tiempo de respuesta
app.use((req, res, next) => {
  const start = Date.now();
  
  // Interceptar el método 'end' para medir tiempo
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    
    // Solo agregar header si no ha sido enviado
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    
    // Log solo si es lento (> 1 segundo)
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Llamar al original
    originalEnd.apply(res, args);
  };
  
  next();
});

// ============================================
// 3. RUTAS (ÓRGANOS DEL SISTEMA)
// ============================================

// A. HEALTH CHECKS - El latido del corazón
app.use('/health', healthRoutes);

// B. PAYMENTS API - El sistema circulatorio de pagos
app.use('/api/v1/payments', paymentRoutes);

// C. RUTA RAÍZ - Información del API
app.get('/', (req, res) => {
  res.json({
    service: 'Culqi Payment Processor',
    version: '1.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    documentation: 'https://docs.tudominio.com',
    endpoints: {
      health: '/health',
      payments: {
        base: '/api/v1/payments',
        process: '/api/v1/payments',
        stats: '/api/v1/payments/stats',
        verify: '/api/v1/payments/verify/:paymentId',
        methods: '/api/v1/payments/methods',
        webhook: '/api/v1/payments/webhook'
      },
      docs: '/api-docs',
    },
    limits: {
      rate_limit: '100 requests per 15 minutes',
      payment_rate_limit: '10 requests per minute',
    },
  });
});

// ============================================
// 4. MANEJO DE ERRORES (SISTEMA DE REPARACIÓN)
// ============================================

// A. 404 HANDLER - Ruta no encontrada
app.use('*', (req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      suggestions: [
        'Check the URL for typos',
        'Verify the HTTP method (GET, POST, etc.)',
        'Consult the API documentation at /',
      ],
      available_endpoints: [
        'GET    /',
        'GET    /health',
        'POST   /api/v1/payments',
        'GET    /api/v1/payments/stats',
        'GET    /api/v1/payments/methods',
        'POST   /api/v1/payments/webhook',
        'GET    /api/v1/payments/verify/:paymentId'
      ]
    },
    timestamp: new Date().toISOString(),
  });
});

// B. ERROR HANDLER FINAL - Capturar todos los errores
app.use(errorHandler);

// ============================================
// 5. INFORMACIÓN DE DIAGNÓSTICO (SOLO DESARROLLO)
// ============================================

if (process.env.NODE_ENV === 'development') {
  // Mostrar rutas disponibles al iniciar
  app.on('mount', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 APP.JS CONFIGURADO CORRECTAMENTE');
    console.log('='.repeat(60));
    console.log('📁 Rutas montadas:');
    console.log('   - GET    /health');
    console.log('   - POST   /api/v1/payments');
    console.log('   - GET    /api/v1/payments/stats');
    console.log('   - GET    /api/v1/payments/methods');
    console.log('   - POST   /api/v1/payments/webhook');
    console.log('   - GET    /api/v1/payments/verify/:paymentId');
    console.log('='.repeat(60) + '\n');
  });
}

// Exportar la aplicación
module.exports = app;