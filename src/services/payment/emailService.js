/**
 * ============================================================
 * EMAIL SERVICE - VERSIÓN ULTRA-PREMIUM SHOPIFY
 * ============================================================
 * - DISEÑO ULTRA-MINIMALISTA TIPO SHOPIFY
 * - ULTRA-RESPONSIVE HASTA 360px
 * - PDF DE 1 HOJA PROFESIONAL TIPO RETAIL
 * - MANTIENE 100% FUNCIONALIDAD ORIGINAL
 * ============================================================
 */

'use strict';

// ========================
// 1. IMPORTS Y CONFIGURACIÓN (EXACTO IGUAL)
// ========================
const logger = {
  info: (msg, data = {}) => console.log(`📧 ${msg}`, data),
  error: (msg, data = {}) => console.error(`❌ ${msg}`, data),
  warn: (msg, data = {}) => console.warn(`⚠️ ${msg}`, data),
  debug: (msg, data = {}) => console.log(`🔍 ${msg}`, data)
};

let nodemailer, PDFDocument;

// Carga robusta de dependencias (EXACTO IGUAL)
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
// 2. CONFIGURACIÓN DEL TRANSPORTER (EXACTO IGUAL - SIN CAMBIOS)
// ========================
const createTransporter = () => {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  
  if (sendgridApiKey) {
    console.log('✅ [EMAIL DEBUG] Usando SendGrid como transporte principal');
    
    return {
      sendMail: async function(mailOptions) {
        try {
          console.log(`📤 [SENDGRID] Enviando a: ${mailOptions.to}`);
          
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(sendgridApiKey);
          
          const msg = {
            to: mailOptions.to,
            from: mailOptions.from || 'contacto@goldinfiniti.com',
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text,
            cc: mailOptions.cc,
            bcc: mailOptions.bcc,
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
  
  console.log('🔍 [EMAIL DEBUG] Verificando variables de entorno:');
  console.log('   GMAIL_USER:', process.env.GMAIL_USER || 'NO ENCONTRADO');
  
  const gmailUser = process.env.GMAIL_USER || 'contacto@goldinfiniti.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  if (!gmailPass) {
    const errorMsg = '❌ ERROR CRÍTICO: GMAIL_APP_PASSWORD no configurada en .env';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  
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

// 6. CREAR TRANSPORTER CON VERIFICACIÓN (EXACTO IGUAL)
let transporter;
try {
  transporter = createTransporter();
  
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

// 7. FUNCIÓN DE ENVÍO CON REINTENTOS (EXACTO IGUAL)
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
// 3. FUNCIÓN PRINCIPAL - ENVIAR CONFIRMACIÓN (EXACTO IGUAL)
// ========================
async function sendPaymentConfirmation(paymentData) {
  const startTime = Date.now();
  const orderId = paymentData.order_id || paymentData.metadata?.orderId || 'N/A';
  
  try {
    logger.info(`Iniciando envío de confirmación para orden ${orderId}`);
    
    if (!paymentData.customer_email) {
      throw new Error('Email del cliente no proporcionado');
    }
    
    const firebaseData = _extractFirebaseData(paymentData);
    const emailContent = _generateGoldenInfinityEmail(firebaseData);
    
    let pdfAttachment = null;
    if (PDFDocument) {
      try {
        pdfAttachment = await _generateOrderPDF(firebaseData);
      } catch (pdfError) {
        logger.warn('Error generando PDF, continuando sin adjunto', { error: pdfError.message });
      }
    }
    
    const mailOptions = {
      from: '"GOLDINFINITI" <contacto@goldinfiniti.com>',
      to: paymentData.customer_email,
      bcc: process.env.ADMIN_EMAIL || 'contacto@goldinfiniti.com',
      subject: `✅ Confirmación de Compra #${orderId} - Goldinfiniti`,
      html: emailContent.html,
      text: emailContent.text,
      attachments: pdfAttachment ? [pdfAttachment] : []
    };
    
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
// 4. EXTRACCIÓN DE DATOS DE FIREBASE (EXACTO IGUAL)
// ========================
function _extractFirebaseData(paymentData) {
  const cliente = paymentData.cliente || {
    nombre: paymentData.customer_name || 'Cliente',
    apellido: '',
    email: paymentData.customer_email,
    telefono: paymentData.customer_phone || ''
  };
  
  const productos = paymentData.productos || 
                   paymentData.metadata?.items || 
                   [];
  
  const resumen = paymentData.resumen || {
    subtotal: paymentData.amount ? paymentData.amount / 100 : 0,
    envio: paymentData.envio?.costo || 0,
    total: paymentData.amount ? paymentData.amount / 100 : 0,
    cantidadItems: productos.length
  };
  
  const envio = paymentData.envio || {
    tipo: 'Estándar',
    costo: resumen.envio || 0,
    estado: 'Pendiente'
  };
  
  const comprobante = paymentData.comprobante || {
    tipo: paymentData.metadata?.tipo_comprobante || 'boleta',
    serie: '',
    numero: ''
  };
  
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
// 5. GENERACIÓN DE EMAIL HTML - VERSIÓN ULTRA-PREMIUM
// ========================
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

  // Tabla de productos ultra-minimalista
  let productosHtml = '';
  if (productos.length > 0) {
    productos.forEach((producto, index) => {
      const nombre = producto.nombre || producto.titulo || `Producto ${index + 1}`;
      const cantidad = producto.cantidad || producto.quantity || 1;
      const precio = producto.precio || producto.precioOriginal || 0;
      const subtotal = producto.subtotal || (cantidad * precio);
      
      productosHtml += `
        <tr class="product-item">
          <td class="product-details">
            <div class="product-name">${nombre}</div>
            ${producto.color ? `<div class="product-attr">Color: ${producto.color}</div>` : ''}
            ${producto.talla ? `<div class="product-attr">Talla: ${producto.talla}</div>` : ''}
            ${producto.sku ? `<div class="product-attr">SKU: ${producto.sku}</div>` : ''}
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
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación de Compra - Goldinfiniti</title>
    <style>
        /* ===== RESET ULTRA-MINIMALISTA ===== */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
               line-height: 1.6; color: #1a1a1a; background: #fafafa; -webkit-font-smoothing: antialiased; }
        img { max-width: 100%; height: auto; }
        table { border-collapse: collapse; width: 100%; }
        
        /* ===== CONTENEDOR PRINCIPAL ===== */
        .email-wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
        
        /* ===== HEADER SHOPIFY-STYLE ===== */
        .email-header { background: #000000; padding: 40px 24px; text-align: center; }
        .brand-name { font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 4px; }
        .brand-tagline { font-size: 13px; color: #cccccc; letter-spacing: 0.5px; text-transform: uppercase; }
        
        /* ===== CONTENIDO PRINCIPAL ===== */
        .email-content { padding: 40px 24px; }
        
        /* ===== SECCIÓN DE ESTADO ===== */
        .status-section { text-align: center; margin-bottom: 32px; }
        .status-badge { display: inline-block; background: #10b981; color: white; padding: 6px 16px; 
                       border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; }
        .main-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 16px 0 8px; }
        .subtitle { color: #6b7280; font-size: 15px; }
        
        /* ===== RESUMEN DE ORDEN ===== */
        .order-summary { background: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .summary-item { margin-bottom: 12px; }
        .summary-label { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
        .summary-value { font-size: 14px; font-weight: 500; color: #1a1a1a; }
        
        /* ===== TABLA DE PRODUCTOS ===== */
        .products-section { margin: 32px 0; }
        .section-title { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 20px; }
        .products-table { font-size: 14px; }
        .products-table th { text-align: left; padding: 12px 0; border-bottom: 2px solid #e5e7eb; 
                           color: #6b7280; font-weight: 600; font-size: 13px; }
        .products-table td { padding: 16px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        .product-details { width: 45%; }
        .product-name { font-weight: 500; margin-bottom: 4px; }
        .product-attr { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .product-qty { width: 15%; text-align: center; color: #6b7280; }
        .product-price { width: 20%; text-align: right; color: #6b7280; }
        .product-total { width: 20%; text-align: right; font-weight: 600; }
        
        /* ===== TOTALES ===== */
        .totals-section { background: #f9fafb; border-radius: 12px; padding: 24px; margin-top: 24px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .total-label { color: #6b7280; }
        .grand-total { border-top: 2px solid #e5e7eb; margin-top: 12px; padding-top: 16px; 
                      font-size: 18px; font-weight: 700; color: #1a1a1a; }
        
        /* ===== INFORMACIÓN ADICIONAL ===== */
        .info-section { margin: 24px 0; }
        .info-card { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; 
                    border-radius: 8px; margin-bottom: 16px; }
        .info-card-title { font-weight: 600; color: #1e40af; margin-bottom: 8px; font-size: 14px; }
        .info-card-content { font-size: 13px; color: #374151; }
        
        /* ===== PASOS DEL PROCESO ===== */
        .steps-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 32px 0; }
        .step { text-align: center; padding: 20px 12px; background: #f9fafb; border-radius: 8px; }
        .step-icon { font-size: 24px; margin-bottom: 8px; display: block; }
        .step-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .step-desc { font-size: 12px; color: #6b7280; }
        
        /* ===== FOOTER PROFESIONAL ===== */
        .email-footer { background: #111827; color: #9ca3af; padding: 32px 24px; text-align: center; }
        .footer-brand { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .footer-info { font-size: 12px; margin-bottom: 16px; line-height: 1.5; }
        .footer-links { margin: 20px 0; }
        .footer-link { color: #60a5fa; text-decoration: none; font-size: 12px; margin: 0 8px; }
        .footer-legal { font-size: 11px; color: #6b7280; margin-top: 20px; padding-top: 20px; 
                       border-top: 1px solid #374151; line-height: 1.6; }
        
        /* ===== RESPONSIVE EXTREMO (360px+) ===== */
        @media (max-width: 640px) {
            .email-content { padding: 24px 16px; }
            .summary-grid { grid-template-columns: 1fr; }
            .products-table { font-size: 13px; }
            .products-table th, .products-table td { padding: 12px 4px; }
            .product-details { width: 40%; }
            .steps-section { grid-template-columns: 1fr; gap: 8px; }
            .step { padding: 16px 8px; }
        }
        
        @media (max-width: 480px) {
            .email-header { padding: 32px 16px; }
            .email-content { padding: 20px 12px; }
            .product-details { width: 35%; }
            .products-table { font-size: 12px; }
            .footer-links { display: flex; flex-direction: column; gap: 8px; }
            .footer-link { margin: 4px 0; }
        }
        
        @media (max-width: 360px) {
            .email-content { padding: 16px 10px; }
            .products-table { font-size: 11px; }
            .product-details { width: 30%; }
            .section-title { font-size: 16px; }
            .main-title { font-size: 20px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        
        <!-- Header -->
        <div class="email-header">
            <div class="brand-name">GOLDINFINITI</div>
            <div class="brand-tagline">E-commerce Premium</div>
        </div>
        
        <!-- Contenido Principal -->
        <div class="email-content">
            
            <!-- Estado del Pedido -->
            <div class="status-section">
                <span class="status-badge">PAGO CONFIRMADO</span>
                <h1 class="main-title">¡Gracias por tu compra, ${cliente.nombre}!</h1>
                <p class="subtitle">Tu orden ha sido procesada exitosamente</p>
            </div>
            
            <!-- Resumen de Orden -->
            <div class="order-summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Número de Orden</div>
                        <div class="summary-value">${order_id}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Fecha y Hora</div>
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
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <div class="summary-label">ID de Transacción</div>
                    <div class="summary-value" style="font-family: 'Monaco', 'Consolas', monospace; font-size: 12px;">${culqi_id}</div>
                </div>
                ` : ''}
            </div>
            
            <!-- Productos -->
            <div class="products-section">
                <h2 class="section-title">Detalles de la Compra</h2>
                ${productos.length > 0 ? `
                <table class="products-table">
                    <thead>
                        <tr>
                            <th class="product-details">Producto</th>
                            <th class="product-qty">Cant.</th>
                            <th class="product-price">Precio Unit.</th>
                            <th class="product-total">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productosHtml}
                    </tbody>
                </table>
                ` : '<p style="color: #6b7280; font-size: 14px; text-align: center;">No se encontraron detalles de productos.</p>'}
            </div>
            
            <!-- Totales -->
            <div class="totals-section">
                <div class="section-title">Resumen de Pago</div>
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
                    <span style="color: #10b981;">S/ ${resumen.total.toFixed(2)}</span>
                </div>
            </div>
            
            <!-- Información de Envío -->
            ${envio.tipo ? `
            <div class="info-section">
                <div class="info-card">
                    <div class="info-card-title">Información de Envío</div>
                    <div class="info-card-content">
                        <p><strong>Tipo:</strong> ${envio.tipo}</p>
                        <p><strong>Estado:</strong> ${envio.estado || 'En preparación'}</p>
                        ${envio.direccion ? `<p><strong>Dirección:</strong> ${envio.direccion}</p>` : ''}
                        <p style="margin-top: 8px; font-style: italic;">
                            Recibirás actualizaciones cuando tu pedido sea despachado.
                        </p>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Información de Comprobante -->
            <div class="info-section">
                <div class="info-card" style="background: #f0f9ff; border-left-color: #0ea5e9;">
                    <div class="info-card-title">Comprobante</div>
                    <div class="info-card-content">
                        <p><strong>Tipo:</strong> ${comprobante.tipo.toUpperCase()}</p>
                        ${comprobante.serie ? `<p><strong>Serie:</strong> ${comprobante.serie}</p>` : ''}
                        ${comprobante.numero ? `<p><strong>Número:</strong> ${comprobante.numero}</p>` : ''}
                        <p style="margin-top: 8px; font-size: 12px;">
                            Este correo electrónico sirve como comprobante oficial de tu compra.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Pasos del Proceso -->
            <div class="steps-section">
                <div class="step">
                    <span class="step-icon">📦</span>
                    <div class="step-title">Preparación</div>
                    <div class="step-desc">Tu pedido está siendo preparado</div>
                </div>
                <div class="step">
                    <span class="step-icon">🚚</span>
                    <div class="step-title">Envío</div>
                    <div class="step-desc">Recibirás notificación del despacho</div>
                </div>
                <div class="step">
                    <span class="step-icon">🏠</span>
                    <div class="step-title">Entrega</div>
                    <div class="step-desc">Tu pedido llegará a tu domicilio</div>
                </div>
            </div>
            
            <!-- Información Importante -->
            <div class="info-section">
                <div class="info-card" style="background: #fffbeb; border-left-color: #f59e0b;">
                    <div class="info-card-title">Información Importante</div>
                    <div class="info-card-content">
                        <ul style="padding-left: 18px; margin: 8px 0;">
                            <li style="margin-bottom: 6px;">Tu pedido está siendo procesado</li>
                            <li style="margin-bottom: 6px;">Para consultas: contacto@goldinfiniti.com</li>
                            <li>Tiempo de entrega estimado: 2-4 días hábiles</li>
                        </ul>
                    </div>
                </div>
            </div>
            
        </div>
        
        <!-- Footer Profesional -->
        <div class="email-footer">
            <div class="footer-brand">GOLDINFINITI</div>
            <div class="footer-info">
                📧 contacto@goldinfiniti.com | 🌐 www.goldinfiniti.com<br>
                📞 +51 968 786 648 | 🏢 Lima, Perú
            </div>
            <div class="footer-links">
                <a href="#" class="footer-link">Términos y Condiciones</a>
                <a href="#" class="footer-link">Política de Privacidad</a>
                <a href="#" class="footer-link">Centro de Ayuda</a>
            </div>
            <div class="footer-legal">
                © ${new Date().getFullYear()} Goldinfiniti Tech Corp. Sistema Automático de Notificaciones.<br>
                Este es un mensaje automático, por favor no responder.<br>
                ID de transacción: ${culqi_id || order_id} | ${new Date().toLocaleDateString('es-PE')}
            </div>
        </div>
        
    </div>
</body>
</html>
  `;
  
  // Texto plano (IGUAL)
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
© ${new Date().getFullYear()} Goldinfiniti Tech Corp.
----------------------------------------
  `;
  
  return { html, text };
}

// ========================
// 6. GENERACIÓN DE PDF - VERSIÓN ULTRA-FINA 1 PÁGINA
// ========================
// ========================
// 6. GENERACIÓN DE PDF - VERSIÓN ULTRA-FINA 1 PÁGINA (FIX PROFESIONAL)
// ========================
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

      // ================= FECHA =================
      let fechaOrden;
      if (fecha_creacion?.seconds) fechaOrden = new Date(fecha_creacion.seconds * 1000);
      else if (fecha_creacion?._seconds) fechaOrden = new Date(fecha_creacion._seconds * 1000);
      else if (typeof fecha_creacion === 'string') fechaOrden = new Date(fecha_creacion);
      else if (typeof fecha_creacion === 'number') fechaOrden = new Date(fecha_creacion < 10000000000 ? fecha_creacion * 1000 : fecha_creacion);
      else fechaOrden = new Date();

      if (fechaOrden.getFullYear() === 1970) fechaOrden = new Date();

      const fechaFormateada = new Intl.DateTimeFormat('es-PE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Lima'
      }).format(fechaOrden);

      const horaFormateada = new Intl.DateTimeFormat('es-PE', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Lima'
      }).format(fechaOrden);

      // ================= PDF =================
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Comprobante ${order_id}`,
          Author: 'Goldinfiniti',
          Subject: 'Comprobante de compra'
        }
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          filename: `comprobante-${order_id}.pdf`,
          content: buffer.toString('base64'),
          contentType: 'application/pdf'
        });
      });

      // ================= CONTROL VERTICAL =================
      const pageHeight = doc.page.height;
      const maxY = pageHeight - 70;
      let currentY = 40;

      const canFit = h => currentY + h <= maxY;

      // ================= HEADER =================
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#000')
        .text('GOLDINFINITI', 40, currentY);

      doc.font('Helvetica').fontSize(9).fillColor('#666')
        .text('E-COMMERCE PREMIUM', 40, currentY + 24);

      doc.moveTo(40, currentY + 45)
        .lineTo(doc.page.width - 40, currentY + 45)
        .strokeColor('#e0e0e0')
        .lineWidth(1)
        .stroke();

      currentY += 65;

      // ================= INFO =================
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#000')
        .text('COMPROBANTE DE COMPRA', 40, currentY);

      doc.fontSize(9).fillColor('#10b981')
        .text('PAGO CONFIRMADO', 40, currentY + 18);

      currentY += 40;

      doc.fontSize(8).font('Helvetica').fillColor('#666');
      doc.text('NÚMERO:', 40, currentY);
      doc.font('Helvetica-Bold').fillColor('#000').text(order_id, 100, currentY);

      doc.font('Helvetica').fillColor('#666').text('FECHA:', 40, currentY + 12);
      doc.fillColor('#000').text(fechaFormateada, 100, currentY + 12);

      doc.fillColor('#666').text('HORA:', 40, currentY + 24);
      doc.fillColor('#000').text(horaFormateada, 100, currentY + 24);

      doc.fillColor('#666').text('CLIENTE:', 300, currentY);
      doc.fillColor('#000').font('Helvetica-Bold')
        .text(`${cliente.nombre} ${cliente.apellido}`, 360, currentY, { width: 200 });

      doc.font('Helvetica').fillColor('#666').text('EMAIL:', 300, currentY + 12);
      doc.fillColor('#000').text(cliente.email, 360, currentY + 12, { width: 200 });

      doc.fillColor('#666').text('TELÉFONO:', 300, currentY + 24);
      doc.fillColor('#000').text(cliente.telefono || 'No especificado', 360, currentY + 24);

      currentY += 50;

      // ================= TABLA =================
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
        .text('PRODUCTOS', 40, currentY);

      currentY += 15;

      const colWidths = [230, 50, 80, 80];
      const colX = [40, 270, 320, 400];

      doc.fontSize(7).fillColor('#666');

      doc.text('DESCRIPCIÓN', colX[0] + 5, currentY, { width: colWidths[0] - 10 });
      doc.text('CANT.', colX[1] + 5, currentY, { width: colWidths[1] - 10, align: 'center' });
      doc.text('PRECIO', colX[2] + 5, currentY, { width: colWidths[2] - 10, align: 'right' });
      doc.text('TOTAL', colX[3] + 5, currentY, { width: colWidths[3] - 10, align: 'right' });

      doc.moveTo(40, currentY + 9)
        .lineTo(colX[3] + colWidths[3], currentY + 9)
        .lineWidth(0.3)
        .strokeColor('#e0e0e0')
        .stroke();

      currentY += 15;

      productos.forEach((p, i) => {
        if (!canFit(14)) return;

        const nombre = (p.nombre || p.titulo || `Producto ${i + 1}`).slice(0, 45);
        const cantidad = p.cantidad || p.quantity || 1;
        const precio = p.precio || p.precioOriginal || 0;
        const total = p.subtotal || cantidad * precio;

        doc.fontSize(8).font('Helvetica').fillColor('#000');
        doc.text(nombre, colX[0] + 5, currentY, { width: colWidths[0] - 10 });
        doc.text(String(cantidad), colX[1] + 5, currentY, { width: colWidths[1] - 10, align: 'center' });
        doc.text(`S/ ${precio.toFixed(2)}`, colX[2] + 5, currentY, { width: colWidths[2] - 10, align: 'right' });

        doc.font('Helvetica-Bold')
          .text(`S/ ${total.toFixed(2)}`, colX[3] + 5, currentY, { width: colWidths[3] - 10, align: 'right' });

        currentY += 12;
      });

      // ================= RESUMEN =================
      const boxW = 180;
      const boxX = doc.page.width - boxW - 40;

      if (canFit(75)) {
        doc.rect(boxX, currentY, boxW, 75).fill('#f9fafb').stroke('#e5e7eb');

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
          .text('RESUMEN DE PAGO', boxX + 10, currentY + 8);

        let y = currentY + 28;

        doc.font('Helvetica').fontSize(8).fillColor('#666');
        doc.text('Subtotal:', boxX + 10, y);
        doc.text(`S/ ${resumen.subtotal.toFixed(2)}`, boxX + boxW - 20, y, { align: 'right' });

        y += 12;

        if (envio.costo > 0) {
          doc.text('Envío:', boxX + 10, y);
          doc.text(`S/ ${envio.costo.toFixed(2)}`, boxX + boxW - 20, y, { align: 'right' });
          y += 12;
        }

        doc.moveTo(boxX + 10, y).lineTo(boxX + boxW - 10, y).stroke('#d1d5db');

        y += 8;

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#10b981');
        doc.text(`TOTAL: S/ ${resumen.total.toFixed(2)}`, boxX + 10, y);
      }

      // ================= FOOTER FIJO =================
      const footerY = doc.page.height - 35;
      doc.fontSize(6).fillColor('#9ca3af');

      doc.text(
        'Este documento es su comprobante oficial de compra.',
        40,
        footerY,
        { width: doc.page.width - 80, align: 'center' }
      );

      doc.text(
        `Goldinfiniti • ${order_id} • ${new Date().toLocaleDateString('es-PE')}`,
        40,
        footerY + 10,
        { width: doc.page.width - 80, align: 'center' }
      );

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}
// ========================
// 7. FUNCIÓN DE NOTIFICACIÓN INTERNA (MANTENER IGUAL)
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
    
    // HTML de productos (MANTENER IGUAL)
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
            
            <!-- 🚚 INFORMACIÓN DE ENVÍO (MANTENER IGUAL) -->
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

<!-- 📞 Información de contacto (MANTENER IGUAL) -->
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
// 8. FUNCIONES DE UTILIDAD (EXACTO IGUAL)
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
// 9. EXPORTACIÓN COMPLETA (EXACTO IGUAL)
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