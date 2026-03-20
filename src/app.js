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

// ✅ IMPORTAR EL CONTROLLER DE PAGOS (CORRECCIÓN)
const paymentController = require('./api/v1/payments/controller');

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

// B. CORS - Configuración para PRODUCCIÓN
const corsOptions = {
  origin: function (origin, callback) {
    // EN PRODUCCIÓN: Permitir estos orígenes
    const allowedOrigins = [
      'https://goldinfiniti.com',      // TU DOMINIO
      'https://www.goldinfiniti.com',  // TU DOMINIO con www
      'http://127.0.0.1:5502',         // ← AÑADE ESTO
      'http://localhost:5502',         // ← AÑADE ESTO
      'http://localhost:3000',         // ← AÑADE ESTO
      'http://127.0.0.1:5500',         // ← AÑADE ESTA LÍNEA (puerto 5500)
      'http://localhost:5500',         // ← AÑADE ESTA LÍNEA (puerto 5500)
      'file://',                       // ← AÑADE ESTA LÍNEA (archivos locales)
      'null',                          // ← AÑADE ESTA LÍNEA (algunos navegadores)
      undefined,                       // Para peticiones sin origen
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

// C. ✅ RECLAMOS API - Sistema INDEPENDIENTE para libro de reclamaciones
app.post('/api/v1/reclamos', paymentController.processClaim);

// D. RUTA RAÍZ - Información del API
app.get('/', (req, res) => {
  res.json({
    service: 'Culqi Payment Processor + Libro de Reclamaciones INDECOPI',
    version: (() => {
      try {
        // MISMA LÓGICA QUE /health PERO CON RUTA CORRECTA
        // 1. Ruta absoluta que funciona en producción
        const fs = require('fs');
        const path = require('path');
        
        // ESTA es la ruta que realmente funciona (la misma que debería usar /health)
        const versionPath = path.join(process.cwd(), 'src/config/version.json');
        
        // Verificar si existe antes de requerir
        if (fs.existsSync(versionPath)) {
          const rawData = fs.readFileSync(versionPath, 'utf8');
          const autoVersion = JSON.parse(rawData);
          return autoVersion.version;
        }
        
        // Si no existe, lanzar error para ir al catch
        throw new Error('version.json no encontrado');
        
      } catch (e) {
        try {
          // 2. Si falla, usa package.json (EXACTAMENTE como /health)
          const packageJson = require('./package.json');
          return packageJson.version;
        } catch (e2) {
          // 3. Último recurso: valor por defecto (NO ROMPE NADA)
          return '2.0.0';
        }
      }
    })(),
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
  // Mostrar rutas disponibles al iniciar
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










// ============================================
// CARGAR TODOS LOS PRODUCTOS (RUTA CORREGIDA - VERSIÓN FINAL)
// ============================================
const path = require('path');
const fs = require('fs');

let TODOS_LOS_PRODUCTOS = [];

function cargarProductos() {
    try {
        // Ruta CORRECTA a tus archivos (según tu terminal)
        const frontendPath = 'C:/Users/Ciro/Desktop/GOLDINFINITI-STORE/PUBLIC/js';
        
        console.log('📁 Buscando productos en:', frontendPath);
        
        // Verificar que la carpeta existe
        if (!fs.existsSync(frontendPath)) {
            console.log('❌ La carpeta NO existe:', frontendPath);
            return;
        }
        
        const archivos = [
            'productos.js',
            'productos-mujer.js',
            'productos-hombre.js',
            'productos-ninos.js',
            'productos-colecciones.js',
            'productos-accesorios.js',
            'productos-ofertas.js'
        ];
        
        archivos.forEach(archivo => {
            try {
                const ruta = path.join(frontendPath, archivo);
                
                // Verificar que el archivo existe
                if (!fs.existsSync(ruta)) {
                    console.log(`⚠️ Archivo no encontrado: ${archivo}`);
                    return;
                }
                
                const contenido = fs.readFileSync(ruta, 'utf8');
                
                // Buscar el array de productos (versión mejorada)
                const match = contenido.match(/const\s+productos\w*\s*=\s*(\[[\s\S]*?\]);/);
                
                if (match && match[1]) {
                    // Reemplazar referencias a window que puedan causar error
                    let arrayStr = match[1].replace(/window\./g, 'globalThis.');
                    
                    // Evaluar SOLO el array (seguro porque son datos)
                    const productosArray = eval('(' + arrayStr + ')');
                    
                    if (Array.isArray(productosArray)) {
                        TODOS_LOS_PRODUCTOS = [...TODOS_LOS_PRODUCTOS, ...productosArray];
                        console.log(`✅ ${archivo}: ${productosArray.length} productos`);
                    }
                } else {
                    console.log(`⚠️ No se encontró array en ${archivo}`);
                }
            } catch (e) {
                console.log(`⚠️ Error en ${archivo}: ${e.message}`);
            }
        });
        
        console.log(`📦 TOTAL: ${TODOS_LOS_PRODUCTOS.length} productos cargados`);
        
        // Mostrar algunos slugs como ejemplo
        if (TODOS_LOS_PRODUCTOS.length > 0) {
            const slugs = TODOS_LOS_PRODUCTOS.map(p => p.slug).filter(Boolean).slice(0, 5);
            console.log('🔍 Ejemplo de slugs:', slugs);
        }
        
    } catch (error) {
        console.log('❌ Error general:', error.message);
    }
}

cargarProductos();
// ============================================
// RUTA PARA PRODUCTO INDIVIDUAL
// ============================================
app.get('/producto/:slug', (req, res) => {
    const slug = req.params.slug;
    const producto = TODOS_LOS_PRODUCTOS.find(p => p.slug === slug);
    
    if (!producto) {
        return res.status(404).send('Producto no encontrado');
    }
    
    // Schema para Google
    const schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": producto.titulo,
        "image": producto.imagenes[0],
        "description": producto.descripcion?.substring(0, 160) || '',
        "offers": {
            "@type": "Offer",
            "price": producto.precioActual,
            "priceCurrency": "PEN"
        }
    };
    
    // Generar estrellas
    const fullStars = Math.floor(producto.rating || 4.5);
    const halfStar = (producto.rating || 4.5) % 1 >= 0.5;
    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fas fa-star"></i>';
    if (halfStar) starsHtml += '<i class="fas fa-star-half-alt"></i>';
    for (let i = fullStars + (halfStar ? 1 : 0); i < 5; i++) starsHtml += '<i class="far fa-star"></i>';
    
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>${producto.titulo} - Goldinfiniti</title>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <!-- HEADER (copiado del de categorías) -->
    
    <h1>${producto.titulo}</h1>
    <img src="${producto.imagenes[0]}" width="300">
    <p>S/${producto.precioActual}</p>
    
    <!-- FOOTER (copiado del de categorías) -->
    
    <script src="/js/script.js"></script>
    <script>window.productoActualId = ${producto.id};</script>
</body>
</html>`);
});



// ============================================
// RUTAS PARA CATEGORÍAS (CON TODO COMPLETO)
// ============================================

// MUJER
app.get('/mujer', (req, res) => {
    const productosMujer = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'mujer' || [1,4,5].includes(p.id)
    );
    generarPaginaCategoriaCompleta(res, 'Mujer', productosMujer);
});

// HOMBRE
app.get('/hombre', (req, res) => {
    const productosHombre = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'hombre' || [2,3].includes(p.id)
    );
    generarPaginaCategoriaCompleta(res, 'Hombre', productosHombre);
});

// NIÑOS
app.get('/ninos', (req, res) => {
    const productosNinos = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'ninos'
    );
    generarPaginaCategoriaCompleta(res, 'Niños', productosNinos);
});

// COLECCIONES
app.get('/colecciones', (req, res) => {
    const productosColecciones = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'colecciones'
    );
    generarPaginaCategoriaCompleta(res, 'Colecciones', productosColecciones);
});

// ACCESORIOS
app.get('/accesorios', (req, res) => {
    const productosAccesorios = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'accesorios' || p.id === 5
    );
    generarPaginaCategoriaCompleta(res, 'Accesorios', productosAccesorios);
});

// OFERTAS
app.get('/ofertas', (req, res) => {
    const productosOfertas = TODOS_LOS_PRODUCTOS.filter(p => 
        p.descuento
    );
    generarPaginaCategoriaCompleta(res, 'Ofertas', productosOfertas);
});

// ============================================
// FUNCIÓN COMPLETA PARA GENERAR PÁGINA DE CATEGORÍA
// ============================================
function generarPaginaCategoriaCompleta(res, titulo, productos) {
    let productosHTML = '';
    
    productos.forEach(p => {
        // Generar estrellas
        const fullStars = Math.floor(p.rating || 4.5);
        const halfStar = (p.rating || 4.5) % 1 >= 0.5;
        let starsHtml = '';
        for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fas fa-star"></i>';
        if (halfStar) starsHtml += '<i class="fas fa-star-half-alt"></i>';
        for (let i = fullStars + (halfStar ? 1 : 0); i < 5; i++) starsHtml += '<i class="far fa-star"></i>';
        
        // Opciones de color
        let coloresOptions = '';
        if (p.colores) {
            p.colores.forEach(color => {
                coloresOptions += `<option value="${color.nombre}">${color.nombre}</option>`;
            });
        }
        
        // Opciones de talla
        let tallasOptions = '';
        if (p.tallas) {
            p.tallas.forEach(talla => {
                tallasOptions += `<option value="${talla}">${talla}</option>`;
            });
        }
        
        productosHTML += `
        <div class="product-card" data-product-id="${p.id}">
            ${p.descuento ? `<div class="product-badge sale">${p.descuento}</div>` : ''}
            <a href="/producto/${p.slug}">
                <div class="product-img">
                    <img src="${p.imagenes[0]}" alt="${p.titulo}" class="product-main-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.titulo}</h3>
                    <div class="product-price">
                        <span class="current-price">S/${p.precioActual.toFixed(2)}</span>
                        ${p.precioAnterior ? `<span class="old-price">S/${p.precioAnterior.toFixed(2)}</span>` : ''}
                    </div>
                    
                    <div class="product-options">
                        <select class="color-select" data-product="${p.id}" onclick="event.preventDefault()">
                            <option value="">Seleccione color</option>
                            ${coloresOptions}
                        </select>
                        <select class="size-select" data-product="${p.id}" onclick="event.preventDefault()">
                            <option value="">Seleccione talla</option>
                            ${tallasOptions}
                        </select>
                        <input type="number" class="quantity-input" min="1" value="1" data-product="${p.id}" onclick="event.preventDefault()">
                    </div>
                    
                    <div class="product-rating">
                        ${starsHtml}
                        <span>(${p.reseñas || 0})</span>
                    </div>
                </div>
            </a>
            <button class="add-to-cart" data-product-id="${p.id}">Añadir al carrito</button>
        </div>
        `;
    });
    
    // Schema para Google (ItemList)
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": `${titulo} - Goldinfiniti`,
        "description": `Ropa ${titulo.toLowerCase()} de algodón Pima premium`,
        "url": `https://www.goldinfiniti.com/${titulo.toLowerCase()}`,
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": productos.map((p, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "url": `https://www.goldinfiniti.com/producto/${p.slug}`,
                "name": p.titulo
            }))
        }
    };
    
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo} - Goldinfiniti | Ropa de Algodón Pima Premium</title>
    <meta name="description" content="Ropa ${titulo.toLowerCase()} de algodón Pima 100% peruano. Envíos a todo Perú.">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${titulo} - Goldinfiniti" />
    <meta property="og:description" content="Colección ${titulo.toLowerCase()} de algodón Pima premium" />
    <meta property="og:image" content="https://www.goldinfiniti.com/images/og-image.jpg" />
    <meta property="og:url" content="https://www.goldinfiniti.com/${titulo.toLowerCase()}" />
    
    <!-- Schema.org -->
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
    
    <!-- Fuentes y CSS -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="/styles.css">
    <link rel="shortcut icon" href="/images/logos/faviconn.png" type="image/x-icon">
</head>
<body>
    <!-- TOP BAR -->
    <div class="top-bar">
        <div class="top-bar-content">
            <div class="top-bar-carousel">
                <div class="item">Estilo Premium Vestidos exclusivos</div>
                <div class="item"><a href="tel:968 786 648" class="phone">100% PIMA COTTON PREMIUN</a></div>
                <div class="item"><a href="" class="contact-link">Envío VIP Compras superiores a S/250.00 </a></div>
                <div class="item redes">
                    <a href="https://www.instagram.com/doiscrow/" target="_blank">
                        <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/instagram.svg" alt="Instagram">
                    </a>
                    <a href="https://www.facebook.com/profile.php?id=61585623818611" target="_blank">
                        <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/facebook.svg" alt="Facebook">
                    </a>
                    <a href="https://www.youtube.com/channel/UCLBjBEzoQQ5x6DVDPWNqpgA" target="_blank">
                        <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/youtube.svg" alt="YouTube">
                    </a>
                    <a href="https://www.tiktok.com/@goldinfiniti.com" target="_blank">
                        <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/tiktok.svg" alt="TikTok">
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- HEADER -->
    <header class="header">
        <div class="header-container">
            <div class="logo">
                <a href="/">
                    <img src="/images/logos/logo1.1.png" alt="goldinfiniti" class="logo-img">
                </a>
            </div>
            <nav class="navbar">
                <ul class="nav-menu">
                    <li class="nav-item"><a href="/" class="nav-link">Inicio</a></li>
                    <li class="nav-item"><a href="/mujer" class="nav-link">Mujer</a></li>
                    <li class="nav-item"><a href="/hombre" class="nav-link">Hombre</a></li>
                    <li class="nav-item"><a href="/ninos" class="nav-link">Niños</a></li>
                    <li class="nav-item"><a href="/colecciones" class="nav-link">Colecciones</a></li>
                    <li class="nav-item"><a href="/accesorios" class="nav-link">Accesorios</a></li>
                    <li class="nav-item"><a href="/ofertas" class="nav-link">Ofertas</a></li>
                    <li class="nav-item"><a href="/contacto.html" class="nav-link">Contacto</a></li>
                </ul>
            </nav>
            <div class="header-icons">
                <div class="search-box">
                    <input type="text" placeholder="Buscar..." class="search-input">
                    <button class="search-btn"><i class="fas fa-search"></i></button>
                </div>
                <a href="/login-premiun.html" class="user-icon"><i class="fas fa-user"></i></a>
                <div class="cart-icon-container">
                    <a href="#" class="cart-icon"><i class="fas fa-shopping-bag"></i></a>
                    <span class="cart-count"></span>
                </div>
            </div>
            <div class="hamburger">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
            </div>
        </div>
    </header>

    <!-- PRODUCTOS DE LA CATEGORÍA -->
    <section class="featured-products" id="destacados">
        <div class="section-header">
            <h2 class="section-title">${titulo}</h2>
            <p class="section-subtitle">Colección ${titulo.toLowerCase()} en algodón Pima</p>
        </div>
        <div class="products-grid">
            ${productosHTML || '<p style="text-align:center; padding:40px;">Próximamente nuevos productos...</p>'}
        </div>
    </section>

    <!-- Mini Carrito -->
    <div class="mini-cart" id="miniCart">
        <div class="cart-icon">
            <i class="fas fa-shopping-bag"></i>
            <span class="cart-count"></span>
        </div>
        <span class="cart-total"></span>
    </div>

    <!-- FOOTER COMPLETO -->
    <footer class="footer" id="footer">
        <div class="footer-container">
            <div class="footer-col footer-about">
                <img src="/images/logos/logo2.1.png" alt="Goldinfiniti" class="footer-logo">
                <p class="footer-about-text">Goldinfiniti Premium E-Commerce</p>
                <div class="footer-social">
                    <a href="https://www.facebook.com/profile.php?id=61585623818611"><i class="fab fa-facebook-f"></i></a>
                    <a href="https://www.instagram.com/doiscrow/"><i class="fab fa-instagram"></i></a>
                    <a href="https://www.tiktok.com/@goldinfiniti.com"><i class="fab fa-tiktok"></i></a>
                    <a href="https://www.youtube.com/channel/UCLBjBEzoQQ5x6DVDPWNqpgA"><i class="fab fa-youtube"></i></a>
                </div>
            </div>
            
            <div class="footer-col">
                <h3 class="footer-title">Enlaces rápidos</h3>
                <ul class="footer-links">
                    <li><a href="/politica-de-privacidad.html">Política de Privacidad</a></li>
                    <li><a href="/terminos-y-condiciones.html">Términos y Condiciones</a></li>
                    <li><a href="/cambios-devoluciones.html">Cambios y Devoluciones</a></li>
                    <li><a href="/sobre-nosotros.html">Sobre nosotros</a></li>
                </ul>
            </div>

            <div class="footer-col">
                <h3 class="footer-title">Servicio al cliente</h3>
                <ul class="footer-links">
                    <li><a href="/guia-de-tallas.html">Guía de tallas</a></li>
                    <li><a href="/guia-compras.html">Guía de compras</a></li>
                    <li><a href="/metodos-pago.html">Métodos de pago</a></li>
                    <li><a href="/contacto.html">Contacto</a></li>
                </ul>
            </div>
            
            <div class="footer-col">
                <h3 class="footer-title">Contacto</h3>
                <ul class="footer-contact">
                    <li><i class="fas fa-map-marker-alt"></i> Santa Anita, Lima</li>
                    <li><i class="fas fa-phone"></i> +51 968 786 648</li>
                    <li><i class="fas fa-envelope"></i> contacto@goldinfiniti.com</li>
                    <li><i class="fas fa-file-alt"></i> RUC: 20613360281</li>
                </ul>
                <div class="complaints-book" style="margin-top:25px;">
                    <a href="/libro-reclamaciones.html" style="color:#d4af37;">Libro de Reclamaciones</a>
                </div>
            </div>
        </div>
        
        <div class="footer-bottom">
            <div class="footer-bottom-container">
                <div class="version-footer">
                    <span><strong style="color:#d4af37;">GoldInfiniti</strong> v3.176.0</span>
                </div>
                <div class="copyright-section">
                    <p>© 2026 Goldinfiniti Tech Corp. Todos los derechos reservados.</p>
                </div>
                <div class="payment-icons">
                    <img src="/images/tarjetasbanco/visa.svg" alt="Visa" width="40">
                    <img src="/images/tarjetasbanco/mastercard.svg" alt="Mastercard" width="40">
                    <img src="/images/tarjetasbanco/yape.png" alt="Yape" width="40">
                </div>
            </div>
        </div>
    </footer>

    <!-- SCRIPTS -->
    <script src="/js/productos.js"></script>
    <script src="/js/carrito.js"></script>
    <script src="/js/script.js"></script>
    <script src="/js/culqiCheckout.js" defer></script>
</body>
</html>`);
}
// Exportar la aplicación
module.exports = app;