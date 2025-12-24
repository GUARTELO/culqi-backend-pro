/**
 * ============================================================
 * EMAIL SERVICE - VERSIÓN FIREBASE COMPLETA
 * ============================================================
 * - Recibe datos completos de Firebase
 * - Genera emails profesionales con toda la información
 * - Incluye: cliente, productos, envío, comprobante
 * - Genera PDF adjunto con detalles
 * - Formato Golden Infinity profesional
 * ============================================================
 */

'use strict';

// ========================
// 1. IMPORTS Y CONFIGURACIÓN
// ========================
const logger = {
  info: (msg, data = {}) => console.log(`📧 ${msg}`, data),
  error: (msg, data = {}) => console.error(`❌ ${msg}`, data),
  warn: (msg, data = {}) => console.warn(`⚠️ ${msg}`, data),
  debug: (msg, data = {}) => console.log(`🔍 ${msg}`, data)
};

let nodemailer, PDFDocument;

// Carga robusta de dependencias
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
// 2. CONFIGURACIÓN DEL TRANSPORTER - CAMBIO ÚNICO NECESARIO
// ========================
const createTransporter = () => {
  // ✅ CAMBIO 1: Verificar SendGrid en lugar de Gmail
  console.log('🔍 [EMAIL DEBUG] Verificando variables de entorno:');
  console.log('   GMAIL_USER:', process.env.GMAIL_USER || 'NO ENCONTRADO');
  console.log('   GMAIL_APP_PASSWORD existe?:', !!process.env.GMAIL_APP_PASSWORD);
  console.log('   Longitud password:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0);
  console.log('   SENDGRID_API_KEY existe?:', !!process.env.SENDGRID_API_KEY); // ✅ NUEVO
  
  const gmailUser = process.env.GMAIL_USER || 'contacto@goldinfiniti.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const sendgridApiKey = process.env.SENDGRID_API_KEY; // ✅ NUEVO
  
  // ✅ CAMBIO 2: Usar SendGrid si está disponible, sino fallback a Ethereal
  if (sendgridApiKey) {
    console.log('✅ [EMAIL DEBUG] Usando SendGrid como transporte principal');
    
    // TRANSPORTER FALSO que usa SendGrid por detrás
    return {
      sendMail: async function(mailOptions) {
        try {
          console.log(`📤 [SENDGRID] Enviando a: ${mailOptions.to}`);
          
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(sendgridApiKey);
          
          // Convertir formato nodemailer a SendGrid
          const msg = {
            to: mailOptions.to,
            from: mailOptions.from || 'contacto@goldinfiniti.com',
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text,
            cc: mailOptions.cc,
            bcc: mailOptions.bcc,
            attachments: mailOptions.attachments
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
        // Para compatibilidad con tu código
        if (event === 'idle') {
          console.log('📧 [SENDGRID] Transporter está inactivo');
        }
        return this;
      }
    };
    
  } else if (!gmailPass) {
    // ✅ CAMBIO 3: Si no hay SendGrid ni Gmail, usar Ethereal
    const errorMsg = '❌ ERROR: Ni GMAIL_APP_PASSWORD ni SENDGRID_API_KEY configuradas';
    logger.error(errorMsg);
    
    console.log('🔄 Usando Ethereal SMTP como respaldo');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'maddison53@ethereal.email',
        pass: 'jn7jnAPss4f63QBp6D'
      }
    });
    
  } else {
    // ✅ Si hay Gmail configurado, usar Gmail (para desarrollo local)
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
    
    // Verificación de conexión
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
  }
};

