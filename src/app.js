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
const xss = require('xss'); // ✅ NUEVO: Sanitización XSS (versión moderna)

// Importar utilidades
const logger = require('./core/utils/logger');

// Importar middleware personalizado
const errorHandler = require('./api/middleware/errorHandler');
const requestLogger = require('./api/middleware/requestLogger');

// Importar rutas
const paymentRoutes = require('./api/v1/payments/routes');
const healthRoutes = require('./api/v1/health/routes');

// ✅ IMPORTAR EL CONTROLLER DE PAGOS (CORRECCIÓN)
const paymentController = require('./api/v1/payments/controller');

// 1. Crear la aplicación Express
const app = express();

// ============================================
// 1.5 CONFIGURACIÓN DE TRUST PROXY
// ============================================

// ✅ Configuración segura para producción
if (process.env.NODE_ENV === 'production') {
    // Render.com usa 1 nivel de proxy (Cloudflare → Render)
    app.set('trust proxy', 1);
    
    // Log para confirmar en producción
    console.log('🔒 Modo producción: Trust proxy activado (1 nivel)');
    
    // Middleware para monitorear HTTPS
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
            console.log(`⚠️ Petición HTTP detectada: ${req.method} ${req.url}`);
        }
        next();
    });
} else {
    // Desarrollo local - sin cambios
    console.log('🔧 Modo desarrollo: Trust proxy desactivado (IPs locales)');
}

// ============================================
// 1.6 HTTPS FORZADO (NUEVO - OBLIGATORIO)
// ============================================

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        // Verificar si la conexión es HTTPS
        const isHttps = req.headers['x-forwarded-proto'] === 'https';
        const isLocalRequest = req.headers.host === 'localhost' || req.headers.host === '127.0.0.1';
        
        if (!isHttps && !isLocalRequest) {
            // Construir URL HTTPS
            const httpsUrl = `https://${req.headers.host}${req.url}`;
            
            // Log para monitoreo
            console.log(`🔒 Redirigiendo HTTP a HTTPS: ${req.method} ${req.url}`);
            
            // Redirigir permanentemente (301)
            return res.redirect(301, httpsUrl);
        }
        
        next();
    });
    console.log('🔒 HTTPS forzado: Activado');
}

// ============================================
// 1.7 XSS SANITIZATION (NUEVO - RECOMENDADO)
// ============================================

// Middleware para sanitizar entradas contra XSS
app.use((req, res, next) => {
    if (req.body) {
        // Sanitizar cada campo del body
        const sanitizeObject = (obj) => {
            if (!obj) return obj;
            if (typeof obj === 'string') {
                return xss(obj); // Limpia strings
            }
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizeObject(item));
            }
            if (typeof obj === 'object') {
                const sanitized = {};
                for (const [key, value] of Object.entries(obj)) {
                    sanitized[key] = sanitizeObject(value);
                }
                return sanitized;
            }
            return obj;
        };
        
        req.body = sanitizeObject(req.body);
    }
    next();
});
console.log('🧹 XSS sanitization: Activado (xss moderno)');

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

// B. CORS - Configuración para PRODUCCIÓN
const corsOptions = {
  origin: function (origin, callback) {
    // EN PRODUCCIÓN: Permitir estos orígenes
    const allowedOrigins = [
      'https://goldinfiniti.com',      // TU DOMINIO
      'https://www.goldinfiniti.com',  // TU DOMINIO con www
      'http://127.0.0.1:5502',
      'http://localhost:5502',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'file://',
      'null',
      undefined,
    ];
    
    if (allowedOrigins.includes(origin) || !origin) {
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
  maxAge: 86400,
};

app.use(cors(corsOptions));
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
  threshold: 100 * 1024,
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
  skip: (req) => req.path === '/health'
}));

// H. MIDDLEWARE PERSONALIZADO - Request logger
app.use(requestLogger);

// I. RESPONSE TIME MIDDLEWARE - Medir tiempo de respuesta
app.use((req, res, next) => {
  const start = Date.now();
  
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
    
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

// C. ✅ RECLAMOS API - Sistema INDEPENDIENTE para libro de reclamaciones
app.post('/api/v1/reclamos', paymentController.processClaim);

// D. RUTA RAÍZ - Información del API
app.get('/', (req, res) => {
  res.json({
    service: 'Culqi Payment Processor + Libro de Reclamaciones INDECOPI',
    version: (() => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        const versionPath = path.join(process.cwd(), 'src/config/version.json');
        
        if (fs.existsSync(versionPath)) {
          const rawData = fs.readFileSync(versionPath, 'utf8');
          const autoVersion = JSON.parse(rawData);
          return autoVersion.version;
        }
        
        throw new Error('version.json no encontrado');
        
      } catch (e) {
        try {
          const packageJson = require('./package.json');
          return packageJson.version;
        } catch (e2) {
          return '2.0.0';
        }
      }
    })(),
    status: 'operational',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    documentation: 'https://docs.tudominio.com',
    security: {
      https_forced: process.env.NODE_ENV === 'production',
      trust_proxy: true,
      xss_protection: true,
      rate_limiting: true,
    },
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
      reclamos: '/api/v1/reclamos',
      docs: '/api-docs',
    },
    limits: {
      rate_limit: '100 requests per 15 minutes',
      payment_rate_limit: '10 requests per minute',
    },
    features: [
      'Procesamiento de pagos con Culqi',
      'Libro de Reclamaciones INDECOPI digital',
      'Firebase en tiempo real',
      'Emails automáticos con SendGrid/Gmail'
    ]
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
        'POST   /api/v1/reclamos',
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
  app.on('mount', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 APP.JS CONFIGURADO CORRECTAMENTE');
    console.log('='.repeat(60));
    console.log('📁 Rutas montadas:');
    console.log('   - GET    /health');
    console.log('   - POST   /api/v1/payments');
    console.log('   - POST   /api/v1/reclamos');
    console.log('   - GET    /api/v1/payments/stats');
    console.log('   - GET    /api/v1/payments/methods');
    console.log('   - POST   /api/v1/payments/webhook');
    console.log('   - GET    /api/v1/payments/verify/:paymentId');
    console.log('='.repeat(60) + '\n');
  });
}

// Exportar la aplicación
module.exports = app;