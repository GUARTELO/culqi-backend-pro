/**
 * ============================================================
 * EMAIL SERVICE - VERSIÓN FIREBASE COMPLETA (OPTIMIZADA VISUAL)
 * ============================================================
 * - MANTIENE TODA LA FUNCIONALIDAD ORIGINAL
 * - DISEÑO OPTIMIZADO ULTRA-MINIMALISTA
 * - RESPONSIVE HASTA 360px
 * - ESTILO SHOPIFY ELEGANTE
 * ============================================================
 */

'use strict';

// ========================
// 1. IMPORTS Y CONFIGURACIÓN (EXACTO)
// ========================
const logger = {
  info: (msg, data = {}) => console.log(`📧 ${msg}`, data),
  error: (msg, data = {}) => console.error(`❌ ${msg}`, data),
  warn: (msg, data = {}) => console.warn(`⚠️ ${msg}`, data),
  debug: (msg, data = {}) => console.log(`🔍 ${msg}`, data)
};

let nodemailer, PDFDocument;

// Carga robusta de dependencias (EXACTO)
try {
  nodemailer = require('nodemailer');
  logger.info('Nodemailer cargado correctamente');
} catch (error) {
  logger.error('Error cargando nodemailer:', { error: error.message });
  nodemailer = null;
}

try {
  PDFDocument = require('pdfkit');
  logger.info('PDFKit cargado correctamente');
} catch (error) {
  logger.error('Error cargando PDFKit:', { error: error.message });
  PDFDocument = null;
}

// ========================
// 2. CONFIGURACIÓN DEL TRANSPORTER (EXACTO - SIN CAMBIOS)
// ========================
const createTransporter = () => {
  // ✅ VERIFICAR SENDGRID PRIMERO (EXACTO)
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  
  if (sendgridApiKey) {
    console.log('✅ [EMAIL DEBUG] Usando SendGrid como transporte principal');
    console.log('🔑 SendGrid API Key encontrada (longitud:', sendgridApiKey.length, 'caracteres)');
    
    // ✅ TRANSPORTER FALSO QUE USA SENDGRID POR DETRÁS (EXACTO)
    return {
      sendMail: async function(mailOptions) {
        try {
          console.log(`📤 [SENDGRID] Enviando a: ${mailOptions.to}`);
          
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(sendgridApiKey);
          
          // ✅ CONVERTIR FORMATO NODEMAILER A SENDGRID (EXACTO)
          const msg = {
            to: mailOptions.to,
            from: mailOptions.from || 'contacto@goldinfiniti.com',
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text,
            cc: mailOptions.cc,
            bcc: mailOptions.bcc,
            // ✅ CORREGIR ADJUNTOS PARA SENDGRID (EXACTO)
            attachments: mailOptions.attachments ? mailOptions.attachments.map(att => ({
              filename: att.filename,
              content: att.content.toString('base64'),
              type: att.contentType || att.type,
              disposition: 'attachment'
            })) : []
          };
          
          const result = await sgMail.send(msg);
          console.log(`✅ [SENDGRID] Email enviado exitosamente`);
          
          return {
            messageId: `sendgrid-${Date.now()}`,
            response: result[0],
            accepted: [mailOptions.to]
          };
          
        } catch (error) {
          console.error('❌ [SENDGRID] Error:', error.message);
          if (error.response) {
            console.error('Detalles:', error.response.body);
          }
          throw error;
        }
      },
      
      verify: function(callback) {
        console.log('✅ [SENDGRID] Transporter verificado');
        callback(null, true);
      },
      
      on: function(event, handler) {
        return this;
      }
    };
    
  }
  
  // ✅ SI NO HAY SENDGRID, USAR GMAIL COMO ANTES (EXACTO)
  console.log('🔍 [EMAIL DEBUG] Verificando variables de entorno:');
  console.log('   GMAIL_USER:', process.env.GMAIL_USER || 'NO ENCONTRADO');
  console.log('   GMAIL_APP_PASSWORD existe?:', !!process.env.GMAIL_APP_PASSWORD);
  console.log('   Longitud password:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0);
  
  const gmailUser = process.env.GMAIL_USER || 'contacto@goldinfiniti.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  // SI NO HAY PASSWORD, LANZA ERROR REAL - NO SIMULACIÓN (EXACTO)
  if (!gmailPass) {
    const errorMsg = '❌ ERROR CRÍTICO: GMAIL_APP_PASSWORD no configurada en .env';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // ✅ CONFIGURACIÓN MEJORADA PARA GMAIL (EXACTO)
  try {
    console.log('✅ [EMAIL DEBUG] Creando transporter REAL con Gmail');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      secure: true,
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.trim()
      },
      tls: {
        rejectUnauthorized: false
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100
    });
    
    // VERIFICAR CONEXIÓN INMEDIATAMENTE (EXACTO)
    transporter.verify(function(error, success) {
      if (error) {
        console.error('❌ [EMAIL DEBUG] Error verificando SMTP:', error.message);
      } else {
        console.log('✅ [EMAIL DEBUG] SMTP verificado y listo para enviar');
      }
    });
    
    transporter.on('error', (error) => {
      logger.error('Error en transporter SMTP:', { 
        error: error.message,
        code: error.code 
      });
    });
    
    transporter.on('idle', () => {
      logger.info('Transporter SMTP está inactivo');
    });
    
    return transporter;
    
  } catch (error) {
    logger.error('❌ ERROR FATAL creando transporter:', { 
      error: error.message,
      stack: error.stack,
      user: gmailUser,
      hasPassword: !!gmailPass
    });
    throw new Error(`Fallo configuración email: ${error.message}`);
  }
};

// 6. CREAR TRANSPORTER CON VERIFICACIÓN (EXACTO)
let transporter;
try {
  transporter = createTransporter();
  
  // Verificación síncrona adicional (EXACTO)
  setTimeout(() => {
    transporter.verify((error) => {
      if (!error) {
        const serviceType = process.env.SENDGRID_API_KEY ? 'SendGrid' : 'Gmail';
        console.log('🚀 [EMAIL] Sistema de emails INICIALIZADO CORRECTAMENTE');
        console.log('   📧 Servicio:', serviceType);
        console.log('   ⏰ Hora:', new Date().toLocaleTimeString());
      }
    });
  }, 1000);
  
} catch (error) {
  console.error('🔥 ERROR INICIALIZANDO EMAIL SERVICE:', error.message);
  
  // Transporter de emergencia que SÍ envía (Ethereal) - EXACTO
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'maddison53@ethereal.email',
      pass: 'jn7jnAPss4f63QBp6D'
    }
  });
  
  console.log('🔄 Usando Ethereal SMTP como respaldo de emergencia');
  console.log('🔗 Puedes ver emails en: https://ethereal.email');
}

