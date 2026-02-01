const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');

// ====================================================
// 1. INICIALIZACIÓN FIREBASE - PRODUCCIÓN
// ====================================================
if (!admin.apps.length) {
  admin.initializeApp();
  console.log('🔥 RECLAMOS: Firebase Admin inicializado');
}

const db = admin.firestore();

// ====================================================
// 2. CONFIGURACIÓN SENDGRID - PRODUCCIÓN REAL
// ====================================================
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EN_PRODUCCION = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

console.log('🔍 RECLAMOS - Configuración detectada:', {
  entorno: EN_PRODUCCION ? 'PRODUCCIÓN' : 'DESARROLLO',
  tieneSendGrid: !!SENDGRID_API_KEY,
  tieneGmail: !!(GMAIL_USER && GMAIL_PASS),
  nodo: process.env.NODE_ENV,
  render: process.env.RENDER
});

// DETERMINAR PROVEEDOR DE EMAIL
let proveedorEmail, emailClient;

if (EN_PRODUCCION && SENDGRID_API_KEY) {
  console.log('🚀 RECLAMOS: Configurando SendGrid para producción');
  sgMail.setApiKey(SENDGRID_API_KEY);
  proveedorEmail = 'sendgrid';
  emailClient = sgMail;
} else if (GMAIL_USER && GMAIL_PASS) {
  console.log('💻 RECLAMOS: Configurando Gmail para desarrollo');
  const nodemailer = require('nodemailer');
  emailClient = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });
  proveedorEmail = 'gmail';
} else {
  console.error('❌ RECLAMOS: No hay configuración de email válida');
  proveedorEmail = 'none';
  emailClient = null;
}

// ====================================================
// 3. CONSTANTES DE EMAIL
// ====================================================
const EMAIL_CONFIG = {
  FROM: 'soporte@goldinfiniti.com',
  FROM_NAME: 'GOLDINFINITI - Libro de Reclamaciones',
  ADMIN: 'cirobriones99@gmail.com',
  REPLY_TO: 'soporte@goldinfiniti.com',
  EMPRESA: {
    NOMBRE: 'GOLDINFINITI TECH CORP',
    RUC: '20613360281',
    CONTACTO: 'soporte@goldinfiniti.com',
    TELEFONO: '+51 123 456 789'
  }
};

