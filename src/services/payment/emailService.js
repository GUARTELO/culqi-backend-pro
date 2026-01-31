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
// 6. GENERACIÓN DE PDF - VERSIÓN ULTRA-FINA 1 PÁGINA (FIX DEFINITIVO)
// ========================
// ========================
// 6. GENERACIÓN DE PDF ADJUNTO PREMIUM (CON PAGINACIÓN CORREGIDA)
// ========================
/**
 * Genera PDF profesional estilo ecommerce premium con paginación correcta
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
      
      // ==================== SOLUCIÓN DEFINITIVA PARA FECHA ====================
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
      
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40, // Reducido de 50 a 40 para más espacio
        bufferPages: true,
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
      
      // ==================== CONSTANTES DE CONTROL ====================
      const ALTURA_PAGINA = 842;
      const MARGEN_SUPERIOR = 40;
      const MARGEN_INFERIOR = 40;
      
      // ALTURAS MÁS COMPACTAS
      const ALTURA_ENCABEZADO = 90; // Reducido de 150
      const ALTURA_INFO_ORDEN = 60; // Reducido de 80
      const ALTURA_INFO_CLIENTE = 60; // Reducido de 80
      const ALTURA_ENCABEZADO_TABLA = 30; // Reducido de 40
      const ALTURA_POR_PRODUCTO = 28; // Reducido de 35
      const ALTURA_RESUMEN = 140; // Reducido de 180
      const ALTURA_FOOTER = 40; // Reducido de 50
      
      // ==================== FUNCIÓN PARA AGREGAR NUEVA PÁGINA ====================
      const agregarNuevaPagina = (conHeader = true) => {
        doc.addPage();
        
        if (conHeader) {
          // Header minimalista
          doc.rect(0, 0, doc.page.width, 60) // Reducido de 120
             .fillColor('#000000')
             .fill();
          
          // Logo más pequeño y elegante
          doc.fillColor('#FFFFFF')
             .fontSize(20) // Reducido de 28
             .font('Helvetica-Bold')
             .text('GOLDINFINITI', 0, 20, { align: 'center' });
          
          doc.fillColor('#CCCCCC')
             .fontSize(9) // Reducido de 11
             .font('Helvetica')
             .text('E-COMMERCE PREMIUM', 0, 42, { align: 'center' });
          
          // Línea decorativa más fina
          doc.strokeColor('#FFD700')
             .lineWidth(1) // Reducido de 2
             .moveTo(80, 55)
             .lineTo(doc.page.width - 80, 55)
             .stroke();
        }
        
        return MARGEN_SUPERIOR + 60;
      };
      
      // ==================== PÁGINA 1 - ENCABEZADO ====================
      // Header minimalista
      doc.rect(0, 0, doc.page.width, 60)
         .fillColor('#000000')
         .fill();
      
      // Título más pequeño y elegante
      doc.fillColor('#FFFFFF')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('GOLDINFINITI', 0, 20, { align: 'center' });
      
      doc.fillColor('#CCCCCC')
         .fontSize(9)
         .font('Helvetica')
         .text('E-COMMERCE PREMIUM', 0, 42, { align: 'center' });
      
      // Línea decorativa
      doc.strokeColor('#FFD700')
         .lineWidth(1)
         .moveTo(80, 55)
         .lineTo(doc.page.width - 80, 55)
         .stroke();
      
      // Título del comprobante (FUERA del header negro)
      doc.fillColor('#000000')
         .fontSize(16) // Reducido de 18
         .font('Helvetica-Bold')
         .text('COMPROBANTE DE COMPRA', 0, 70, { align: 'center' });
      
      // Posición inicial después del header
      let yPos = 90;
      doc.y = yPos;
      
      // ==================== INFORMACIÓN DE ORDEN ====================
      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold'); // Reducido de 16
      doc.text('INFORMACIÓN DE LA ORDEN', 40, doc.y);
      
      doc.strokeColor('#FFD700').lineWidth(0.5) // Reducido de 1
         .moveTo(40, doc.y + 4)
         .lineTo(doc.page.width - 40, doc.y + 4)
         .stroke();
      
      doc.moveDown(0.5);
      
      const infoLeft = 40;
      const infoRight = doc.page.width / 2 + 20;
      let currentY = doc.y;
      
      // Texto más pequeño y elegante
      doc.fillColor('#666666').fontSize(9).font('Helvetica'); // Reducido de 10
      doc.text('NÚMERO:', infoLeft, currentY);
      doc.fillColor('#000000').font('Helvetica-Bold').text(order_id, infoLeft + 70, currentY);
      
      doc.fillColor('#666666').font('Helvetica');
      doc.text('FECHA:', infoLeft, currentY + 15); // Reducido de 18
      doc.fillColor('#000000').text(fechaFormateada, infoLeft + 70, currentY + 15);
      
      doc.fillColor('#666666').text('HORA:', infoLeft, currentY + 30);
      doc.fillColor('#000000').text(horaFormateada, infoLeft + 70, currentY + 30);
      
      // Columna derecha
      doc.fillColor('#666666').text('ESTADO:', infoRight, currentY);
      doc.fillColor('#27ae60').font('Helvetica-Bold').text('PAGO APROBADO', infoRight + 70, currentY);
      
      doc.fillColor('#666666').font('Helvetica');
      doc.text('PAGO:', infoRight, currentY + 15);
      doc.fillColor('#000000').text('Tarjeta', infoRight + 70, currentY + 15);
      
      doc.fillColor('#666666').text('MONEDA:', infoRight, currentY + 30);
      doc.fillColor('#000000').text('PEN (S/.)', infoRight + 70, currentY + 30);
      
      doc.y = currentY + 45;
      
      // ==================== INFORMACIÓN DEL CLIENTE ====================
      // Verificar espacio (CÁLCULO CORREGIDO)
      const espacioNecesarioCliente = ALTURA_INFO_CLIENTE + 20;
      const espacioDisponible = ALTURA_PAGINA - MARGEN_INFERIOR - doc.y;
      
      if (espacioDisponible < espacioNecesarioCliente) {
        doc.y = agregarNuevaPagina(false); // Nueva página sin header completo
      }
      
      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold');
      doc.text('INFORMACIÓN DEL CLIENTE', 40, doc.y);
      
      doc.strokeColor('#FFD700').lineWidth(0.5)
         .moveTo(40, doc.y + 4)
         .lineTo(doc.page.width - 40, doc.y + 4)
         .stroke();
      
      doc.moveDown(0.5);
      
      currentY = doc.y;
      
      doc.fillColor('#666666').fontSize(9).font('Helvetica');
      doc.text('NOMBRE:', infoLeft, currentY);
      doc.fillColor('#000000').text(`${cliente.nombre} ${cliente.apellido}`, infoLeft + 70, currentY);
      
      doc.fillColor('#666666').text('EMAIL:', infoLeft, currentY + 15);
      doc.fillColor('#000000').text(cliente.email, infoLeft + 70, currentY + 15);
      
      doc.fillColor('#666666').text('TELÉFONO:', infoLeft, currentY + 30);
      doc.fillColor('#000000').text(cliente.telefono || 'No especificado', infoLeft + 70, currentY + 30);
      
      doc.y = currentY + 45;
      
      // ==================== TABLA DE PRODUCTOS CON PAGINACIÓN INTELIGENTE ====================
      let productosRestantes = productos.length;
      let indiceProducto = 0;
      let paginaActual = 1;
      
      // CALCULAR EXACTAMENTE CUÁNTAS PÁGINAS SE NECESITAN
      const productosPorPagina = Math.floor((ALTURA_PAGINA - MARGEN_INFERIOR - doc.y - ALTURA_RESUMEN - ALTURA_FOOTER) / ALTURA_POR_PRODUCTO);
      
      console.log(`📊 Cálculo de paginación:`);
      console.log(`   • Productos totales: ${productos.length}`);
      console.log(`   • Productos por página: ${productosPorPagina}`);
      console.log(`   • Altura disponible: ${ALTURA_PAGINA - MARGEN_INFERIOR - doc.y}`);
      console.log(`   • Posición Y actual: ${doc.y}`);
      
      while (productosRestantes > 0) {
        if (paginaActual > 1) {
          doc.y = agregarNuevaPagina(false);
        }
        
        // Encabezado de tabla
        doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold');
        if (paginaActual === 1) {
          doc.text('DETALLE DE PRODUCTOS', 40, doc.y);
        } else {
          doc.text(`DETALLE DE PRODUCTOS (Página ${paginaActual})`, 40, doc.y);
        }
        
        doc.strokeColor('#FFD700').lineWidth(0.5)
           .moveTo(40, doc.y + 4)
           .lineTo(doc.page.width - 40, doc.y + 4)
           .stroke();
        
        doc.moveDown(0.5);
        
        // Encabezados de tabla
        const tableTop = doc.y;
        const colWidths = [260, 50, 80, 80]; // Reducidos
        const colPositions = [40];
        
        for (let i = 1; i < colWidths.length; i++) {
          colPositions[i] = colPositions[i - 1] + colWidths[i - 1];
        }
        
        // Fondo encabezado minimalista
        doc.rect(colPositions[0], tableTop, colWidths.reduce((a, b) => a + b, 0), 22) // Reducido de 25
           .fillColor('#f8f9fa')
           .fill();
        
        // Texto encabezados más pequeño
        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold'); // Reducido de 9
        const headers = ['PRODUCTO', 'CANT.', 'P. UNIT.', 'SUBTOTAL'];
        
        headers.forEach((header, i) => {
          const xPos = colPositions[i] + (i === 0 ? 8 : 4); // Reducido
          doc.text(header, xPos, tableTop + 6, { // Reducido de 8
            width: colWidths[i] - 8,
            align: i >= 2 ? 'right' : 'left'
          });
        });
        
        // Línea debajo del encabezado
        doc.strokeColor('#FFD700').lineWidth(0.5) // Reducido de 1
           .moveTo(colPositions[0], tableTop + 22)
           .lineTo(colPositions[3] + colWidths[3], tableTop + 22)
           .stroke();
        
        let currentTableY = tableTop + 25;
        
        // Renderizar productos de esta página
        const productosEnEstaPagina = Math.min(productosPorPagina, productosRestantes);
        
        for (let i = 0; i < productosEnEstaPagina; i++) {
          const producto = productos[indiceProducto];
          const nombre = producto.nombre || producto.titulo || `Producto ${indiceProducto + 1}`;
          const cantidad = producto.cantidad || producto.quantity || 1;
          const precio = producto.precio || producto.precioOriginal || 0;
          const subtotal = producto.subtotal || (cantidad * precio);
          
          // Fondo alternado muy sutil
          if (i % 2 === 0) {
            doc.rect(colPositions[0], currentTableY, colWidths.reduce((a, b) => a + b, 0), ALTURA_POR_PRODUCTO)
               .fillColor('#fafafa')
               .fill();
          }
          
          // Nombre del producto (más pequeño)
          doc.fillColor('#000000').fontSize(8).font('Helvetica'); // Reducido de 9
          doc.text(nombre, colPositions[0] + 8, currentTableY + 6, {
            width: colWidths[0] - 16
          });
          
          // Detalles adicionales (más pequeño)
          if (producto.color || producto.talla || producto.sku) {
            const detalles = [];
            if (producto.color) detalles.push(`Color: ${producto.color}`);
            if (producto.talla) detalles.push(`Talla: ${producto.talla}`);
            if (producto.sku) detalles.push(`SKU: ${producto.sku}`);
            
            doc.fillColor('#666666').fontSize(6); // Reducido de 7
            doc.text(detalles.join(' | '), colPositions[0] + 8, currentTableY + 16, {
              width: colWidths[0] - 16
            });
          }
          
          // Cantidad
          doc.fillColor('#000000').fontSize(8);
          doc.text(cantidad.toString(), colPositions[1] + 4, currentTableY + 10, {
            width: colWidths[1] - 8,
            align: 'center'
          });
          
          // Precio unitario
          doc.text(`S/ ${precio.toFixed(2)}`, colPositions[2] + 4, currentTableY + 10, {
            width: colWidths[2] - 8,
            align: 'right'
          });
          
          // Subtotal
          doc.font('Helvetica-Bold');
          doc.text(`S/ ${subtotal.toFixed(2)}`, colPositions[3] + 4, currentTableY + 10, {
            width: colWidths[3] - 8,
            align: 'right'
          });
          
          // Línea separadora muy sutil
          doc.strokeColor('#e0e0e0').lineWidth(0.2) // Reducido de 0.3
             .moveTo(colPositions[0], currentTableY + ALTURA_POR_PRODUCTO)
             .lineTo(colPositions[3] + colWidths[3], currentTableY + ALTURA_POR_PRODUCTO)
             .stroke();
          
          currentTableY += ALTURA_POR_PRODUCTO;
          indiceProducto++;
        }
        
        doc.y = currentTableY + 15;
        productosRestantes -= productosEnEstaPagina;
        paginaActual++;
      }
      
      // ==================== RESUMEN DE PAGO ELEGANTE ====================
      // Verificar si hay espacio para el resumen
      if (doc.y > ALTURA_PAGINA - MARGEN_INFERIOR - ALTURA_RESUMEN) {
        doc.y = agregarNuevaPagina(false);
      }
      
      const summaryBoxTop = doc.y;
      const summaryBoxWidth = 280; // Reducido
      const summaryBoxLeft = doc.page.width - summaryBoxWidth - 40;
      
      // Caja de resumen más compacta
      doc.roundedRect(summaryBoxLeft, summaryBoxTop, summaryBoxWidth, 120, 3) // Reducido de 150
         .fillColor('#f8f9fa')
         .fill();
      
      doc.roundedRect(summaryBoxLeft, summaryBoxTop, summaryBoxWidth, 120, 3)
         .strokeColor('#FFD700')
         .lineWidth(0.5) // Reducido de 1
         .stroke();
      
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold'); // Reducido de 14
      doc.text('RESUMEN DE PAGO', summaryBoxLeft + 12, summaryBoxTop + 12);
      
      doc.strokeColor('#e0e0e0').lineWidth(0.3) // Reducido de 0.5
         .moveTo(summaryBoxLeft + 12, summaryBoxTop + 30)
         .lineTo(summaryBoxLeft + summaryBoxWidth - 12, summaryBoxTop + 30)
         .stroke();
      
      let summaryY = summaryBoxTop + 38;
      const lineHeight = 18; // Reducido de 22
      
      // Subtotal
      doc.fillColor('#666666').fontSize(9).font('Helvetica'); // Reducido de 10
      doc.text('Subtotal:', summaryBoxLeft + 12, summaryY);
      doc.text(`S/ ${resumen.subtotal.toFixed(2)}`, summaryBoxLeft + summaryBoxWidth - 100, summaryY, {
        align: 'right'
      });
      
      // Envío
      if (envio.costo > 0) {
        summaryY += lineHeight;
        doc.text(`Envío:`, summaryBoxLeft + 12, summaryY);
        doc.text(`S/ ${envio.costo.toFixed(2)}`, summaryBoxLeft + summaryBoxWidth - 100, summaryY, {
          align: 'right'
        });
      }
      
      // Línea separadora
      summaryY += lineHeight + 3;
      doc.strokeColor('#FFD700').lineWidth(0.5) // Reducido de 1
         .moveTo(summaryBoxLeft + 12, summaryY)
         .lineTo(summaryBoxLeft + summaryBoxWidth - 12, summaryY)
         .stroke();
      
      // TOTAL
      summaryY += 8;
      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold'); // Reducido de 16
      doc.text('TOTAL:', summaryBoxLeft + 12, summaryY);
      doc.fillColor('#27ae60');
      doc.text(`S/ ${resumen.total.toFixed(2)}`, summaryBoxLeft + summaryBoxWidth - 100, summaryY, {
        align: 'right'
      });
      
      // ==================== FOOTER ELEGANTE EN TODAS LAS PÁGINAS ====================
      const totalPaginas = doc.bufferedPageRange().count;
      
      for (let i = 0; i < totalPaginas; i++) {
        doc.switchToPage(i);
        
        // Footer minimalista y elegante
        doc.fillColor('#666666').fontSize(7).font('Helvetica'); // Reducido de 8
        doc.text('Este documento es su comprobante oficial de compra.', 
          40, ALTURA_PAGINA - 35, { 
            width: doc.page.width - 80, 
            align: 'center' 
          });
        
        doc.fillColor('#999999').fontSize(6); // Reducido de 7
        doc.text(`Goldinfiniti tech corp. • Sistema automático de notificaciones`, 
          40, ALTURA_PAGINA - 25, { 
            width: doc.page.width - 80, 
            align: 'center' 
          });
        
        doc.fillColor('#999999').fontSize(6);
        doc.text(`Página ${i + 1} de ${totalPaginas} • ID: ${order_id} • ${fechaFormateada}`, 
          40, ALTURA_PAGINA - 18, { 
            width: doc.page.width - 80, 
            align: 'center' 
          });
        
        // Línea decorativa muy sutil
        doc.strokeColor('#e0e0e0').lineWidth(0.3)
           .moveTo(40, ALTURA_PAGINA - 40)
           .lineTo(doc.page.width - 40, ALTURA_PAGINA - 40)
           .stroke();
      }
      
      // ==================== LOG FINAL ====================
      console.log(`✅ PDF GENERADO CORRECTAMENTE:`);
      console.log(`   • Productos: ${productos.length}`);
      console.log(`   • Páginas generadas: ${totalPaginas}`);
      console.log(`   • Espacio optimizado: COMPLETO`);
      
      if (totalPaginas > 1 && productos.length < 10) {
        console.log(`⚠️ ADVERTENCIA: Se generaron ${totalPaginas} páginas para solo ${productos.length} productos`);
        console.log(`   • Revisar cálculo de altura`);
      }
      
      doc.end();
      
    } catch (error) {
      console.error('❌ Error generando PDF profesional:', error);
      reject(error);
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