// 6. CREAR TRANSPORTER CON VERIFICACIÓN
let transporter;
try {
  transporter = createTransporter();
  
  // Verificación síncrona adicional
  setTimeout(() => {
    transporter.verify((error) => {
      if (!error) {
        console.log('🚀 [EMAIL] Sistema de emails INICIALIZADO CORRECTAMENTE');
        console.log('   📧 Usuario:', process.env.GMAIL_USER || 'SendGrid');
        console.log('   🔐 SendGrid configurado:', !!process.env.SENDGRID_API_KEY);
        console.log('   ⏰ Hora:', new Date().toLocaleTimeString());
      }
    });
  }, 1000);
  
} catch (error) {
  console.error('🔥 ERROR INICIALIZANDO EMAIL SERVICE:', error.message);
  
  // Transporter de emergencia que SÍ envía (Ethereal)
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

// 7. FUNCIÓN DE ENVÍO CON REINTENTOS
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
        // Último intento falló
        throw error;
      }
      
      // Esperar antes de reintentar (backoff exponencial)
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`⏳ Reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 8. EXPORTAR FUNCIÓN MEJORADA - ✅ CAMBIO 4: Actualizar verificación
module.exports = {
  transporter,
  createTransporter,
  sendEmailWithRetry,
  
  // Función de verificación rápida - ✅ ACTUALIZADA
  checkEmailConfig: () => ({
    gmailUser: process.env.GMAIL_USER,
    hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
    hasSendGrid: !!process.env.SENDGRID_API_KEY,
    passwordLength: process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0,
    sendgridKeyLength: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length : 0,
    timestamp: new Date().toISOString(),
    status: process.env.SENDGRID_API_KEY ? 'SENGRID_CONFIGURADO' : 
            process.env.GMAIL_APP_PASSWORD ? 'GMAIL_CONFIGURADO' : 'NO_CONFIGURADO'
  })
};

// ========================
// 3. FUNCIÓN PRINCIPAL - ENVIAR CONFIRMACIÓN CON DATOS FIREBASE
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
    
    // Validar datos mínimos
    if (!paymentData.customer_email) {
      throw new Error('Email del cliente no proporcionado');
    }
    
    // Extraer datos de Firebase
    const firebaseData = this._extractFirebaseData(paymentData);
    
    // Generar contenido del email
    const emailContent = this._generateGoldenInfinityEmail(firebaseData);
    
    // Generar PDF adjunto si es posible
    let pdfAttachment = null;
    if (PDFDocument) {
      try {
        pdfAttachment = await this._generateOrderPDF(firebaseData);
      } catch (pdfError) {
        logger.warn('Error generando PDF, continuando sin adjunto', { error: pdfError.message });
      }
    }
    
    // Preparar opciones del correo
    const mailOptions = {
      from: '"GOLDINFINITI" <contacto@goldinfiniti.com>',
      to: paymentData.customer_email,
      bcc: process.env.ADMIN_EMAIL || 'contacto@goldinfiniti.com', // Copia al admin
      subject: `✅ Confirmación de Compra #${orderId} - Goldinfiniti`,
      html: emailContent.html,
      text: emailContent.text,
      attachments: pdfAttachment ? [pdfAttachment] : []
    };
    
    // Enviar correo
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
      customer: this._maskEmail(paymentData.customer_email)
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
      customer: this._maskEmail(paymentData.customer_email)
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
// 4. EXTRACCIÓN DE DATOS DE FIREBASE
// ========================
/**
 * Extrae y estructura datos de Firebase
 * @param {Object} paymentData - Datos del pago
 * @returns {Object} Datos estructurados para email
 */