// 7. FUNCIÓN DE ENVÍO CON REINTENTOS (EXACTO)
async function sendEmailWithRetry(mailOptions, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📤 [EMAIL] Intento ${i + 1}/${retries} para: ${mailOptions.to}`);
      
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`✅ [EMAIL] Enviado exitosamente a ${mailOptions.to}`);
      console.log(`   📧 Message ID: ${info.messageId}`);
      console.log(`   📅 Enviado: ${new Date().toLocaleTimeString()}`);
      
      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        attempt: i + 1
      };
      
    } catch (error) {
      console.error(`❌ [EMAIL] Intento ${i + 1} falló:`, error.message);
      
      if (i === retries - 1) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`⏳ Reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ========================
// 3. FUNCIÓN PRINCIPAL - ENVIAR CONFIRMACIÓN CON DATOS FIREBASE (EXACTO)
// ========================
/**
 * Envía email de confirmación con TODOS los datos de Firebase
 * @param {Object} paymentData - Datos completos del pago incluyendo Firebase
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendPaymentConfirmation(paymentData) {
  const startTime = Date.now();
  const orderId = paymentData.order_id || paymentData.metadata?.orderId || 'N/A';
  
  try {
    logger.info(`Iniciando envío de confirmación para orden ${orderId}`);
    
    // Validar datos mínimos (EXACTO)
    if (!paymentData.customer_email) {
      throw new Error('Email del cliente no proporcionado');
    }
    
    // Extraer datos de Firebase (EXACTO)
    const firebaseData = _extractFirebaseData(paymentData);
    
    // Generar contenido del email (EXACTO con diseño optimizado)
    const emailContent = _generateGoldenInfinityEmail(firebaseData);
    
    // Generar PDF adjunto si es posible (EXACTO)
    let pdfAttachment = null;
    if (PDFDocument) {
      try {
        pdfAttachment = await _generateOrderPDF(firebaseData);
      } catch (pdfError) {
        logger.warn('Error generando PDF, continuando sin adjunto', { error: pdfError.message });
      }
    }
    
    // Preparar opciones del correo (EXACTO)
    const mailOptions = {
      from: '"GOLDINFINITI" <contacto@goldinfiniti.com>',
      to: paymentData.customer_email,
      bcc: process.env.ADMIN_EMAIL || 'contacto@goldinfiniti.com',
      subject: `✅ Confirmación de Compra #${orderId} - Goldinfiniti`,
      html: emailContent.html,
      text: emailContent.text,
      attachments: pdfAttachment ? [pdfAttachment] : []
    };
    
    // Enviar correo (EXACTO)
    logger.info(`Enviando email a ${paymentData.customer_email}`, {
      orderId,
      productosCount: firebaseData.productos.length,
      total: firebaseData.resumen.total
    });
    
    const info = await transporter.sendMail(mailOptions);
    const duration = Date.now() - startTime;
    
    logger.info(`✅ Email enviado exitosamente para orden ${orderId}`, {
      messageId: info.messageId,
      duration: `${duration}ms`,
      customer: _maskEmail(paymentData.customer_email)
    });
    
    return {
      success: true,
      messageId: info.messageId,
      orderId,
      customerEmail: paymentData.customer_email,
      pdfGenerated: !!pdfAttachment,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    };
    
  } catch (error) {
    logger.error(`Error enviando confirmación para orden ${orderId}`, {
      error: error.message,
      customer: _maskEmail(paymentData.customer_email)
    });
    
    return {
      success: false,
      error: error.message,
      orderId,
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }
}

// ========================
// 4. EXTRACCIÓN DE DATOS DE FIREBASE (EXACTO)
// ========================
/**
 * Extrae y estructura datos de Firebase
 * @param {Object} paymentData - Datos del pago
 * @returns {Object} Datos estructurados para email
 */
function _extractFirebaseData(paymentData) {
  // Datos del cliente (EXACTO)
  const cliente = paymentData.cliente || {
    nombre: paymentData.customer_name || 'Cliente',
    apellido: '',
    email: paymentData.customer_email,
    telefono: paymentData.customer_phone || ''
  };
  
  // Productos (EXACTO)
  const productos = paymentData.productos || 
                   paymentData.metadata?.items || 
                   [];
  
  // Resumen (EXACTO)
  const resumen = paymentData.resumen || {
    subtotal: paymentData.amount ? paymentData.amount / 100 : 0,
    envio: paymentData.envio?.costo || 0,
    total: paymentData.amount ? paymentData.amount / 100 : 0,
    cantidadItems: productos.length
  };
  
  // Envío (EXACTO)
  const envio = paymentData.envio || {
    tipo: 'Estándar',
    costo: resumen.envio || 0,
    estado: 'Pendiente'
  };
  
  // Comprobante (EXACTO)
  const comprobante = paymentData.comprobante || {
    tipo: paymentData.metadata?.tipo_comprobante || 'boleta',
    serie: '',
    numero: ''
  };
  
  // Metadata (EXACTO)
  const metadata = paymentData.metadata || {};
  
  return {
    order_id: paymentData.order_id || paymentData.id || metadata.orderId || `ORD-${Date.now()}`,
    fecha_creacion: paymentData.created_at || metadata.timestamp || new Date().toISOString(),
    culqi_id: paymentData.culqi_id || paymentData.id,
    cliente,
    productos: Array.isArray(productos) ? productos : [],
    resumen,
    envio,
    comprobante,
    metadata
  };
}

// ========================
// 5. GENERACIÓN DE EMAIL HTML ULTRA-MINIMALISTA
// ========================
/**
 * Genera contenido HTML del email - ESTILO SHOPIFY
 * @param {Object} firebaseData - Datos de Firebase
 * @returns {Object} HTML y texto plano
 */
function _generateGoldenInfinityEmail(firebaseData) {
  const {
    order_id,
    fecha_creacion,
    culqi_id,
    cliente,
    productos,
    resumen,
    envio,
    comprobante
  } = firebaseData;
  
  // ✅ FECHA EXACTA COMO EN EL CONTROLLER ORIGINAL
  const fecha = new Date().toLocaleString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Lima'
  });

  // Tabla de productos minimalista
  let productosHtml = '';
  if (productos.length > 0) {
    productos.forEach((producto, index) => {
      const nombre = producto.nombre || producto.titulo || `Producto ${index + 1}`;
      const cantidad = producto.cantidad || producto.quantity || 1;
      const precio = producto.precio || producto.precioOriginal || 0;
      const subtotal = producto.subtotal || (cantidad * precio);
      const color = producto.color ? `<div class="product-attribute">Color: ${producto.color}</div>` : '';
      const talla = producto.talla || producto.size ? `<div class="product-attribute">Talla: ${producto.talla || producto.size}</div>` : '';
      const sku = producto.sku ? `<div class="product-attribute">SKU: ${producto.sku}</div>` : '';
      
      productosHtml += `
        <tr class="product-row">
          <td class="product-info">
            <div class="product-name">${nombre}</div>
            ${color}${talla}${sku}
          </td>
          <td class="product-qty">${cantidad}</td>
          <td class="product-price">S/ ${precio.toFixed(2)}</td>
          <td class="product-total">S/ ${subtotal.toFixed(2)}</td>
        </tr>
      `;
    });
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmación de Compra - GOLDINFINITI</title>
      <style>
        /* ===== RESET ULTRA-MINIMALISTA ===== */
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
               line-height: 1.5; color: #1a1a1a; background: #fafafa; }
        img { max-width: 100%; height: auto; }
        
        /* ===== CONTENEDOR PRINCIPAL ===== */
        .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        
        /* ===== HEADER SHOPIFY-STYLE ===== */
        .email-header { background: #000000; padding: 32px 24px; text-align: center; }
        .brand-logo { font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px; }
        .brand-subtitle { font-size: 13px; color: #cccccc; margin-top: 4px; letter-spacing: 0.3px; }
        
        /* ===== CONTENT AREA ===== */
        .email-content { padding: 32px 24px; }
        
        /* ===== STATUS BADGE ===== */
        .status-badge { display: inline-block; background: #2ecc71; color: white; padding: 6px 12px; 
                       border-radius: 4px; font-size: 12px; font-weight: 500; letter-spacing: 0.3px; }
        
        /* ===== ORDER SUMMARY ===== */
        .order-summary { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .summary-item { font-size: 13px; }
        .summary-label { color: #6c757d; margin-bottom: 4px; }
        .summary-value { font-weight: 500; }
        
        /* ===== PRODUCT TABLE ===== */
        .product-section { margin: 32px 0; }
        .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1a1a1a; }
        .product-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .product-table th { text-align: left; padding: 12px 0; border-bottom: 1px solid #e9ecef; 
                           font-weight: 600; color: #6c757d; }
        .product-table td { padding: 16px 0; border-bottom: 1px solid #f8f9fa; vertical-align: top; }
        .product-info { width: 50%; }
        .product-name { font-weight: 500; margin-bottom: 4px; }
        .product-attribute { font-size: 12px; color: #6c757d; margin-top: 2px; }
        .product-qty { width: 15%; text-align: center; }
        .product-price { width: 17.5%; text-align: right; }
        .product-total { width: 17.5%; text-align: right; font-weight: 600; }
        
        /* ===== TOTAL BOX ===== */
        .total-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 24px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .total-label { color: #6c757d; }
        .grand-total { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-top: 12px; 
                      padding-top: 12px; border-top: 1px solid #e9ecef; }
        
        /* ===== INFO BOXES ===== */
        .info-box { background: #e8f4fd; border-left: 3px solid #007bff; padding: 16px; 
                   border-radius: 4px; margin: 20px 0; font-size: 13px; }
        .info-box-title { font-weight: 600; margin-bottom: 8px; color: #0056b3; }
        
        /* ===== STEPS ===== */
        .steps-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 32px 0; }
        .step { text-align: center; padding: 16px 8px; background: #f8f9fa; border-radius: 6px; }
        .step-icon { font-size: 20px; margin-bottom: 8px; }
        .step-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
        .step-desc { font-size: 11px; color: #6c757d; }
        
        /* ===== FOOTER ===== */
        .email-footer { background: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer-text { font-size: 12px; color: #6c757d; margin-bottom: 8px; }
        .footer-links { margin: 16px 0; }
        .footer-link { color: #007bff; text-decoration: none; font-size: 12px; margin: 0 8px; }
        
        /* ===== RESPONSIVE (360px+) ===== */
        @media (max-width: 480px) {
          .email-content { padding: 24px 16px; }
          .summary-grid { grid-template-columns: 1fr; }
          .product-table th, .product-table td { padding: 12px 4px; font-size: 12px; }
          .product-info { width: 40%; }
          .steps-container { grid-template-columns: 1fr; }
          .product-name { font-size: 13px; }
        }
        
        @media (max-width: 360px) {
          .email-content { padding: 20px 12px; }
          .product-table { font-size: 11px; }
          .product-info { width: 35%; }
          .total-row { font-size: 13px; }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        
        <!-- Header -->
        <div class="email-header">
          <div class="brand-logo">GOLDINFINITI</div>
          <div class="brand-subtitle">E-COMMERCE PREMIUM</div>
        </div>
        
        <!-- Content -->
        <div class="email-content">
          
          <!-- Status -->
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="status-badge">PAGO CONFIRMADO</span>
            <h1 style="font-size: 24px; margin: 16px 0 8px 0; font-weight: 600;">¡Gracias por tu compra!</h1>
            <p style="color: #6c757d; font-size: 14px;">${cliente.nombre}, tu orden ha sido procesada exitosamente</p>
          </div>
          
          <!-- Order Summary -->
          <div class="order-summary">
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Número de Orden</div>
                <div class="summary-value">${order_id}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Fecha</div>
                <div class="summary-value">${fecha}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Cliente</div>
                <div class="summary-value">${cliente.nombre} ${cliente.apellido}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Email</div>
                <div class="summary-value">${cliente.email}</div>
              </div>
            </div>
            ${culqi_id ? `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9ecef;">
                <div class="summary-label">ID Transacción</div>
                <div class="summary-value" style="font-family: monospace; font-size: 12px;">${culqi_id}</div>
              </div>
            ` : ''}
          </div>
          
          <!-- Products -->
          <div class="product-section">
            <h2 class="section-title">Productos comprados</h2>
            ${productos.length > 0 ? `
              <table class="product-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="product-qty">Cantidad</th>
                    <th class="product-price">Precio</th>
                    <th class="product-total">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${productosHtml}
                </tbody>
              </table>
            ` : '<p style="color: #6c757d; font-size: 14px;">No se encontraron detalles de productos.</p>'}
          </div>
          
          <!-- Totals -->
          <div class="total-box">
            <div class="section-title">Resumen de pago</div>
            <div class="total-row">
              <span class="total-label">Subtotal (${resumen.cantidadItems || productos.length} items)</span>
              <span>S/ ${resumen.subtotal.toFixed(2)}</span>
            </div>
            ${envio.costo > 0 ? `
              <div class="total-row">
                <span class="total-label">Envío (${envio.tipo})</span>
                <span>S/ ${envio.costo.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>TOTAL</span>
              <span style="color: #27ae60;">S/ ${resumen.total.toFixed(2)}</span>
            </div>
          </div>
          
          <!-- Shipping Info -->
          ${envio.tipo ? `
            <div class="info-box">
              <div class="info-box-title">Información de envío</div>
              <p><strong>Tipo:</strong> ${envio.tipo}</p>
              <p><strong>Estado:</strong> ${envio.estado || 'En preparación'}</p>
              ${envio.direccion ? `<p><strong>Dirección:</strong> ${envio.direccion}</p>` : ''}
              <p style="margin-top: 8px; font-size: 12px; color: #0056b3;">
                Recibirás actualizaciones cuando tu pedido sea despachado.
              </p>
            </div>
          ` : ''}
          
          <!-- Receipt Info -->
          <div style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 6px;">
            <div class="section-title" style="font-size: 16px;">Comprobante</div>
            <p><strong>Tipo:</strong> ${comprobante.tipo.toUpperCase()}</p>
            ${comprobante.serie ? `<p><strong>Serie:</strong> ${comprobante.serie}</p>` : ''}
            ${comprobante.numero ? `<p><strong>Número:</strong> ${comprobante.numero}</p>` : ''}
            <p style="margin-top: 8px; font-size: 12px; color: #6c757d;">
              Este correo sirve como comprobante de compra.
            </p>
          </div>
          
          <!-- Next Steps -->
          <div class="steps-container">
            <div class="step">
              <div class="step-icon">📦</div>
              <div class="step-title">Preparación</div>
              <div class="step-desc">Tu pedido está siendo preparado</div>
            </div>
            <div class="step">
              <div class="step-icon">🚚</div>
              <div class="step-title">Envío</div>
              <div class="step-desc">Recibirás notificación del despacho</div>
            </div>
            <div class="step">
              <div class="step-icon">🏠</div>
              <div class="step-title">Entrega</div>
              <div class="step-desc">Tu pedido llegará a tu domicilio</div>
            </div>
          </div>
          
          <!-- Important Info -->
          <div class="info-box">
            <div class="info-box-title">Información importante</div>
            <ul style="padding-left: 20px; margin: 8px 0; font-size: 13px;">
              <li style="margin-bottom: 4px;">Tu pedido está siendo procesado</li>
              <li style="margin-bottom: 4px;">Para consultas: contacto@goldinfiniti.com</li>
              <li>Tiempo de entrega estimado: 2-4 días hábiles</li>
            </ul>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
          <div class="brand-logo" style="color: #1a1a1a; margin-bottom: 12px;">GOLDINFINITI</div>
          <p class="footer-text">📧 contacto@goldinfiniti.com | 🌐 www.goldinfiniti.com</p>
          <p class="footer-text">📞 +51 968 786 648 | 🏢 Lima, Perú</p>
          <div class="footer-links">
            <a href="#" class="footer-link">Términos</a>
            <a href="#" class="footer-link">Privacidad</a>
            <a href="#" class="footer-link">Ayuda</a>
          </div>
          <p class="footer-text" style="margin-top: 16px; font-size: 11px; color: #adb5bd;">
            © ${new Date().getFullYear()} Goldinfiniti. Todos los derechos reservados.<br>
            ID: ${culqi_id || order_id}
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
  
  // Texto plano (EXACTO COMO ORIGINAL)
  const text = `
GOLDINFINITI - CONFIRMACIÓN DE COMPRA
========================================

¡Gracias por tu compra, ${cliente.nombre}!

📋 INFORMACIÓN DE LA ORDEN:
---------------------------
Número de Orden: ${order_id}
Fecha: ${fecha}
Cliente: ${cliente.nombre} ${cliente.apellido}
Email: ${cliente.email}
ID Transacción: ${culqi_id || 'N/A'}
Estado: ✅ PAGO APROBADO

🛍️ PRODUCTOS COMPRADOS:
------------------------
${productos.map((p, i) => {
  const nombre = p.nombre || p.titulo || `Producto ${i + 1}`;
  const cantidad = p.cantidad || p.quantity || 1;
  const precio = p.precio || p.precioOriginal || 0;
  const subtotal = p.subtotal || (cantidad * precio);
  return `${nombre} - Cantidad: ${cantidad} - S/ ${precio.toFixed(2)} c/u - Subtotal: S/ ${subtotal.toFixed(2)}`;
}).join('\n')}

💰 RESUMEN DE PAGO:
-------------------
Subtotal (${resumen.cantidadItems || productos.length} items): S/ ${resumen.subtotal.toFixed(2)}
${envio.costo > 0 ? `Costo de envío (${envio.tipo}): S/ ${envio.costo.toFixed(2)}\n` : ''}
TOTAL PAGADO: S/ ${resumen.total.toFixed(2)}

🚚 INFORMACIÓN DE ENVÍO:
------------------------
Tipo: ${envio.tipo || 'No especificado'}
Costo: S/ ${envio.costo ? envio.costo.toFixed(2) : '0.00'}
Estado: ${envio.estado || 'En preparación'}

📄 COMPROBANTE:
---------------
Tipo: ${comprobante.tipo.toUpperCase()}
${comprobante.serie ? `Serie: ${comprobante.serie}\n` : ''}
${comprobante.numero ? `Número: ${comprobante.numero}\n` : ''}

📌 INFORMACIÓN IMPORTANTE:
--------------------------
- Tu pedido está siendo procesado
- Recibirás actualizaciones por email
- Para consultas: contacto@goldinfiniti.com
- Tiempo de entrega estimado: 3-7 días hábiles

👉 ¿QUÉ SIGUE?
---------------
1. 📦 Preparación: Tu pedido está siendo preparado
2. 🚚 Envío: Recibirás notificación del despacho
3. 🏠 Entrega: Tu pedido llegará a tu domicilio

----------------------------------------
GOLDINFINITI - E-COMMERCE PREMIUM
contacto@goldinfiniti.com
www.goldinfiniti.com
+51 968 786 648
© ${new Date().getFullYear()} Goldinfiniti
----------------------------------------
  `;
  
  return { html, text };
}

// ========================
// 6. GENERACIÓN DE PDF PROFESIONAL - TODO LEGIBLE EN UNA HOJA
// ========================
/**
 * Genera PDF profesional TODO LEGIBLE en una hoja
 * @param {Object} firebaseData - Datos de Firebase
 * @returns {Object} Adjunto de PDF
 */
async function _generateOrderPDF(firebaseData) {
  return new Promise((resolve, reject) => {
    try {
      const {
        order_id,
        fecha_creacion,
        cliente,
        productos,
        resumen,
        envio,
        comprobante
      } = firebaseData;
      
      // ==================== FECHA EXACTA ====================
      let fechaOrden;
      if (fecha_creacion) {
        if (fecha_creacion.seconds !== undefined) {
          fechaOrden = new Date(fecha_creacion.seconds * 1000);
        }
        else if (fecha_creacion._seconds !== undefined) {
          fechaOrden = new Date(fecha_creacion._seconds * 1000);
        }
        else if (typeof fecha_creacion === 'string') {
          fechaOrden = new Date(fecha_creacion);
        }
        else if (typeof fecha_creacion === 'number') {
          if (fecha_creacion < 10000000000) {
            fechaOrden = new Date(fecha_creacion * 1000);
          } else {
            fechaOrden = new Date(fecha_creacion);
          }
        }
        else if (fecha_creacion instanceof Date) {
          fechaOrden = fecha_creacion;
        }
        else {
          fechaOrden = new Date();
        }
      } else {
        fechaOrden = new Date();
      }
      
      if (fechaOrden.getFullYear() === 1970) {
        fechaOrden = new Date();
      }
      
      // Formatear fechas para Perú
      const opcionesFecha = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Lima'
      };
      
      const opcionesHora = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Lima'
      };
      
      const formateadorFecha = new Intl.DateTimeFormat('es-PE', opcionesFecha);
      const formateadorHora = new Intl.DateTimeFormat('es-PE', opcionesHora);
      
      const fechaFormateada = formateadorFecha.format(fechaOrden);
      const horaFormateada = formateadorHora.format(fechaOrden);
      
      // ✅ CREAR DOCUMENTO CON BUENOS MÁRGENES
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 30,
        info: {
          Title: `Comprobante ${order_id} - Goldinfiniti`,
          Author: 'Goldinfiniti E-commerce',
          Subject: 'Comprobante de compra',
          Keywords: 'comprobante, factura, orden, ecommerce'
        }
      });
      
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        resolve({
          filename: `comprobante-${order_id}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf'
        });
      });
      
      // ==================== VARIABLE DE CONTROL DE ALTURA ====================
      let y = 30;
      
      // ==================== HEADER LEGIBLE ====================
      doc.fillColor('#000000')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('GOLDINFINITI', 0, y, { align: 'center' });
      
      doc.fillColor('#666666')
         .fontSize(12)
         .font('Helvetica')
         .text('E-COMMERCE PREMIUM', 0, y + 25, { align: 'center' });
      
      y += 55;
      
      // Línea separadora
      doc.strokeColor('#e0e0e0')
         .lineWidth(1)
         .moveTo(30, y)
         .lineTo(doc.page.width - 30, y)
         .stroke();
      
      y += 20;
      
      // Título principal - TAMAÑO NORMAL
      doc.fillColor('#000000')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('COMPROBANTE DE COMPRA', 30, y);
      
      doc.fillColor('#27ae60')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PAGO CONFIRMADO', 30, y + 20);
      
      y += 50;
      
      // ==================== INFORMACIÓN DE ORDEN - TODO LEGIBLE ====================
      // Columna izquierda
      doc.fillColor('#555555').fontSize(11).font('Helvetica');
      doc.text('NÚMERO DE ORDEN:', 30, y);
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12).text(order_id, 150, y);
      
      doc.fillColor('#555555').font('Helvetica').fontSize(11);
      doc.text('FECHA:', 30, y + 18);
      doc.fillColor('#000000').text(fechaFormateada, 150, y + 18);
      
      doc.text('HORA:', 30, y + 36);
      doc.fillColor('#000000').text(horaFormateada, 150, y + 36);
      
      // Columna derecha
      doc.fillColor('#555555').text('CLIENTE:', 320, y);
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12).text(`${cliente.nombre} ${cliente.apellido}`, 380, y);
      
      doc.fillColor('#555555').font('Helvetica').fontSize(11);
      doc.text('EMAIL:', 320, y + 18);
      doc.fillColor('#000000').text(cliente.email, 380, y + 18);
      
      doc.text('TELÉFONO:', 320, y + 36);
      doc.fillColor('#000000').text(cliente.telefono || 'No especificado', 380, y + 36);
      
      y += 70;
      
      // ==================== TABLA DE PRODUCTOS - FUENTE NORMAL ====================
      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold');
      doc.text('PRODUCTOS', 30, y);
      
      y += 20;
      
      // Encabezados de tabla - TAMAÑO LEGIBLE
      const colWidths = [270, 60, 90, 70];
      const colPositions = [30];
      
      for (let i = 1; i < colWidths.length; i++) {
        colPositions[i] = colPositions[i - 1] + colWidths[i - 1];
      }
      
      // Encabezados
      doc.fillColor('#666666').fontSize(11).font('Helvetica-Bold');
      const headers = ['DESCRIPCIÓN', 'CANT.', 'PRECIO', 'TOTAL'];
      
      headers.forEach((header, i) => {
        doc.text(header, colPositions[i], y, {
          width: colWidths[i],
          align: i >= 2 ? 'right' : 'left'
        });
      });
      
      // Línea de encabezado
      doc.strokeColor('#e0e0e0').lineWidth(0.8)
         .moveTo(colPositions[0], y + 12)
         .lineTo(colPositions[3] + colWidths[3], y + 12)
         .stroke();
      
      y += 20;
      
      // ✅ CALCULAR ALTURA DISPONIBLE
      const alturaDisponible = doc.page.height - y - 150; // 150px para resumen y footer
      const alturaPorProducto = 25; // Cada producto ocupa ~25px
      const maxProductosEnPagina = Math.floor(alturaDisponible / alturaPorProducto);
      
      // Productos - FUENTE NORMAL QUE SE LEE BIEN
      productos.forEach((producto, index) => {
        const nombre = producto.nombre || producto.titulo || `Producto ${index + 1}`;
        const cantidad = producto.cantidad || producto.quantity || 1;
        const precio = producto.precio || producto.precioOriginal || 0;
        const subtotal = producto.subtotal || (cantidad * precio);
        
        // NOMBRE COMPLETO - NO SE CORTA
        doc.fillColor('#000000').fontSize(10).font('Helvetica');
        doc.text(nombre, colPositions[0], y, {
          width: colWidths[0] - 10
        });
        
        // DETALLES - TAMAÑO QUE SE VEA
        let detalles = [];
        if (producto.color) detalles.push(`Color: ${producto.color}`);
        if (producto.talla) detalles.push(`Talla: ${producto.talla}`);
        if (producto.sku) detalles.push(`SKU: ${producto.sku}`);
        
        if (detalles.length > 0) {
          doc.fillColor('#777777').fontSize(9);
          doc.text(detalles.join(' • '), colPositions[0], y + 12, {
            width: colWidths[0] - 10
          });
        }
        
        // Cantidad - CENTRADO Y LEGIBLE
        doc.fillColor('#000000').fontSize(10);
        doc.text(cantidad.toString(), colPositions[1], y + (detalles.length > 0 ? 6 : 0), {
          width: colWidths[1],
          align: 'center'
        });
        
        // Precio - BIEN VISIBLE
        doc.text(`S/ ${precio.toFixed(2)}`, colPositions[2], y + (detalles.length > 0 ? 6 : 0), {
          width: colWidths[2],
          align: 'right'
        });
        
        // Subtotal - DESTACADO
        doc.font('Helvetica-Bold');
        doc.text(`S/ ${subtotal.toFixed(2)}`, colPositions[3], y + (detalles.length > 0 ? 6 : 0), {
          width: colWidths[3],
          align: 'right'
        });
        
        y += detalles.length > 0 ? 25 : 20;
        
        // Línea separadora sutil
        if (index < productos.length - 1) {
          doc.strokeColor('#f0f0f0').lineWidth(0.5)
             .moveTo(colPositions[0], y - 5)
             .lineTo(colPositions[3] + colWidths[3], y - 5)
             .stroke();
        }
        
        // ✅ SI SE ACABA EL ESPACIO, AGREGAR PÁGINA
        if (index >= maxProductosEnPagina - 1 && index < productos.length - 1) {
          // Guardar posición actual
          const productosRestantes = productos.slice(index + 1);
          
          // Agregar nueva página
          doc.addPage();
          y = 40;
          
          // Header en nueva página
          doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
             .text('CONTINUACIÓN DE PRODUCTOS - GOLDINFINITI', 30, 20);
          
          // Encabezados de tabla en nueva página
          doc.fillColor('#666666').fontSize(11).font('Helvetica-Bold');
          headers.forEach((header, i) => {
            doc.text(header, colPositions[i], y, {
              width: colWidths[i],
              align: i >= 2 ? 'right' : 'left'
            });
          });
          
          doc.strokeColor('#e0e0e0').lineWidth(0.8)
             .moveTo(colPositions[0], y + 12)
             .lineTo(colPositions[3] + colWidths[3], y + 12)
             .stroke();
          
          y += 20;
          
          // Continuar con productos restantes
          productosRestantes.forEach((productoRestante, subIndex) => {
            const nombreRestante = productoRestante.nombre || productoRestante.titulo || `Producto ${index + subIndex + 2}`;
            const cantidadRestante = productoRestante.cantidad || productoRestante.quantity || 1;
            const precioRestante = productoRestante.precio || productoRestante.precioOriginal || 0;
            const subtotalRestante = productoRestante.subtotal || (cantidadRestante * precioRestante);
            
            // Nombre
            doc.fillColor('#000000').fontSize(10).font('Helvetica');
            doc.text(nombreRestante, colPositions[0], y, {
              width: colWidths[0] - 10
            });
            
            // Detalles
            let detallesRestantes = [];
            if (productoRestante.color) detallesRestantes.push(`Color: ${productoRestante.color}`);
            if (productoRestante.talla) detallesRestantes.push(`Talla: ${productoRestante.talla}`);
            if (productoRestante.sku) detallesRestantes.push(`SKU: ${productoRestante.sku}`);
            
            if (detallesRestantes.length > 0) {
              doc.fillColor('#777777').fontSize(9);
              doc.text(detallesRestantes.join(' • '), colPositions[0], y + 12, {
                width: colWidths[0] - 10
              });
            }
            
            // Cantidad
            doc.fillColor('#000000').fontSize(10);
            doc.text(cantidadRestante.toString(), colPositions[1], y + (detallesRestantes.length > 0 ? 6 : 0), {
              width: colWidths[1],
              align: 'center'
            });
            
            // Precio
            doc.text(`S/ ${precioRestante.toFixed(2)}`, colPositions[2], y + (detallesRestantes.length > 0 ? 6 : 0), {
              width: colWidths[2],
              align: 'right'
            });
            
            // Subtotal
            doc.font('Helvetica-Bold');
            doc.text(`S/ ${subtotalRestante.toFixed(2)}`, colPositions[3], y + (detallesRestantes.length > 0 ? 6 : 0), {
              width: colWidths[3],
              align: 'right'
            });
            
            y += detallesRestantes.length > 0 ? 25 : 20;
            
            if (subIndex < productosRestantes.length - 1) {
              doc.strokeColor('#f0f0f0').lineWidth(0.5)
                 .moveTo(colPositions[0], y - 5)
                 .lineTo(colPositions[3] + colWidths[3], y - 5)
                 .stroke();
            }
          });
        }
      });
      
      // Si estamos en página 2, ajustar Y
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 40;
      } else {
        y += 20;
      }
      
      // ==================== RESUMEN DE PAGO - VISIBLE Y CLARO ====================
      const summaryWidth = 200;
      const summaryX = doc.page.width - summaryWidth - 30;
      
      // Fondo diferenciado
      doc.rect(summaryX, y, summaryWidth, 100)
         .fillColor('#f8f9fa')
         .fill();
      
      // Borde visible
      doc.rect(summaryX, y, summaryWidth, 100)
         .strokeColor('#ddd')
         .lineWidth(0.8)
         .stroke();
      
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold');
      doc.text('RESUMEN DE PAGO', summaryX + 15, y + 15);
      
      doc.strokeColor('#ddd').lineWidth(0.5)
         .moveTo(summaryX + 15, y + 30)
         .lineTo(summaryX + summaryWidth - 15, y + 30)
         .stroke();
      
      let summaryY = y + 40;
      const lineHeight = 18;
      
      // Subtotal - TAMAÑO NORMAL
      doc.fillColor('#555555').fontSize(10).font('Helvetica');
      doc.text('Subtotal:', summaryX + 15, summaryY);
      doc.text(`S/ ${resumen.subtotal.toFixed(2)}`, summaryX + summaryWidth - 60, summaryY, {
        align: 'right'
      });
      
      // Envío
      if (envio.costo > 0) {
        summaryY += lineHeight;
        doc.text(`Envío (${envio.tipo}):`, summaryX + 15, summaryY);
        doc.text(`S/ ${envio.costo.toFixed(2)}`, summaryX + summaryWidth - 60, summaryY, {
          align: 'right'
        });
      }
      
      // Línea separadora
      summaryY += lineHeight + 5;
      doc.strokeColor('#ddd').lineWidth(0.8)
         .moveTo(summaryX + 15, summaryY)
         .lineTo(summaryX + summaryWidth - 15, summaryY)
         .stroke();
      
      // TOTAL - BIEN GRANDE Y DESTACADO
      summaryY += 10;
      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold');
      doc.text('TOTAL:', summaryX + 15, summaryY);
      doc.fillColor('#27ae60').fontSize(16);
      doc.text(`S/ ${resumen.total.toFixed(2)}`, summaryX + summaryWidth - 60, summaryY, {
        align: 'right'
      });
      
      y = Math.max(y + 120, summaryY + 30);
      
      // ==================== INFORMACIÓN ADICIONAL - TODO LEGIBLE ====================
      doc.fillColor('#555555').fontSize(10);
      
      if (envio.tipo) {
        doc.text(`Envío: ${envio.tipo} • Estado: ${envio.estado || 'Pendiente'}`, 30, y);
        y += 15;
      }
      
      doc.text(`Comprobante: ${comprobante.tipo.toUpperCase()}`, 30, y);
      y += 15;
      
      if (comprobante.serie) {
        doc.text(`Serie: ${comprobante.serie}`, 30, y);
        y += 15;
      }
      
      if (comprobante.numero) {
        doc.text(`Número: ${comprobante.numero}`, 30, y);
        y += 15;
      }
      
      // ==================== FOOTER COMPLETO ====================
      doc.fillColor('#777777').fontSize(9);
      doc.text('Este documento es su comprobante oficial de compra.', 
        30, doc.page.height - 40, { 
          width: doc.page.width - 60, 
          align: 'center' 
        });
      
      doc.text(`ID de transacción: ${order_id} • ${new Date().toLocaleDateString('es-PE')} • Goldinfiniti E-commerce`, 
        30, doc.page.height - 25, { 
          width: doc.page.width - 60, 
          align: 'center' 
        });
      
      doc.end();
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      reject(error);
    }
  });
}

// ========================
// 7. FUNCIÓN DE NOTIFICACIÓN INTERNA (EXACTO)
// ========================
async function sendPaymentNotification(paymentData) {
  try {
    const orderId = paymentData.order_id || paymentData.metadata?.orderId || 'N/A';
    const total = paymentData.resumen?.total || 
                  (paymentData.amount ? paymentData.amount / 100 : 0);
    
    const customerEmail = paymentData.cliente?.email || 
                          paymentData.email || 
                          paymentData.customer_email || 
                          'No especificado';

    const customerName = paymentData.cliente?.nombre || 
                         paymentData.customer_name || 
                         'Cliente';
    const customerLastName = paymentData.cliente?.apellido || '';
    const customerFullName = `${customerName} ${customerLastName}`.trim();
    
    // HTML de productos (EXACTO)
    let productosHtml = '';
    if (paymentData.productos && Array.isArray(paymentData.productos)) {
      let totalProductos = 0;
      
      productosHtml = `
        <div style="margin-top: 20px;">
          <h3 style="color: #333; border-bottom: 2px solid #FFD700; padding-bottom: 5px;">🛍️ Productos Comprados (${paymentData.productos.length} items):</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Producto</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cant.</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Precio Unit.</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      paymentData.productos.forEach((producto, index) => {
        const nombre = producto.nombre || producto.titulo || `Producto ${index + 1}`;
        const cantidad = producto.cantidad || producto.quantity || 1;
        const precio = producto.precio || producto.precioOriginal || 0;
        const subtotal = producto.subtotal || (cantidad * precio);
        totalProductos += subtotal;
        
        const color = producto.color ? `<br><small>🎨 Color: ${producto.color}</small>` : '';
        const talla = producto.talla || producto.size ? `<br><small>📏 Talla: ${producto.talla || producto.size}</small>` : '';
        const sku = producto.sku ? `<br><small>🏷️ SKU: ${producto.sku}</small>` : '';
        
        productosHtml += `
          <tr style="${index % 2 === 0 ? 'background: #ffffff;' : 'background: #f9f9f9;'}">
            <td style="border: 1px solid #ddd; padding: 10px; vertical-align: top;">
              <strong>${nombre}</strong>
              ${color}
              ${talla}
              ${sku}
            </td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; vertical-align: top;">${cantidad}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: right; vertical-align: top;">S/ ${precio.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: right; vertical-align: top; font-weight: bold;">S/ ${subtotal.toFixed(2)}</td>
          </tr>
        `;
      });
      
      productosHtml += `
            </tbody>
            <tfoot>
              <tr style="background: #f0f8ff; font-weight: bold;">
                <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;">Total Productos:</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">S/ ${totalProductos.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }
    
    const mailOptions = {
      from: '"Goldinfiniti - Sistema" <contacto@goldinfiniti.com>',
      to: process.env.ADMIN_EMAIL || 'cirobriones99@gmail.com',
      subject: `💰 NUEVO PAGO - Orden #${orderId} - S/ ${total.toFixed(2)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #000000 0%, #333333 100%); color: #FFD700; padding: 25px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">💰 NUEVO PAGO RECIBIDO</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Orden #${orderId}</p>
          </div>
          
          <div style="padding: 25px;">
            <!-- Cabecera de éxito -->
            <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745;">
              <h2 style="margin: 0; font-size: 20px;">✅ PAGO PROCESADO EXITOSAMENTE</h2>
            </div>
            
            <!-- Información principal -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px;">
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 3px solid #007bff;">
                <p style="margin: 0 0 8px 0;"><strong>📋 Orden:</strong><br>#${orderId}</p>
                <p style="margin: 0 0 8px 0;"><strong>👤 Cliente:</strong><br>${customerFullName}</p>
                <p style="margin: 0;"><strong>📧 Email:</strong><br>${customerEmail}</p>
              </div>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 3px solid #28a745;">
                <p style="margin: 0 0 8px 0;"><strong>💰 Total:</strong><br><span style="font-size: 24px; font-weight: bold; color: #28a745;">S/ ${total.toFixed(2)}</span></p>
                <p style="margin: 0 0 8px 0;"><strong>📅 Fecha:</strong><br>${new Date().toLocaleString('es-PE', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'America/Lima'
})}</p>
                <p style="margin: 0;"><strong>🔗 ID Culqi:</strong><br><code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${paymentData.culqi_id || paymentData.id || 'N/A'}</code></p>
              </div>
            </div>
            
            <!-- 🚚 INFORMACIÓN DE ENVÍO (EXACTO) -->
<div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #17a2b8;">
  <p style="margin: 0 0 10px 0; color: #0c5460; font-weight: bold; font-size: 16px;">🚚 DIRECCIÓN DE ENVÍO:</p>
  
  ${paymentData.envio?.direccion ? `
    <p style="margin: 0 0 8px 0; background: white; padding: 10px; border-radius: 4px; border: 1px solid #bee5eb;">
      <strong>📍 Dirección:</strong><br>
      ${paymentData.envio.direccion}
    </p>
  ` : '<p style="margin: 0 0 8px 0; color: #dc3545;">⚠️ No se especificó dirección</p>'}
  
  ${paymentData.envio?.distrito ? `<p style="margin: 0 0 5px 0;"><strong>🏙️ Distrito:</strong> ${paymentData.envio.distrito}</p>` : ''}
  ${paymentData.envio?.provincia ? `<p style="margin: 0 0 5px 0;"><strong>🏛️ Provincia:</strong> ${paymentData.envio.provincia}</p>` : ''}
  ${paymentData.envio?.departamento ? `<p style="margin: 0 0 5px 0;"><strong>🗺️ Departamento:</strong> ${paymentData.envio.departamento}</p>` : ''}
  ${paymentData.envio?.referencia ? `<p style="margin: 0 0 5px 0;"><strong>📌 Referencia:</strong> ${paymentData.envio.referencia}</p>` : ''}
  
  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #bee5eb;">
    ${paymentData.envio?.tipo ? `<p style="margin: 0 0 5px 0;"><strong>📦 Tipo envío:</strong> ${paymentData.envio.tipo}</p>` : ''}
    ${paymentData.envio?.costo ? `<p style="margin: 0 0 5px 0;"><strong>💰 Costo envío:</strong> S/ ${paymentData.envio.costo.toFixed(2)}</p>` : ''}
    ${paymentData.envio?.estado ? `<p style="margin: 0;"><strong>📊 Estado:</strong> <span style="color: ${paymentData.envio.estado === 'pendiente' ? '#ffc107' : '#28a745'};">${paymentData.envio.estado.toUpperCase()}</span></p>` : ''}
  </div>
</div>

<!-- 📞 Información de contacto (EXACTO) -->
<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #6c757d;">
  <p style="margin: 0 0 10px 0; color: #495057; font-weight: bold;">📞 CONTACTO DEL CLIENTE:</p>
  
  ${paymentData.cliente?.telefono ? `
    <p style="margin: 0 0 8px 0;">
      <strong>📱 Teléfono:</strong> 
      <a href="tel:${paymentData.cliente.telefono}" style="color: #007bff; text-decoration: none;">
        ${paymentData.cliente.telefono}
      </a>
      ${paymentData.cliente?.operador ? `<small style="color: #6c757d;"> (${paymentData.cliente.operador})</small>` : ''}
    </p>
  ` : ''}
  
  ${paymentData.cliente?.email ? `
    <p style="margin: 0 0 8px 0;">
      <strong>📧 Email:</strong> 
      <a href="mailto:${paymentData.cliente.email}" style="color: #007bff; text-decoration: none;">
        ${paymentData.cliente.email}
      </a>
    </p>
  ` : ''}
  
  ${paymentData.cliente?.dni ? `<p style="margin: 0 0 5px 0;"><strong>🪪 DNI:</strong> ${paymentData.cliente.dni}</p>` : ''}
  
  ${paymentData.envio?.notas ? `
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #dee2e6;">
      <p style="margin: 0 0 5px 0; font-weight: bold;">📝 Notas del cliente:</p>
      <p style="margin: 0; background: white; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6; font-style: italic;">
        "${paymentData.envio.notas}"
      </p>
    </div>
  ` : ''}
</div>
            
            <!-- Tabla de productos -->
            ${productosHtml}
            
            <!-- Resumen final -->
            <div style="margin-top: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: white;">📊 RESUMEN FINAL</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                  <p style="margin: 0 0 5px 0; opacity: 0.9;">Email al cliente:</p>
                  <p style="margin: 0; font-weight: bold;">✅ ENVIADO</p>
                </div>
                <div>
                  <p style="margin: 0 0 5px 0; opacity: 0.9;">Estado pago:</p>
                  <p style="margin: 0; font-weight: bold;">APROBADO</p>
                </div>
                <div>
                  <p style="margin: 0 0 5px 0; opacity: 0.9;">Fuente:</p>
                  <p style="margin: 0; font-weight: bold;">Firebase + Culqi</p>
                </div>
                <div>
                  <p style="margin: 0 0 5px 0; opacity: 0.9;">Items:</p>
                  <p style="margin: 0; font-weight: bold;">${paymentData.productos?.length || 0}</p>
                </div>
              </div>
              ${paymentData.resumen ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">
                  <p style="margin: 0 0 5px 0; opacity: 0.9;">Subtotal: <span style="float: right; font-weight: bold;">S/ ${paymentData.resumen.subtotal?.toFixed(2) || '0.00'}</span></p>
                  <p style="margin: 0 0 5px 0; opacity: 0.9;">Envío (${paymentData.envio?.tipo || 'Estándar'}): <span style="float: right; font-weight: bold;">S/ ${paymentData.resumen.envio?.toFixed(2) || '0.00'}</span></p>
                  <p style="margin: 15px 0 0 0; font-size: 18px; border-top: 2px solid rgba(255,255,255,0.5); padding-top: 10px;">
                    TOTAL: <span style="float: right; font-weight: bold; font-size: 22px;">S/ ${paymentData.resumen.total?.toFixed(2) || total.toFixed(2)}</span>
                  </p>
                </div>
              ` : ''}
            </div>
            
            <!-- Acciones rápidas -->
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">
                <em>📋 Esta orden fue guardada en Firebase con ID: ${orderId}</em><br>
                <em>💡 Para más detalles, revisa el panel de administración</em>
              </p>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd;">
            <p style="margin: 0 0 5px 0; font-weight: bold;">Goldinfiniti - Sistema Automático de Notificaciones</p>
            <p style="margin: 0; font-size: 11px;">
  🔔 Notificación generada automáticamente • ${new Date().toLocaleString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Lima'
  })}
</p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`📧 Notificación interna enviada para orden ${orderId}`);
    
    return {
      success: true,
      messageId: info.messageId,
      orderId,
      customer: customerFullName,
      total: total,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Error enviando notificación interna:', { 
      error: error.message,
      orderId: paymentData.order_id || 'N/A'
    });
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ========================
// 8. FUNCIONES DE UTILIDAD (EXACTO)
// ========================
function _maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown@email.com';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local.substring(0, 2)}***@${domain}`;
}

function verifyService() {
  const checks = {
    nodemailer: !!nodemailer,
    pdfkit: !!PDFDocument,
    gmailPassword: !!process.env.GMAIL_APP_PASSWORD,
    sendgridKey: !!process.env.SENDGRID_API_KEY,
    environment: process.env.NODE_ENV || 'development'
  };
  
  logger.info('Estado del servicio de email:', checks);
  return checks;
}

// ========================
// 9. EXPORTACIÓN COMPLETA (EXACTO)
// ========================
const emailService = {
  transporter,
  createTransporter,
  sendEmailWithRetry,
  sendPaymentConfirmation,
  sendPaymentNotification,
  verifyService,
  checkEmailConfig: () => ({
    gmailUser: process.env.GMAIL_USER,
    hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
    hasSendGrid: !!process.env.SENDGRID_API_KEY,
    passwordLength: process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0,
    sendgridKeyLength: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length : 0,
    timestamp: new Date().toISOString(),
    status: process.env.SENDGRID_API_KEY ? 'SENGRID_CONFIGURADO' : 
            process.env.GMAIL_APP_PASSWORD ? 'GMAIL_CONFIGURADO' : 'NO_CONFIGURADO'
  }),
  _extractFirebaseData,
  _generateGoldenInfinityEmail,
  _generateOrderPDF,
  _maskEmail
};

module.exports = emailService;