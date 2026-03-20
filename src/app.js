/**
 * ============================================
 * APP.JS - EL CEREBRO DE LA APLICACIÓN (VERSIÓN FINAL CON SEO)
 * ============================================
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const https = require('https');
const path = require('path');

// Importar utilidades
const logger = require('./core/utils/logger');

// Importar middleware personalizado
const errorHandler = require('./api/middleware/errorHandler');
const requestLogger = require('./api/middleware/requestLogger');

// Importar rutas
const paymentRoutes = require('./api/v1/payments/routes');
const healthRoutes = require('./api/v1/health/routes');

// Importar controller de pagos
const paymentController = require('./api/v1/payments/controller');

// 1. Crear la aplicación Express
const app = express();

// ============================================
// 2. MIDDLEWARES
// ============================================
// A. SEGURIDAD - Helmet (VERSIÓN FINAL Y FUNCIONAL)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://goldinfiniti.com"      // ← ESENCIAL
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",                // ← ESENCIAL
        "https://checkout.culqi.com",
        "https://www.googletagmanager.com",
        "https://goldinfiniti.com"        // ← ESENCIAL
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "https://goldinfiniti.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      connectSrc: ["'self'", "https://goldinfiniti.com", "https://api.culqi.com"],
      scriptSrcAttr: ["'unsafe-inline'"],  // ← ESENCIAL para onclick
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
// B. CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://goldinfiniti.com',
      'https://www.goldinfiniti.com',
      'https://api.goldinfiniti.com',
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

// C. BODY PARSING
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 100,
}));

// D. COMPRESSION
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

// E. RATE LIMITING
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// F. REQUEST ID
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || 
           `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// G. MORGAN
const morganFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'combined';
app.use(morgan(morganFormat, { 
  stream: logger.httpStream,
  skip: (req) => req.path === '/health'
}));

// H. REQUEST LOGGER
app.use(requestLogger);

// I. RESPONSE TIME
// I. RESPONSE TIME
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

// Permitir recursos de goldinfiniti.com (SIN ROMPER NADA)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// ============================================
// 2.5. SERVIR ARCHIVOS ESTÁTICOS DESDE FIREBASE
// ============================================
app.use('/styles.css', (req, res) => {
    res.redirect('https://goldinfiniti.com/styles.css');
});

app.use('/js', (req, res) => {
    res.redirect(`https://goldinfiniti.com/js${req.url}`);
});

app.use('/images', (req, res) => {
    res.redirect(`https://goldinfiniti.com/images${req.url}`);
});

app.use('/css', (req, res) => {
    res.redirect(`https://goldinfiniti.com/css${req.url}`);
});

app.use('/fonts', (req, res) => {
    res.redirect(`https://goldinfiniti.com/fonts${req.url}`);
});

// ============================================
// 3. RUTAS DE API
// ============================================

app.use('/health', healthRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.post('/api/v1/reclamos', paymentController.processClaim);

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
// 4. CARGAR PRODUCTOS DESDE FIREBASE HOSTING
// ============================================
let TODOS_LOS_PRODUCTOS = [];

function cargarProductosDesdeFirebase() {
    const baseUrl = 'https://goldinfiniti.com';
    
    const archivos = [
        'js/productos.js',
        'js/productos-mujer.js',
        'js/productos-hombre.js',
        'js/productos-ninos.js',
        'js/productos-colecciones.js',
        'js/productos-accesorios.js',
        'js/productos-ofertas.js'
    ];
    
    let archivosCargados = 0;
    const totalArchivos = archivos.length;
    
    console.log('📥 Cargando productos desde Firebase...');
    
    archivos.forEach(archivo => {
        const url = `${baseUrl}/${archivo}`;
        
        https.get(url, (resp) => {
            let data = '';
            
            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            resp.on('end', () => {
                try {
                    const match = data.match(/const\s+productos\w*\s*=\s*(\[[\s\S]*?\]);/);
                    
                    if (match && match[1]) {
                        const productosArray = eval('(' + match[1] + ')');
                        
                        if (Array.isArray(productosArray)) {
                            TODOS_LOS_PRODUCTOS = [...TODOS_LOS_PRODUCTOS, ...productosArray];
                            console.log(`✅ ${archivo}: ${productosArray.length} productos`);
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Error en ${archivo}: ${e.message}`);
                }
                
                archivosCargados++;
                if (archivosCargados === totalArchivos) {
                    console.log(`📦 TOTAL: ${TODOS_LOS_PRODUCTOS.length} productos cargados desde Firebase`);
                    
                    if (TODOS_LOS_PRODUCTOS.length > 0) {
                        const slugs = TODOS_LOS_PRODUCTOS.map(p => p.slug).filter(Boolean).slice(0, 5);
                        console.log('🔍 Ejemplo de slugs:', slugs);
                    }
                }
            });
            
        }).on('error', (err) => {
            console.log(`❌ Error descargando ${archivo}: ${err.message}`);
            archivosCargados++;
        });
    });
}

cargarProductosDesdeFirebase();

// ============================================
// 5. RUTAS SEO - PRODUCTOS Y CATEGORÍAS
// ============================================

// ============================================
// RUTA PARA PRODUCTO INDIVIDUAL (CON MODAL ABIERTO Y DATOS COMPLETOS)
// ============================================
app.get('/producto/:slug', (req, res) => {
    const slug = req.params.slug;
    const producto = TODOS_LOS_PRODUCTOS.find(p => p.slug === slug);
    
    if (!producto) {
        return res.status(404).send('Producto no encontrado');
    }
    
    // Schema específico del producto para Google
    const schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": producto.titulo,
        "image": producto.imagenes.map(img => `https://goldinfiniti.com/${img}`),
        "description": producto.descripcion?.substring(0, 500) || '',
        "sku": `PROD-${producto.id}`,
        "brand": {
            "@type": "Brand",
            "name": "Goldinfiniti"
        },
        "offers": {
            "@type": "Offer",
            "url": `https://goldinfiniti.com/producto/${producto.slug}`,
            "priceCurrency": "PEN",
            "price": producto.precioActual,
            "availability": "https://schema.org/InStock",
            "seller": {
                "@type": "Organization",
                "name": "Goldinfiniti"
            }
        }
    };
    
    // Agregar rating si existe
    if (producto.rating && producto.reseñas) {
        schema.aggregateRating = {
            "@type": "AggregateRating",
            "ratingValue": producto.rating,
            "reviewCount": producto.reseñas
        };
    }
    
    // Generar estrellas para mostrar
    const fullStars = Math.floor(producto.rating || 0);
    const halfStar = (producto.rating || 0) % 1 >= 0.5;
    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fas fa-star"></i>';
    if (halfStar) starsHtml += '<i class="fas fa-star-half-alt"></i>';
    for (let i = fullStars + (halfStar ? 1 : 0); i < 5; i++) starsHtml += '<i class="far fa-star"></i>';
    
    // Generar miniaturas
    const thumbnailsHtml = producto.imagenes.map(img => 
        `<img src="https://goldinfiniti.com/${img}" class="thumbnail" onclick="document.getElementById('modalMainImage').src='https://goldinfiniti.com/${img}'">`
    ).join('');
    
    // Generar opciones de color
    let colorOptionsHtml = '<option value="">Seleccione color</option>';
    if (producto.colores) {
        producto.colores.forEach(color => {
            colorOptionsHtml += `<option value="${color.nombre}">${color.nombre}</option>`;
        });
    }
    
    // Generar opciones de talla
    let tallaOptionsHtml = '<option value="">Seleccione talla</option>';
    if (producto.tallas) {
        producto.tallas.forEach(talla => {
            tallaOptionsHtml += `<option value="${talla}">${talla}</option>`;
        });
    }
    
    // Precio anterior y descuento
    const precioAnteriorHtml = producto.precioAnterior ? 
        `<span class="old-price" id="modalOldPrice">S/${producto.precioAnterior.toFixed(2)}</span>` : '';
    const descuentoHtml = producto.descuento ? 
        `<span class="discount-badge" id="modalDiscount">${producto.descuento}</span>` : '';
    
    // Enviar el HTML completo (igual a tu index.html pero con modal abierto y datos del producto)
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Título y meta description optimizados para SEO -->
  <title>${producto.titulo} | Goldinfiniti</title>
  <meta name="description" content="${producto.descripcion?.substring(0, 160)}">
  
  <link rel="canonical" href="https://www.goldinfiniti.com/producto/${producto.slug}" />

  <!-- Open Graph (Facebook, LinkedIn) -->
  <meta property="og:title" content="${producto.titulo}" />
  <meta property="og:description" content="${producto.descripcion?.substring(0, 200)}" />
  <meta property="og:image" content="https://www.goldinfiniti.com/${producto.imagenes[0]}" />
  <meta property="og:url" content="https://www.goldinfiniti.com/producto/${producto.slug}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Goldinfiniti" />
  <meta property="product:price:amount" content="${producto.precioActual}" />
  <meta property="product:price:currency" content="PEN" />

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${producto.titulo}" />
  <meta name="twitter:description" content="${producto.descripcion?.substring(0, 200)}" />
  <meta name="twitter:image" content="https://www.goldinfiniti.com/${producto.imagenes[0]}" />

  <!-- Versionado -->
  <meta name="version" content="3.181.0">
  <meta name="codename" content="Epic Lion">
  <meta name="build-timestamp" content="2026-03-20T02:22:30.297Z">

  <!-- Fuentes optimizadas -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300..800&family=Playfair+Display:wght@400..700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300..800&family=Playfair+Display:wght@400..700&display=swap"></noscript>
  <link href="https://fonts.googleapis.com/css2?family=Futura+PT:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@100&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">

  <!-- Estilos -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="https://goldinfiniti.com/styles.css">
  <link rel="shortcut icon" href="https://goldinfiniti.com/images/logos/faviconn.png" type="image/x-icon">

  <!-- Scripts críticos -->
  <script src="https://checkout.culqi.com/js/v4" defer></script>
  
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2B3M2969SW"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-2B3M2969SW', {
      'anonymize_ip': true,
      'page_title': document.title,
      'page_location': window.location.href
    });
  </script>

  <!-- Schema JSON-LD del producto -->
  <script type="application/ld+json">
  ${JSON.stringify(schema, null, 2)}
  </script>
  
</head>
<body>
<!-- CODIGO BARRA SUPERIOR -->  
<div class="top-bar">
  <div class="top-bar-content">
    <div class="top-bar-carousel">
      <div class="item">Estilo Premium Vestidos exclusivos</div>
      <div class="item"><a href="tel:968 786 648" class="phone">100% PIMA COTTON PREMIUN</a></div>
      <div class="item"><a href="" class="contact-link">Envío VIP Compras superiores a S/250.00 </a></div>

      <!-- Redes Sociales al final -->
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

 




    <!-- Codigo html Header -->
    <header class="header">
        <div class="header-container">
            <div class="logo">
                <a href="/">
                    <img src="https://goldinfiniti.com/images/logos/logo1.1.png" alt="goldinfiniti" class="logo-img">
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

    <!-- PRODUCTO (MODAL ABIERTO POR DEFECTO) -->
    <div class="product-modal active" id="productModal" style="display: block; position: relative; top: 0; transform: none; margin: 2rem auto;">
        <div class="modal-overlay" style="display: none;"></div>
        <div class="modal-container" style="transform: none;">
            <button class="modal-close" aria-label="Cerrar modal">&times;</button>
            <div class="modal-content">
                
                <!-- Columna izquierda - Carrusel de imágenes -->
                <div class="modal-gallery">
                    <div class="main-image">
                        <img src="https://goldinfiniti.com/${producto.imagenes[0]}" alt="${producto.titulo}" id="modalMainImage" class="modal-product-image">
                    </div>
                    <!-- PUNTOS INDICADORES -->
                    <div class="image-dots" id="imageDots"></div>
                    
                    <div class="thumbnail-container">
                        <div class="thumbnails" id="productThumbnails">
                            ${thumbnailsHtml}
                        </div>
                        <button class="thumbnail-nav prev-thumb" aria-label="Miniatura anterior">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="thumbnail-nav next-thumb" aria-label="Miniatura siguiente">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Columna derecha - Información del producto -->
                <div class="modal-product-info">
                    <h2 class="product-modal-title" id="modalProductTitle">${producto.titulo}</h2>

                    <div class="product-modal-meta">
                        <div class="modal-rating" id="modalRating">
                            ${starsHtml}
                        </div>
                        <span class="review-count" id="modalReviewCount">(${producto.reseñas || 0} reseñas)</span>
                        <span class="availability in-stock">Disponible</span>
                    </div>

                    <div class="modal-pricing">
                        <span class="current-price" id="modalCurrentPrice">S/${producto.precioActual.toFixed(2)}</span>
                        ${precioAnteriorHtml}
                        ${descuentoHtml}
                    </div>

                    <div class="product-modal-description">
                        <h3>Descripción</h3>
                        <p id="modalDescription">${producto.descripcion || ''}</p>
                    </div>

                    <div class="product-modal-colors">
                        <h3>Colores</h3>
                        <div class="color-options" id="modalColorOptions">
                            <select class="color-select" data-product="${producto.id}">
                                ${colorOptionsHtml}
                            </select>
                        </div>
                    </div>

                    <div class="product-modal-sizes">
                        <h3>Tallas</h3>
                        <div class="size-options" id="modalSizeOptions">
                            <select class="size-select" data-product="${producto.id}">
                                ${tallaOptionsHtml}
                            </select>
                        </div>
                    </div>

                    <div class="product-modal-quantity">
                        <h3>Cantidad</h3>
                        <div class="quantity-selector">
                            <button class="qty-minus" aria-label="Reducir cantidad">-</button>
                            <input type="number" value="1" min="1" class="qty-input" aria-label="Cantidad">
                            <button class="qty-plus" aria-label="Aumentar cantidad">+</button>
                        </div>
                    </div>

                    <div class="product-modal-actions">
                        <button class="add-to-cart add-to-cart-btn" id="modalAddToCart" data-product-id="${producto.id}">Añadir al carrito</button>
                        <button class="buy-now-btn" id="openPagoDirecto">Comprar ahora</button>
                        <button class="add-wishlist-btn" aria-label="Añadir a favoritos">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Mini Carrito mejorado -->
    <div class="mini-cart" id="miniCart">
        <div class="cart-icon">
            <i class="fas fa-shopping-bag"></i>
            <span class="cart-count"></span>
        </div>
        <span class="cart-total"></span>
    </div>

    <!-- Modal del Carrito -->
    <div class="cart-modal" id="cartModal">
        <div class="cart-overlay"></div>
        <div class="cart-container">
            <div class="cart-header">
                <h3>Tu Carrito de Compras</h3>
                <button class="cart-close">&times;</button>
            </div>
            
            <div class="cart-body" id="cartItemsContainer">
                <div class="empty-cart">
                    <i class="fas fa-shopping-bag"></i>
                    <p>Tu carrito está vacío</p>
                </div>
            </div>
            <button class="checkout-btn" id="checkoutBtn">Proceder al Pago</button>
        </div>
    </div>

    <!-- Modal de Pago Directo -->
    <div id="modalPagoDirecto" class="modal-pago-directo">
        <div class="modal-pago-content">
            <div class="pago-columna-izquierda">
                <div class="pago-header">
                    <h1 class="pago-titulo">Datos Obligatorios</h1>
                    <div class="pago-controls">
                        <button class="modal-pago-back" aria-label="Volver">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <button class="modal-pago-close" aria-label="Cerrar">
                            <i class="fas fa-times"></i> 
                        </button>
                    </div>
                </div>
                <div class="form-grid">
                    <!-- Formulario de pago (simplificado) -->
                </div>
            </div>
        </div>
    </div>

    <!-- CODIGO DE WHATSAPP FLOTANTE -->
    <div id="wa-velour-widget" aria-live="polite">
        <button class="wa-widget__btn" aria-expanded="false" aria-controls="wa-widget-panel" aria-label="WhatsApp">
            <svg class="wa-widget__icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <path fill="#FFFFFF" d="M17.472,14.382c-0.297-0.149-1.758-0.867-2.03-0.967c-0.272-0.099-0.47-0.149-0.67,0.15
                c-0.197,0.297-0.767,0.967-0.94,1.164c-0.175,0.196-0.35,0.223-0.65,0.074c-0.297-0.149-1.255-0.462-2.39-1.475
                c-0.882-0.788-1.48-1.761-1.65-2.059c-0.173-0.297-0.018-0.458,0.13-0.606c0.134-0.134,0.297-0.347,0.446-0.52
                c0.149-0.175,0.198-0.297,0.297-0.495c0.099-0.198,0.05-0.371-0.025-0.52c-0.074-0.149-0.669-1.612-0.917-2.206
                c-0.242-0.594-0.487-0.513-0.669-0.523l-0.57-0.01c-0.198,0-0.52,0.074-0.793,0.371c-0.272,0.297-1.04,1.016-1.04,2.479
                s1.065,2.876,1.213,3.074c0.149,0.198,2.096,3.2,5.076,4.487c0.708,0.313,1.263,0.499,1.694,0.639c0.669,0.223,1.28,0.191,1.759,0.116
                c0.52-0.083,1.758-0.719,2.006-1.413c0.248-0.695,0.248-1.29,0.173-1.413C18.219,14.529,17.769,14.531,17.472,14.382z"/>
                <path fill="#FFFFFF" d="M12.006,0.5C5.662,0.5,0.5,5.662,0.5,12.006c0,2.026,0.554,3.924,1.515,5.557L0.5,23.5l5.975-1.92
                c1.63,0.892,3.487,1.42,5.531,1.42c6.344,0,11.506-5.162,11.506-11.506C23.512,5.662,18.35,0.5,12.006,0.5z M12.006,21.428
                c-1.786,0-3.506-0.489-5.005-1.407l-0.359-0.214l-3.723,1.197l0.994-3.648l-0.233-0.372c-1.025-1.643-1.616-3.604-1.616-5.678
                c0-5.193,4.225-9.417,9.418-9.417c5.193,0,9.418,4.224,9.418,9.417C21.424,17.204,17.199,21.428,12.006,21.428z"/>
            </svg>
        </button>
        <section id="wa-widget-panel" class="wa-widget__panel" role="dialog" aria-label="Soporte">
            <div class="wa-card">
                <header class="wa-card__header">
                    <h3 class="wa-card__title">Soporte</h3>
                    <p class="wa-card__subtitle">Ayuda rápida</p>
                </header>
                <div class="wa-card__body">
                    <div class="wa-bubble wa-bubble--from">
                        <span class="wa-bubble__text">¿Necesitas ayuda?</span>
                    </div>
                </div>
                <footer class="wa-card__footer">
                    <div class="wa-input">
                        <textarea class="wa-input__field" rows="1" placeholder="Mensaje">Hola, estoy en su tienda virtual y tengo algunas dudas. ¿Podrían ayudarme?</textarea>
                        <a class="wa-input__cta" id="wa-send" href="https://wa.me/51968786648?text=" target="_blank" rel="noopener">Enviar</a>
                    </div>
                </footer>
            </div>
        </section>
    </div>

    <!-- Sección de Newsletter -->
    <section class="newsletter-pro" aria-label="Suscripción al newsletter">
        <div class="newsletter-box">
            <div class="newsletter-copy">
                <p class="newsletter-eyebrow">Newsletter</p>
                <h2 class="newsletter-title">Mantente un paso adelante</h2>
                <p class="newsletter-text">
                    Recibe lanzamientos, tendencias y ofertas seleccionadas directamente en tu correo.
                </p>
            </div>
            <form class="newsletter-form" id="form-news" novalidate>
                <div class="newsletter-field">
                    <input type="email" id="email" name="email" placeholder="Tu correo electrónico" autocomplete="email" required>
                    <span class="newsletter-error" id="email-error">Revisa el formato del correo.</span>
                </div>
                <button type="submit" class="btn-news" id="btn-send">Suscribirse</button>
            </form>
            <p class="newsletter-privacy">
                Nos tomamos en serio tu privacidad. <a href="/politica-de-privacidad.html">Política de datos</a>.
            </p>
            <p id="mensaje-exito" class="mensaje-exito" aria-live="polite">✅ ¡Gracias por suscribirte!</p>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer" id="footer">
        <div class="footer-container">
            <div class="footer-col footer-about">
                <img src="https://goldinfiniti.com/images/logos/logo2.1.png" alt="Goldinfiniti" class="footer-logo">
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
                <div class="version-footer" style="font-size: 11px; color: #888; text-align: center; margin: 5px 0;">
                    <span style="display: inline-block; margin-right: 10px;">
                        <strong style="color: #d4af37;">GoldInfiniti</strong> v3.181.0 (Epic Lion)
                    </span>
                </div>
                <div class="copyright-section">
                    <p class="copyright">
                        © 2026 <strong>Goldinfiniti Tech Corp</strong>. Todos los derechos reservados.
                    </p>
                </div>
                <div class="payment-section" id="pagos">
                    <div class="payment-icons">
                        <img src="https://goldinfiniti.com/images/tarjetasbanco/visa.svg" alt="Visa" width="40">
                        <img src="https://goldinfiniti.com/images/tarjetasbanco/mastercard.svg" alt="Mastercard" width="40">
                        <img src="https://goldinfiniti.com/images/tarjetasbanco/yape.png" alt="Yape" width="40">
                    </div>
                </div>
            </div>
        </div>
    </footer>

    <!-- Script del menú -->
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const currentPath = window.location.pathname.split("/").pop();
            document.querySelectorAll('.nav-link').forEach(link => {
                const href = link.getAttribute('href');
                if (href === currentPath) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        });
    </script>

    <!-- Scripts de Firebase y Culqi -->
    <script src="https://checkout.culqi.com/js/v4" defer></script>
    <script src="https://goldinfiniti.com/js/productos.js"></script>
    <script src="https://goldinfiniti.com/js/carrito.js"></script>
    <script src="https://goldinfiniti.com/js/script.js"></script>
    <script src="https://goldinfiniti.com/js/culqiCheckout.js" defer></script>
    <script type="module" src="https://goldinfiniti.com/js/app.js"></script>
    <script type="module" src="https://goldinfiniti.com/js/login.js"></script>
    <script type="module" src="https://goldinfiniti.com/js/newsletter.js"></script>
    <script type="module" src="https://goldinfiniti.com/js/handler.js"></script>

    <!-- Script para pasar el ID del producto -->
    <script>
        window.productoActualId = ${producto.id};
        
        // Asegurar que el modal esté visible
        document.addEventListener('DOMContentLoaded', function() {
            const modal = document.getElementById('productModal');
            if (modal) {
                modal.style.display = 'block';
                modal.classList.add('active');
            }
        });
    </script>
</body>
</html>`);
});

// RUTA MUJER
app.get('/mujer', (req, res) => {
    const productosMujer = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'mujer' || [1,4,5].includes(p.id)
    );
    generarPaginaCategoriaCompleta(res, 'Mujer', productosMujer);
});

// RUTA HOMBRE
app.get('/hombre', (req, res) => {
    const productosHombre = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'hombre' || [2,3].includes(p.id)
    );
    generarPaginaCategoriaCompleta(res, 'Hombre', productosHombre);
});

// RUTA NIÑOS
app.get('/ninos', (req, res) => {
    const productosNinos = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'ninos'
    );
    generarPaginaCategoriaCompleta(res, 'Niños', productosNinos);
});

// RUTA COLECCIONES
app.get('/colecciones', (req, res) => {
    const productosColecciones = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'colecciones'
    );
    generarPaginaCategoriaCompleta(res, 'Colecciones', productosColecciones);
});

// RUTA ACCESORIOS
app.get('/accesorios', (req, res) => {
    const productosAccesorios = TODOS_LOS_PRODUCTOS.filter(p => 
        p.categoria === 'accesorios' || p.id === 5
    );
    generarPaginaCategoriaCompleta(res, 'Accesorios', productosAccesorios);
});

// RUTA OFERTAS
app.get('/ofertas', (req, res) => {
    const productosOfertas = TODOS_LOS_PRODUCTOS.filter(p => 
        p.descuento
    );
    generarPaginaCategoriaCompleta(res, 'Ofertas', productosOfertas);
});

// ============================================
// FUNCIÓN GENERADORA DE PÁGINAS DE CATEGORÍA (CON HEADER COMPLETO)
// ============================================
function generarPaginaCategoriaCompleta(res, titulo, productos) {
    let productosHTML = '';
    
    productos.forEach(p => {
        const fullStars = Math.floor(p.rating || 4.5);
        const halfStar = (p.rating || 4.5) % 1 >= 0.5;
        let starsHtml = '';
        for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fas fa-star"></i>';
        if (halfStar) starsHtml += '<i class="fas fa-star-half-alt"></i>';
        for (let i = fullStars + (halfStar ? 1 : 0); i < 5; i++) starsHtml += '<i class="far fa-star"></i>';
        
        let coloresOptions = '<option value="">Seleccione color</option>';
        if (p.colores) {
            p.colores.forEach(color => {
                coloresOptions += `<option value="${color.nombre}">${color.nombre}</option>`;
            });
        }
        
        let tallasOptions = '<option value="">Seleccione talla</option>';
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
                    <img src="https://goldinfiniti.com/${p.imagenes[0]}" alt="${p.titulo}" class="product-main-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.titulo}</h3>
                    <div class="product-price">
                        <span class="current-price">S/${p.precioActual.toFixed(2)}</span>
                        ${p.precioAnterior ? `<span class="old-price">S/${p.precioAnterior.toFixed(2)}</span>` : ''}
                    </div>
                    
                    <div class="product-options">
                        <select class="color-select" data-product="${p.id}" onclick="event.preventDefault()">
                            ${coloresOptions}
                        </select>
                        <select class="size-select" data-product="${p.id}" onclick="event.preventDefault()">
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
    
    <link rel="canonical" href="https://www.goldinfiniti.com/${titulo.toLowerCase()}.html" />

    <!-- Open Graph -->
    <meta property="og:title" content="${titulo} - Goldinfiniti" />
    <meta property="og:description" content="Colección ${titulo.toLowerCase()} de algodón Pima premium" />
    <meta property="og:image" content="https://www.goldinfiniti.com/images/og-image.jpg" />
    <meta property="og:url" content="https://www.goldinfiniti.com/${titulo.toLowerCase()}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Goldinfiniti" />

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${titulo} - Goldinfiniti" />
    <meta name="twitter:description" content="Colección ${titulo.toLowerCase()} en algodón Pima" />
    <meta name="twitter:image" content="https://www.goldinfiniti.com/images/og-image.jpg" />
    
    <!-- Versionado -->
    <meta name="version" content="3.179.0">
    <meta name="codename" content="Nova Panther">
    <meta name="build-timestamp" content="2026-03-20T00:24:43.976Z">

    <!-- Fuentes -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300..800&family=Playfair+Display:wght@400..700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300..800&family=Playfair+Display:wght@400..700&display=swap"></noscript>
    <link href="https://fonts.googleapis.com/css2?family=Futura+PT:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

    <!-- Estilos -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="https://goldinfiniti.com/styles.css">
    <link rel="shortcut icon" href="https://goldinfiniti.com/images/logos/faviconn.png" type="image/x-icon">

    <!-- Scripts críticos -->
    <script src="https://checkout.culqi.com/js/v4" defer></script>
    
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-2B3M2969SW"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-2B3M2969SW', {
            'anonymize_ip': true,
            'page_title': document.title,
            'page_location': window.location.href
        });
    </script>

    <!-- Schema.org de la tienda -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Store",
        "name": "Goldinfiniti",
        "url": "https://www.goldinfiniti.com",
        "logo": "https://www.goldinfiniti.com/images/logos/logo1.1.png",
        "sameAs": [
            "https://www.facebook.com/profile.php?id=61585623818611",
            "https://www.instagram.com/doiscrow/",
            "https://www.tiktok.com/@goldinfiniti.com"
        ]
    }
    </script>
    
    <!-- Schema del ItemList (productos) -->
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
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
                    <img src="https://goldinfiniti.com/images/logos/logo1.1.png" alt="goldinfiniti" class="logo-img">
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

    <!-- HERO DE CATEGORÍA (simplificado) -->
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
                <img src="https://goldinfiniti.com/images/logos/logo2.1.png" alt="Goldinfiniti" class="footer-logo">
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
                    <img src="https://goldinfiniti.com/images/tarjetasbanco/visa.svg" alt="Visa" width="40">
                    <img src="https://goldinfiniti.com/images/tarjetasbanco/mastercard.svg" alt="Mastercard" width="40">
                    <img src="https://goldinfiniti.com/images/tarjetasbanco/yape.png" alt="Yape" width="40">
                </div>
            </div>
        </div>
    </footer>

    <!-- Scripts -->
    <script src="https://checkout.culqi.com/js/v4" defer></script>
    <script src="https://goldinfiniti.com/js/productos.js"></script>
    <script src="https://goldinfiniti.com/js/carrito.js"></script>
    <script src="https://goldinfiniti.com/js/script.js"></script>
    <script src="https://goldinfiniti.com/js/culqiCheckout.js" defer></script>
    
    <!-- Script de versión (opcional) -->
    <script>
    (function() {
        const elements = {
            version: document.getElementById('current-version'),
            codename: document.getElementById('codename'),
            date: document.getElementById('build-date')
        };
        if (elements.version) elements.version.textContent = '3.179.0';
        if (elements.codename) elements.codename.textContent = '(Nova Panther)';
        if (elements.date) elements.date.textContent = '19/03/2026, 07:24 p. m.';
    })();
    </script>
</body>
</html>`);
}

// ============================================
// 6. MANEJO DE ERRORES
// ============================================

// 404 HANDLER - DEBE IR AL FINAL
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
        'GET    /api/v1/payments/verify/:paymentId',
        'GET    /mujer',
        'GET    /hombre',
        'GET    /ninos',
        'GET    /colecciones',
        'GET    /accesorios',
        'GET    /ofertas',
        'GET    /producto/:slug'
      ]
    },
    timestamp: new Date().toISOString(),
  });
});

// ERROR HANDLER FINAL
app.use(errorHandler);

// ============================================
// 7. EXPORTAR
// ============================================
module.exports = app;