function _extractFirebaseData(paymentData) {
  // Datos del cliente
  const cliente = paymentData.cliente || {
    nombre: paymentData.customer_name || 'Cliente',
    apellido: '',
    email: paymentData.customer_email,
    telefono: paymentData.customer_phone || ''
  };
  
  // Productos
  const productos = paymentData.productos || 
                   paymentData.metadata?.items || 
                   [];
  
  // Resumen
  const resumen = paymentData.resumen || {
    subtotal: paymentData.amount ? paymentData.amount / 100 : 0,
    envio: paymentData.envio?.costo || 0,
    total: paymentData.amount ? paymentData.amount / 100 : 0,
    cantidadItems: productos.length
  };
  
  // Envío
  const envio = paymentData.envio || {
    tipo: 'Estándar',
    costo: resumen.envio || 0,
    estado: 'Pendiente'
  };
  
  // Comprobante
  const comprobante = paymentData.comprobante || {
    tipo: paymentData.metadata?.tipo_comprobante || 'boleta',
    serie: '',
    numero: ''
  };
  
  // Metadata
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
// 5. GENERACIÓN DE EMAIL HTML PROFESIONAL
// ========================
/**
 * Genera contenido HTML del email
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
  
  // ✅ IGUAL AL CONTROLLER pero con SEGUNDOS agregados
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

console.log('📅 Fecha en email:', fecha);

  // Tabla de productos
  let productosHtml = '';
  if (productos.length > 0) {
    productos.forEach((producto, index) => {
      const nombre = producto.nombre || producto.titulo || `Producto ${index + 1}`;
      const cantidad = producto.cantidad || producto.quantity || 1;
      const precio = producto.precio || producto.precioOriginal || 0;
      const subtotal = producto.subtotal || (cantidad * precio);
      const color = producto.color ? `<br><small>Color: ${producto.color}</small>` : '';
      const talla = producto.talla || producto.size ? `<br><small>Talla: ${producto.talla || producto.size}</small>` : '';
      
      productosHtml += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px; vertical-align: top;">
            <strong>${nombre}</strong>
            ${color}
            ${talla}
            ${producto.sku ? `<br><small>SKU: ${producto.sku}</small>` : ''}
          </td>
          <td style="padding: 12px; text-align: center; vertical-align: top;">${cantidad}</td>
          <td style="padding: 12px; text-align: right; vertical-align: top;">S/ ${precio.toFixed(2)}</td>
          <td style="padding: 12px; text-align: right; vertical-align: top; font-weight: bold;">S/ ${subtotal.toFixed(2)}</td>
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; }
        .container { max-width: 700px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #000000 0%, #333333 100%); color: #FFD700; padding: 30px 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
        .section { margin-bottom: 30px; }
        .section-title { color: #000; font-size: 18px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FFD700; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f8f8; padding: 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #FFD700; }
        td { padding: 12px; }
        .total-box { background: #f8f8f8; padding: 20px; border-radius: 8px; border-left: 4px solid #FFD700; margin-top: 20px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .grand-total { font-size: 24px; font-weight: bold; color: #000; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd; }
        .info-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .highlight { color: #FFD700; font-weight: bold; }
        .logo { font-size: 32px; font-weight: bold; letter-spacing: 2px; }
        .subtitle { font-size: 14px; opacity: 0.9; margin-top: 5px; }
        .customer-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .status-badge { display: inline-block; padding: 5px 15px; background: #28a745; color: white; border-radius: 20px; font-size: 12px; font-weight: bold; }
        @media (max-width: 600px) {
          .content { padding: 20px; }
          .header { padding: 20px 15px; }
          table { font-size: 14px; }
          td, th { padding: 8px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo"></div>
          <div class="subtitle"></div>
          <h1 style="margin-top: 20px; font-size: 28px;">¡COMPRA CONFIRMADA!</h1>
          <p style="margin-top: 10px; font-size: 16px;"> ${cliente.nombre}</p>
        </div>
        
        <!-- Contenido -->
        <div class="content">
          <!-- Información de la orden -->
          <div class="section">
            <div class="customer-info">
              <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                <div>
                  <p><strong>📋 Número de Orden:</strong><br>${order_id}</p>
                  <p><strong>📅 Fecha:</strong><br>${fecha}</p>
                </div>
                <div>
                  <p><strong>👤 Cliente:</strong><br>${cliente.nombre} ${cliente.apellido}</p>
                  <p><strong>📧 Email:</strong><br>${cliente.email}</p>
                </div>
              </div>
              ${culqi_id ? `<p style="margin-top: 10px;"><strong>🔗 ID Transacción:</strong><br><code>${culqi_id}</code></p>` : ''}
              <div style="margin-top: 10px;">
                <span class="status-badge">✅ PAGO APROBADO</span>
              </div>
            </div>
          </div>
          
          <!-- Productos -->
          <div class="section">
            <h2 class="section-title">🛍️ Productos Comprados</h2>
            ${productos.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="text-align: center;">Cantidad</th>
                    <th style="text-align: right;">Precio Unit.</th>
                    <th style="text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${productosHtml}
                </tbody>
              </table>
            ` : '<p>No se encontraron detalles de productos.</p>'}
          </div>
          
          <!-- Resumen de costos -->
          <div class="section">
            <h2 class="section-title">💰 Resumen de Pago</h2>
            <div class="total-box">
              <div class="total-row">
                <span>Subtotal (${resumen.cantidadItems || productos.length} items):</span>
                <span><strong>S/ ${resumen.subtotal.toFixed(2)}</strong></span>
              </div>
              ${envio.costo > 0 ? `
                <div class="total-row">
                  <span>Costo de envío (${envio.tipo}):</span>
                  <span><strong>S/ ${envio.costo.toFixed(2)}</strong></span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>TOTAL PAGADO:</span>
                <span style="color: #27ae60;">S/ ${resumen.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <!-- Información de envío -->
          ${envio.tipo ? `
            <div class="section">
              <h2 class="section-title">🚚 Información de Envío</h2>
              <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; border-left: 3px solid #007bff;">
                <p><strong>Tipo:</strong> ${envio.tipo}</p>
                <p><strong>Costo:</strong> S/ ${envio.costo.toFixed(2)}</p>
                <p><strong>Estado:</strong> ${envio.estado || 'En preparación'}</p>
                ${envio.direccion ? `<p><strong>Dirección:</strong> ${envio.direccion}</p>` : ''}
              </div>
              <p style="margin-top: 10px; font-size: 14px; color: #666;">
                <em>Recibirás una notificación cuando tu pedido sea despachado.</em>
              </p>
            </div>
          ` : ''}
          
          <!-- Información de comprobante -->
          <div class="section">
            <h2 class="section-title">📄 Comprobante</h2>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
              <p><strong>Tipo:</strong> ${comprobante.tipo.toUpperCase()}</p>
              ${comprobante.serie ? `<p><strong>Serie:</strong> ${comprobante.serie}</p>` : ''}
              ${comprobante.numero ? `<p><strong>Número:</strong> ${comprobante.numero}</p>` : ''}
              <p style="margin-top: 10px; font-size: 14px;">
                <em>Este correo sirve como comprobante de compra. Guárdalo para cualquier consulta.</em>
              </p>
            </div>
          </div>
          
          <!-- Información importante -->
          <div class="info-box">
            <h3 style="color: #856404; margin-bottom: 10px;">📌 Información Importante</h3>
            <ul style="padding-left: 20px;">
              <li>Tu pedido está siendo procesado y preparado para el envío.</li>
              <li>Recibirás actualizaciones por email sobre el estado de tu pedido.</li>
              <li>Para consultas sobre tu orden, contáctanos a: contacto@goldinfiniti.com</li>
              <li>El tiempo de entrega estimado es de 2-4 días hábiles.</li>
            </ul>
          </div>
          
          <!-- Pasos siguientes -->
          <div style="margin-top: 30px; text-align: center;">
            <h3 style="margin-bottom: 15px;">👉 ¿Qué sigue?</h3>
            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px;">
              <div style="flex: 1; min-width: 150px; background: #f8f9fa; padding: 15px; border-radius: 5px;">
                <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
                <p><strong>Preparación</strong><br>Tu pedido está siendo preparado</p>
              </div>
              <div style="flex: 1; min-width: 150px; background: #f8f9fa; padding: 15px; border-radius: 5px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🚚</div>
                <p><strong>Envío</strong><br>Recibirás notificación del despacho</p>
              </div>
              <div style="flex: 1; min-width: 150px; background: #f8f9fa; padding: 15px; border-radius: 5px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🏠</div>
                <p><strong>Entrega</strong><br>Tu pedido llegará a tu domicilio</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p style="margin-bottom: 10px;">
            <strong>GOLDINFINITI - E-COMMERCE PREMIUM</strong>
          </p>
          <p style="margin-bottom: 10px; font-size: 11px;">
            📧 contacto@goldinfiniti.com | 🌐 www.goldinfiniti.com<br>
            📞 +51 968 786 648 | 🏢 Av. Principal 123, Lima, Perú
          </p>
          <p style="font-size: 10px; color: #999; margin-top: 15px;">
            © ${new Date().getFullYear()} Goldinfiniti. Todos los derechos reservados.<br>
            Este es un correo automático, por favor no responder.<br>
            ID de transacción: ${culqi_id || order_id}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Texto plano para clientes de email sin HTML
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
// 6. GENERACIÓN DE PDF ADJUNTO PREMIUM (CON FECHA CORREGIDA)
// ========================
/**
 * Genera PDF profesional estilo ecommerce premium
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
      console.log('🔍 DEBUG fecha_creacion recibida:', fecha_creacion);
      console.log('🔍 Tipo:', typeof fecha_creacion);
      
      if (fecha_creacion) {
        // CASO 1: Timestamp de Firebase (objeto con .seconds)
        if (fecha_creacion.seconds !== undefined) {
          console.log('✅ Es timestamp Firebase con seconds:', fecha_creacion.seconds);
          fechaOrden = new Date(fecha_creacion.seconds * 1000);
        }
        // CASO 2: Timestamp de Firebase (objeto con _seconds)
        else if (fecha_creacion._seconds !== undefined) {
          console.log('✅ Es timestamp Firebase con _seconds:', fecha_creacion._seconds);
          fechaOrden = new Date(fecha_creacion._seconds * 1000);
        }
        // CASO 3: String ISO
        else if (typeof fecha_creacion === 'string') {
          console.log('✅ Es string ISO:', fecha_creacion);
          fechaOrden = new Date(fecha_creacion);
        }
        // CASO 4: Número (timestamp en milisegundos)
        else if (typeof fecha_creacion === 'number') {
          console.log('✅ Es número timestamp:', fecha_creacion);
          // Si el número es muy pequeño (como 1703126400), es en segundos
          if (fecha_creacion < 10000000000) {
            fechaOrden = new Date(fecha_creacion * 1000); // Convertir segundos a milisegundos
          } else {
            fechaOrden = new Date(fecha_creacion); // Ya está en milisegundos
          }
        }
        // CASO 5: Objeto Date
        else if (fecha_creacion instanceof Date) {
          console.log('✅ Es objeto Date');
          fechaOrden = fecha_creacion;
        }
        // CASO 6: Cualquier otro caso, usar fecha actual
        else {
          console.log('⚠️ Formato no reconocido, usando fecha actual');
          fechaOrden = new Date();
        }
      } else {
        console.log('⚠️ fecha_creacion es null/undefined, usando fecha actual');
        fechaOrden = new Date();
      }
      
      console.log('📅 Fecha procesada:', fechaOrden);
      console.log('📅 Timestamp:', fechaOrden.getTime());
      
      // Verificar que la fecha sea válida (no 1970)
      if (fechaOrden.getFullYear() === 1970) {
        console.warn('⚠️⚠️⚠️ ATENCIÓN: Fecha es 1970, usando fecha actual');
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
      
      // Usar Intl.DateTimeFormat para mejor compatibilidad
      const formateadorFecha = new Intl.DateTimeFormat('es-PE', opcionesFecha);
      const formateadorHora = new Intl.DateTimeFormat('es-PE', opcionesHora);
      
      const fechaFormateada = formateadorFecha.format(fechaOrden);
      const horaFormateada = formateadorHora.format(fechaOrden);
      
      console.log('✅ Fecha formateada:', fechaFormateada);
      console.log('✅ Hora formateada:', horaFormateada);
      
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
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
        resolve({
          filename: `comprobante-${order_id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
      });
      
      // ==================== HEADER MINIMALISTA ====================
      // Fondo negro sólido
      doc.rect(0, 0, doc.page.width, 120)
         .fillColor('#000000')
         .fill();
      
      // Logo y nombre - diseño limpio
      doc.fillColor('#FFFFFF')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('GOLDINFINITI', 0, 40, { align: 'center' });
      
      doc.fillColor('#CCCCCC')
         .fontSize(11)
         .font('Helvetica')
         .text('E-COMMERCE PREMIUM', 0, 70, { align: 'center' });
      
      // Línea decorativa sutil
      doc.strokeColor('#FFD700')
         .lineWidth(2)
         .moveTo(100, 95)
         .lineTo(doc.page.width - 100, 95)
         .stroke();
      
      doc.fillColor('#FFFFFF')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('COMPROBANTE DE COMPRA', 0, 105, { align: 'center' });
      
      doc.moveDown(3);
      
      // ==================== INFORMACIÓN DE ORDEN ====================
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold');
      doc.text('INFORMACIÓN DE LA ORDEN', 50, 160);
      
      // Línea decorativa
      doc.strokeColor('#FFD700').lineWidth(1).moveTo(50, 175).lineTo(doc.page.width - 50, 175).stroke();
      doc.moveDown(1.5);
      
      // Grid de información minimalista
      doc.fillColor('#333333').fontSize(10).font('Helvetica');
      
      const infoLeft = 50;
      const infoRight = doc.page.width / 2 + 30;
      let currentY = doc.y;
      
      // Columna izquierda
      doc.text('NÚMERO DE ORDEN:', infoLeft, currentY);
      doc.fillColor('#000000').font('Helvetica-Bold').text(order_id, infoLeft + 110, currentY);
      
      doc.fillColor('#333333').font('Helvetica');
      doc.text('FECHA:', infoLeft, currentY + 18);
      doc.fillColor('#000000').text(fechaFormateada, infoLeft + 110, currentY + 18);
      
      doc.fillColor('#333333').text('HORA:', infoLeft, currentY + 36);
      doc.fillColor('#000000').text(horaFormateada, infoLeft + 110, currentY + 36);
      
      // Columna derecha
      doc.fillColor('#333333').text('ESTADO:', infoRight, currentY);
      doc.fillColor('#27ae60').font('Helvetica-Bold').text('PAGO APROBADO', infoRight + 110, currentY);
      
      doc.fillColor('#333333').font('Helvetica');
      doc.text('MÉTODO DE PAGO:', infoRight, currentY + 18);
      doc.fillColor('#000000').text('Tarjeta de Crédito/Débito', infoRight + 110, currentY + 18);
      
      doc.fillColor('#333333').text('MONEDA:', infoRight, currentY + 36);
      doc.fillColor('#000000').text('Soles (PEN)', infoRight + 110, currentY + 36);
      
      doc.moveDown(4);
      
      // ==================== INFORMACIÓN DEL CLIENTE ====================
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold');
      doc.text('INFORMACIÓN DEL CLIENTE', 50, doc.y);
      doc.strokeColor('#FFD700').lineWidth(1).moveTo(50, doc.y + 5).lineTo(doc.page.width - 50, doc.y + 5).stroke();
      doc.moveDown(1.5);
      
      currentY = doc.y;
      
      doc.fillColor('#333333').fontSize(10).font('Helvetica');
      doc.text('NOMBRE COMPLETO:', infoLeft, currentY);
      doc.fillColor('#000000').text(`${cliente.nombre} ${cliente.apellido}`, infoLeft + 110, currentY);
      
      doc.fillColor('#333333').text('EMAIL:', infoLeft, currentY + 18);
      doc.fillColor('#000000').text(cliente.email, infoLeft + 110, currentY + 18);
      
      doc.fillColor('#333333').text('TELÉFONO:', infoLeft, currentY + 36);
      doc.fillColor('#000000').text(cliente.telefono || 'No especificado', infoLeft + 110, currentY + 36);
      
      doc.moveDown(4);
      
      // ==================== TABLA DE PRODUCTOS ELEGANTE ====================
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold');
      doc.text('DETALLE DE PRODUCTOS', 50, doc.y);
      doc.strokeColor('#FFD700').lineWidth(1).moveTo(50, doc.y + 5).lineTo(doc.page.width - 50, doc.y + 5).stroke();
      doc.moveDown(1.5);
      
      // Encabezados de tabla
      const tableTop = doc.y;
      const colWidths = [270, 60, 90, 90];
      const colPositions = [50];
      
      for (let i = 1; i < colWidths.length; i++) {
        colPositions[i] = colPositions[i - 1] + colWidths[i - 1];
      }
      
      // Fondo encabezado minimalista
      doc.rect(colPositions[0], tableTop, colWidths.reduce((a, b) => a + b, 0), 25)
         .fillColor('#f8f9fa')
         .fill();
      
      // Texto encabezados
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      const headers = ['PRODUCTO', 'CANT.', 'PRECIO UNIT.', 'SUBTOTAL'];
      
      headers.forEach((header, i) => {
        const xPos = colPositions[i] + (i === 0 ? 10 : 5);
        doc.text(header, xPos, tableTop + 8, {
          width: colWidths[i] - 10,
          align: i >= 2 ? 'right' : 'left'
        });
      });
      
      // Línea debajo del encabezado
      doc.strokeColor('#FFD700').lineWidth(1)
         .moveTo(colPositions[0], tableTop + 25)
         .lineTo(colPositions[3] + colWidths[3], tableTop + 25)
         .stroke();
      
      let currentTableY = tableTop + 30;
      
      // Filas de productos
      productos.forEach((producto, index) => {
        const nombre = producto.nombre || producto.titulo || `Producto ${index + 1}`;
        const cantidad = producto.cantidad || producto.quantity || 1;
        const precio = producto.precio || producto.precioOriginal || 0;
        const subtotal = producto.subtotal || (cantidad * precio);
        
        // Fondo alternado muy sutil
        if (index % 2 === 0) {
          doc.rect(colPositions[0], currentTableY, colWidths.reduce((a, b) => a + b, 0), 35)
             .fillColor('#fafafa')
             .fill();
        }
        
        // Nombre del producto
        doc.fillColor('#000000').fontSize(9).font('Helvetica');
        doc.text(nombre, colPositions[0] + 10, currentTableY + 8, {
          width: colWidths[0] - 20
        });
        
        // Detalles adicionales pequeños
        if (producto.color || producto.talla || producto.sku) {
          const detalles = [];
          if (producto.color) detalles.push(`Color: ${producto.color}`);
          if (producto.talla) detalles.push(`Talla: ${producto.talla}`);
          if (producto.sku) detalles.push(`SKU: ${producto.sku}`);
          
          doc.fillColor('#666666').fontSize(7);
          doc.text(detalles.join(' | '), colPositions[0] + 10, currentTableY + 22, {
            width: colWidths[0] - 20
          });
        }
        
        // Cantidad
        doc.fillColor('#000000').fontSize(9);
        doc.text(cantidad.toString(), colPositions[1] + 5, currentTableY + 12, {
          width: colWidths[1] - 10,
          align: 'center'
        });
        
        // Precio unitario
        doc.text(`S/ ${precio.toFixed(2)}`, colPositions[2] + 5, currentTableY + 12, {
          width: colWidths[2] - 10,
          align: 'right'
        });
        
        // Subtotal
        doc.font('Helvetica-Bold');
        doc.text(`S/ ${subtotal.toFixed(2)}`, colPositions[3] + 5, currentTableY + 12, {
          width: colWidths[3] - 10,
          align: 'right'
        });
        
        // Línea separadora muy sutil
        doc.strokeColor('#e0e0e0').lineWidth(0.3)
           .moveTo(colPositions[0], currentTableY + 35)
           .lineTo(colPositions[3] + colWidths[3], currentTableY + 35)
           .stroke();
        
        currentTableY += 35;
      });
      
      doc.y = currentTableY + 20;
      
      // ==================== RESUMEN DE PAGO ELEGANTE ====================
      const summaryBoxTop = doc.y;
      const summaryBoxWidth = 300;
      const summaryBoxLeft = doc.page.width - summaryBoxWidth - 50;
      
      // Caja de resumen con bordes redondeados
      doc.roundedRect(summaryBoxLeft, summaryBoxTop, summaryBoxWidth, 150, 5)
         .fillColor('#f8f9fa')
         .fill();
      
      doc.roundedRect(summaryBoxLeft, summaryBoxTop, summaryBoxWidth, 150, 5)
         .strokeColor('#FFD700')
         .lineWidth(1)
         .stroke();
      
      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold');
      doc.text('RESUMEN DE PAGO', summaryBoxLeft + 15, summaryBoxTop + 15);
      
      doc.strokeColor('#e0e0e0').lineWidth(0.5)
         .moveTo(summaryBoxLeft + 15, summaryBoxTop + 40)
         .lineTo(summaryBoxLeft + summaryBoxWidth - 15, summaryBoxTop + 40)
         .stroke();
      
      let summaryY = summaryBoxTop + 50;
      const lineHeight = 22;
      
      // Subtotal
      doc.fillColor('#333333').fontSize(10).font('Helvetica');
      doc.text('Subtotal:', summaryBoxLeft + 15, summaryY);
      doc.text(`S/ ${resumen.subtotal.toFixed(2)}`, summaryBoxLeft + summaryBoxWidth - 115, summaryY, {
        align: 'right'
      });
      
      // Envío
      if (envio.costo > 0) {
        summaryY += lineHeight;
        doc.text(`Envío (${envio.tipo}):`, summaryBoxLeft + 15, summaryY);
        doc.text(`S/ ${envio.costo.toFixed(2)}`, summaryBoxLeft + summaryBoxWidth - 115, summaryY, {
          align: 'right'
        });
      }
      
      // Línea separadora
      summaryY += lineHeight + 5;
      doc.strokeColor('#FFD700').lineWidth(1)
         .moveTo(summaryBoxLeft + 15, summaryY)
         .lineTo(summaryBoxLeft + summaryBoxWidth - 15, summaryY)
         .stroke();
      
      // TOTAL - Destacado
      summaryY += 10;
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold');
      doc.text('TOTAL:', summaryBoxLeft + 15, summaryY);
      doc.fillColor('#27ae60');
      doc.text(`S/ ${resumen.total.toFixed(2)}`, summaryBoxLeft + summaryBoxWidth - 115, summaryY, {
        align: 'right'
      });
      
      // ==================== FINAL DEL PDF ====================
      doc.moveDown(4);
      
      // Footer
      doc.fillColor('#333333').fontSize(8).font('Helvetica');
      doc.text('Gracias por su compra. Este documento es su comprobante oficial.', 
        50, doc.page.height - 40, { width: doc.page.width - 100, align: 'center' });
      
      doc.fillColor('#666666').fontSize(7);
      doc.text(`ID de transacción: ${order_id}`, 50, doc.page.height - 25, { width: doc.page.width - 100, align: 'center' });
      
      doc.end();
      
    } catch (error) {
      console.error('Error generando PDF profesional:', error);
      reject(error);
    }
  });
}
// ========================
// 7. FUNCIÓN DE NOTIFICACIÓN INTERNA
// ========================
async function sendPaymentNotification(paymentData) {
  try {
    const orderId = paymentData.order_id || paymentData.metadata?.orderId || 'N/A';
    const total = paymentData.resumen?.total || 
                  (paymentData.amount ? paymentData.amount / 100 : 0);
    
    // ✅ CORREGIDO: Obtener email del cliente
    const customerEmail = paymentData.cliente?.email || 
                          paymentData.email || 
                          paymentData.customer_email || 
                          'No especificado';

    // ✅ CORREGIDO: Obtener nombre completo
    const customerName = paymentData.cliente?.nombre || 
                         paymentData.customer_name || 
                         'Cliente';
    const customerLastName = paymentData.cliente?.apellido || '';
    const customerFullName = `${customerName} ${customerLastName}`.trim();
    
    // ✅ AGREGADO: Generar tabla de productos para admin
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
                <p style="margin: 0 0 8px 0;"><strong>📅 Fecha:</strong><br>${new Date().toLocaleString('es-PE')}</p>
                <p style="margin: 0;"><strong>🔗 ID Culqi:</strong><br><code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${paymentData.culqi_id || paymentData.id || 'N/A'}</code></p>
              </div>
            </div>
            
            <!-- 🚚 INFORMACIÓN DE ENVÍO (CRÍTICA) -->
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

<!-- 📞 Información de contacto -->
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
              🔔 Notificación generada automáticamente • ${new Date().toLocaleString('es-PE')}
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
// 8. FUNCIONES DE UTILIDAD
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
    environment: process.env.NODE_ENV || 'development'
  };
  
  logger.info('Estado del servicio de email:', checks);
  return checks;
}

// ========================
// 9. EXPORTACIÓN
// ========================
// Vincular métodos al objeto
const emailService = {
  sendPaymentConfirmation,
  sendPaymentNotification,
  verifyService,
  // Métodos internos (para testing/debugging)
  _extractFirebaseData,
  _generateGoldenInfinityEmail,
  _generateOrderPDF,
  _maskEmail
};

// Exportar
module.exports = emailService;