// ====================================================
// 4. TEMPLATE HTML PROFESIONAL - RECLAMOS
// ====================================================
const crearTemplateReclamo = (reclamoData) => {
  const fecha = new Date(reclamoData.fechaRegistro || Date.now());
  const fechaFormateada = fecha.toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const horaFormateada = fecha.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación de Reclamo - GOLDINFINITI</title>
    <style>
        body { margin: 0; padding: 0; background: #f8f9fa; font-family: 'Arial', sans-serif; }
        .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .badge { background: #4CAF50; color: white; padding: 10px 25px; border-radius: 25px; display: inline-block; margin-top: 15px; font-size: 14px; font-weight: bold; }
        .content { padding: 40px; }
        .section { margin-bottom: 35px; }
        .section-title { color: #1a237e; font-size: 20px; margin-bottom: 20px; font-weight: 600; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; }
        .data-row { display: flex; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; }
        .data-label { flex: 0 0 180px; font-weight: 600; color: #555; }
        .data-value { flex: 1; color: #222; }
        .highlight { background: #e8f5e9; border-left: 5px solid #4CAF50; padding: 25px; margin: 25px 0; border-radius: 0 5px 5px 0; }
        .alert { background: #fff3e0; border-left: 5px solid #ff9800; padding: 25px; margin: 25px 0; border-radius: 0 5px 5px 0; }
        .numero-grande { font-size: 32px; color: #1a237e; font-weight: 700; text-align: center; margin: 30px 0; background: #f5f5f5; padding: 20px; border-radius: 10px; }
        .btn { background: #1a237e; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; }
        .empresa { background: #f5f5f5; padding: 25px; border-radius: 8px; margin-top: 35px; }
        .footer { text-align: center; padding: 25px; color: #666; font-size: 13px; border-top: 1px solid #eaeaea; background: #f9f9f9; }
        @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 0; }
            .header, .content { padding: 25px 20px; }
            .data-row { flex-direction: column; }
            .data-label { flex: none; margin-bottom: 5px; }
            .numero-grande { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 LIBRO DE RECLAMACIONES VIRTUAL</h1>
            <div class="badge">✅ RECLAMO REGISTRADO EXITOSAMENTE</div>
        </div>
        
        <div class="content">
            <div class="numero-grande">
                N° ${reclamoData.numeroReclamo || reclamoData.id}
            </div>
            
            <div class="highlight">
                <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                    Estimado(a) <strong>${reclamoData.consumidor.nombreCompleto || 'Cliente'}</strong>,<br>
                    Su reclamo ha sido registrado en nuestro Libro de Reclamaciones Virtual de acuerdo a la Ley N° 29571.
                </p>
            </div>
            
            <div class="section">
                <div class="section-title">📄 DETALLES DEL RECLAMO</div>
                <div class="data-row">
                    <div class="data-label">Fecha de Registro:</div>
                    <div class="data-value">${fechaFormateada} - ${horaFormateada}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Tipo de Solicitud:</div>
                    <div class="data-value">${reclamoData.reclamo?.tipoSolicitud || 'RECLAMO'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Producto/Servicio:</div>
                    <div class="data-value">${reclamoData.reclamo?.productoServicio || 'No especificado'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Monto Reclamado:</div>
                    <div class="data-value">S/ ${parseFloat(reclamoData.reclamo?.montoReclamado || 0).toFixed(2)}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Descripción:</div>
                    <div class="data-value">${reclamoData.reclamo?.descripcion || 'No se proporcionó descripción'}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">👤 INFORMACIÓN DEL CONSUMIDOR</div>
                <div class="data-row">
                    <div class="data-label">Nombre Completo:</div>
                    <div class="data-value">${reclamoData.consumidor.nombreCompleto || ''}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Documento:</div>
                    <div class="data-value">${reclamoData.consumidor.tipoDocumento || ''} ${reclamoData.consumidor.numeroDocumento || ''}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Email:</div>
                    <div class="data-value">${reclamoData.consumidor.email || ''}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Teléfono:</div>
                    <div class="data-value">${reclamoData.consumidor.telefono || 'No proporcionado'}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Dirección:</div>
                    <div class="data-value">${reclamoData.consumidor.direccion || 'No proporcionada'}</div>
                </div>
            </div>
            
            <div class="alert">
                <div class="section-title">⏰ PLAZO DE RESPUESTA</div>
                <div class="data-row">
                    <div class="data-label">Tiempo de Respuesta:</div>
                    <div class="data-value">${reclamoData.legal?.plazoDias || 30} días hábiles</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Fecha Límite:</div>
                    <div class="data-value">${reclamoData.legal?.fechaLimiteRespuesta || 'Por calcular'}</div>
                </div>
                <p style="margin-top: 15px; font-size: 14px; color: #555;">
                    De acuerdo al Código de Protección y Defensa del Consumidor - INDECOPI
                </p>
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="https://goldinfiniti.com/reclamos/${reclamoData.numeroReclamo || reclamoData.id}" 
                   class="btn">
                    🔍 SEGUIR ESTADO DEL RECLAMO
                </a>
                <p style="color: #666; font-size: 14px; margin-top: 15px;">
                    Puede consultar el estado y descargar su comprobante en nuestro portal
                </p>
            </div>
            
            <div class="empresa">
                <div class="section-title" style="margin-top: 0;">🏢 INFORMACIÓN DE LA EMPRESA</div>
                <div class="data-row">
                    <div class="data-label">Razón Social:</div>
                    <div class="data-value">${EMAIL_CONFIG.EMPRESA.NOMBRE}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">RUC:</div>
                    <div class="data-value">${EMAIL_CONFIG.EMPRESA.RUC}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Contacto:</div>
                    <div class="data-value">${EMAIL_CONFIG.EMPRESA.CONTACTO}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">Teléfono:</div>
                    <div class="data-value">${EMAIL_CONFIG.EMPRESA.TELEFONO}</div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${EMAIL_CONFIG.EMPRESA.NOMBRE} - Sistema de Libro de Reclamaciones Virtual</p>
            <p>Registrado ante INDECOPI - Todos los derechos reservados</p>
            <p>Este es un mensaje automático, por favor no responder a este correo</p>
            <p>Para consultas: ${EMAIL_CONFIG.REPLY_TO}</p>
        </div>
    </div>
</body>
</html>`;
};

// ====================================================
// 5. TEMPLATE PARA ADMIN
// ====================================================
const crearTemplateAdmin = (reclamoData) => {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
    <div style="max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 3px 15px rgba(0,0,0,0.1);">
        <h2 style="color: #d32f2f; margin-top: 0; border-left: 5px solid #d32f2f; padding-left: 15px;">
            ⚠️ NUEVO RECLAMO REGISTRADO
        </h2>
        
        <div style="background: #fff8e1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1a237e;">
                📋 ${reclamoData.numeroReclamo || reclamoData.id}
            </h3>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Cliente:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reclamoData.consumidor.nombreCompleto}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reclamoData.consumidor.email}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Teléfono:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reclamoData.consumidor.telefono || 'No proporcionado'}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Documento:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reclamoData.consumidor.tipoDocumento} ${reclamoData.consumidor.numeroDocumento}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Producto:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reclamoData.reclamo?.productoServicio || 'No especificado'}</td></tr>
                <tr><td style="padding: 10px; font-weight: bold;">Monto Reclamado:</td>
                    <td style="padding: 10px;">S/ ${parseFloat(reclamoData.reclamo?.montoReclamado || 0).toFixed(2)}</td></tr>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                <strong>📝 Descripción:</strong>
                <p style="margin: 10px 0 0 0;">${reclamoData.reclamo?.descripcion || 'Sin descripción'}</p>
            </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://admin.goldinfiniti.com/reclamos/${reclamoData.numeroReclamo || reclamoData.id}" 
               style="background: #1a237e; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               👁️ VER RECLAMO COMPLETO
            </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <p>📅 Registrado: ${new Date(reclamoData.fechaRegistro || Date.now()).toLocaleString('es-PE')}</p>
            <p>⚠️ Plazo de respuesta: ${reclamoData.legal?.plazoDias || 30} días hábiles</p>
        </div>
    </div>
</body>
</html>`;
};

// ====================================================
// 6. CLASE PRINCIPAL - PRODUCCIÓN REAL
// ====================================================
class ReclamoEmailService {
  constructor() {
    console.log(`📧 RECLAMOS: Servicio inicializado - Proveedor: ${proveedorEmail.toUpperCase()}`);
    console.log(`📧 RECLAMOS: Entorno: ${EN_PRODUCCION ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
  }

  async enviarConfirmacion(reclamoId) {
    const transactionId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    console.log(`📤 RECLAMOS [${transactionId}]: Iniciando proceso para ${reclamoId}`);
    
    try {
      // 1. VALIDAR CONFIGURACIÓN
      if (proveedorEmail === 'none' || !emailClient) {
        throw new Error('Servicio de email no configurado');
      }
      
      // 2. VALIDAR ID
      if (!reclamoId || !reclamoId.startsWith('REC-')) {
        throw new Error(`ID de reclamo inválido: ${reclamoId}`);
      }
      
      // 3. OBTENER DATOS DE FIREBASE
      console.log(`🔍 RECLAMOS [${transactionId}]: Buscando en Firebase...`);
      
      let reclamoDoc;
      let docRef = db.collection('libro_reclamaciones_indecopi').doc(reclamoId);
      let docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        const querySnapshot = await db.collection('libro_reclamaciones_indecopi')
          .where('numeroReclamo', '==', reclamoId)
          .limit(1)
          .get();
        
        if (querySnapshot.empty) {
          throw new Error(`Reclamo ${reclamoId} no encontrado en Firebase`);
        }
        reclamoDoc = querySnapshot.docs[0];
        docRef = reclamoDoc.ref;
      } else {
        reclamoDoc = docSnap;
      }
      
      const reclamoData = reclamoDoc.data();
      const consumidor = reclamoData.consumidor;
      
      if (!consumidor || !consumidor.email) {
        throw new Error('Email del consumidor no encontrado');
      }
      
      console.log(`✅ RECLAMOS [${transactionId}]: Datos obtenidos - Cliente: ${consumidor.nombreCompleto}`);
      
      // 4. CREAR TEMPLATES
      const htmlUsuario = crearTemplateReclamo(reclamoData);
      const htmlAdmin = crearTemplateAdmin(reclamoData);
      const textoPlano = this._crearTextoPlano(reclamoData);
      
      // 5. ENVIAR EMAIL AL USUARIO
      console.log(`📧 RECLAMOS [${transactionId}]: Enviando email a usuario...`);
      
      if (proveedorEmail === 'sendgrid') {
        const msgUsuario = {
          to: consumidor.email,
          from: {
            email: EMAIL_CONFIG.FROM,
            name: EMAIL_CONFIG.FROM_NAME
          },
          replyTo: EMAIL_CONFIG.REPLY_TO,
          subject: `✅ Confirmación de Reclamo #${reclamoData.numeroReclamo || reclamoId}`,
          html: htmlUsuario,
          text: textoPlano,
          customArgs: {
            transactionId,
            service: 'libro_reclamaciones',
            reclamoId: reclamoData.numeroReclamo || reclamoId,
            tipo: 'confirmacion_usuario'
          }
        };
        
        const [resultadoUsuario] = await emailClient.send(msgUsuario);
        const messageIdUsuario = resultadoUsuario.headers?.['x-message-id'];
        console.log(`✅ RECLAMOS [${transactionId}]: Email usuario enviado - Message ID: ${messageIdUsuario}`);
        
        // 6. ENVIAR EMAIL AL ADMIN
        console.log(`📧 RECLAMOS [${transactionId}]: Enviando notificación a admin...`);
        
        const msgAdmin = {
          to: EMAIL_CONFIG.ADMIN,
          from: {
            email: EMAIL_CONFIG.FROM,
            name: '⚠️ Sistema de Reclamos - GOLDINFINITI'
          },
          subject: `NUEVO RECLAMO #${reclamoData.numeroReclamo || reclamoId} - ${consumidor.nombreCompleto}`,
          html: htmlAdmin,
          text: `Nuevo reclamo registrado: ${reclamoData.numeroReclamo}`,
          customArgs: {
            transactionId,
            service: 'libro_reclamaciones',
            reclamoId: reclamoData.numeroReclamo || reclamoId,
            tipo: 'notificacion_admin'
          }
        };
        
        const [resultadoAdmin] = await emailClient.send(msgAdmin);
        const messageIdAdmin = resultadoAdmin.headers?.['x-message-id'];
        console.log(`✅ RECLAMOS [${transactionId}]: Email admin enviado - Message ID: ${messageIdAdmin}`);
        
        // 7. ACTUALIZAR FIREBASE
        await docRef.update({
          'metadata.emailEnviado': true,
          'metadata.emailEnviadoAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.emailPendiente': false,
          'metadata.emailUsuarioEnviado': true,
          'metadata.emailAdminEnviado': true,
          'metadata.emailMessageIdUsuario': messageIdUsuario || null,
          'metadata.emailMessageIdAdmin': messageIdAdmin || null,
          'estado': 'NOTIFICADO',
          'ultimaActualizacion': admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ RECLAMOS [${transactionId}]: Firebase actualizado`);
        
      } else if (proveedorEmail === 'gmail') {
        // ENVÍO CON GMAIL
        const mailOptionsUsuario = {
          from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM}>`,
          to: consumidor.email,
          subject: `✅ Confirmación de Reclamo #${reclamoData.numeroReclamo || reclamoId}`,
          html: htmlUsuario,
          text: textoPlano
        };
        
        const infoUsuario = await emailClient.sendMail(mailOptionsUsuario);
        console.log(`✅ RECLAMOS [${transactionId}]: Email usuario enviado - Message ID: ${infoUsuario.messageId}`);
        
        const mailOptionsAdmin = {
          from: `"⚠️ Sistema de Reclamos - GOLDINFINITI" <${EMAIL_CONFIG.FROM}>`,
          to: EMAIL_CONFIG.ADMIN,
          subject: `NUEVO RECLAMO #${reclamoData.numeroReclamo || reclamoId}`,
          html: htmlAdmin
        };
        
        const infoAdmin = await emailClient.sendMail(mailOptionsAdmin);
        console.log(`✅ RECLAMOS [${transactionId}]: Email admin enviado - Message ID: ${infoAdmin.messageId}`);
        
        await docRef.update({
          'metadata.emailEnviado': true,
          'metadata.emailEnviadoAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.emailPendiente': false,
          'estado': 'NOTIFICADO'
        });
      }
      
      // 8. LOG FINAL
      const duration = Date.now() - startTime;
      console.log(`🎉 RECLAMOS [${transactionId}]: PROCESO COMPLETADO`, {
        reclamoId: reclamoData.numeroReclamo || reclamoId,
        cliente: consumidor.email,
        admin: EMAIL_CONFIG.ADMIN,
        proveedor: proveedorEmail,
        duration: `${duration}ms`
      });
      
      return {
        success: true,
        transactionId,
        reclamoId: reclamoData.numeroReclamo || reclamoId,
        emails: {
          usuario: { sent: true, to: consumidor.email },
          admin: { sent: true, to: EMAIL_CONFIG.ADMIN }
        },
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`💥 RECLAMOS [${transactionId}]: ERROR`, {
        reclamoId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      return {
        success: false,
        transactionId,
        error: error.message,
        reclamoId,
        duration: `${duration}ms`
      };
    }
  }
  
  _crearTextoPlano(reclamoData) {
    return `CONFIRMACIÓN DE RECLAMO - GOLDINFINITI TECH CORP

Estimado(a) ${reclamoData.consumidor.nombreCompleto || 'Cliente'},

Su reclamo ha sido registrado exitosamente en nuestro Libro de Reclamaciones Virtual.

📋 DETALLES:
Número: ${reclamoData.numeroReclamo || reclamoData.id}
Fecha: ${new Date().toLocaleDateString('es-PE')}
Producto: ${reclamoData.reclamo?.productoServicio || 'No especificado'}
Monto: S/ ${parseFloat(reclamoData.reclamo?.montoReclamado || 0).toFixed(2)}

⏰ PLAZO DE RESPUESTA: ${reclamoData.legal?.plazoDias || 30} días hábiles

🔍 SEGUIMIENTO:
https://goldinfiniti.com/reclamos/${reclamoData.numeroReclamo || reclamoData.id}

🏢 INFORMACIÓN DE LA EMPRESA:
GOLDINFINITI TECH CORP
RUC: 20613360281
Contacto: soporte@goldinfiniti.com

---
Este es un mensaje automático, por favor no responder.`;
  }
  
  // MÉTODO PARA HEALTH CHECK
  async healthCheck() {
    return {
      service: 'reclamo_email_service',
      status: proveedorEmail !== 'none' ? 'OPERATIONAL' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      config: {
        provider: proveedorEmail,
        environment: EN_PRODUCCION ? 'production' : 'development',
        hasFirebase: true,
        hasEmailConfig: proveedorEmail !== 'none'
      }
    };
  }
}

// ====================================================
// 7. EXPORTAR INSTANCIA
// ====================================================
module.exports = new ReclamoEmailService();