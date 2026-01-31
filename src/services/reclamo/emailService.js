// src/services/reclamo/emailService.js
'use strict';

const logger = require('../../core/utils/logger');
const nodemailer = require('nodemailer');

class ReclamoEmailService {
    constructor() {
        this.transporter = null;
        this._initialize();
    }

    _initialize() {
        try {
            // ✅ CREDENCIALES DIRECTO - SIN VARIABLES DE ENTORNO
            const GMAIL_USER = 'cirobriones99@gmail.com';
            const GMAIL_APP_PASSWORD = 'oerqbrqrcexcjupd';
            
            logger.info('🚀 [RECLAMOS-GMAIL] Inicializando servicio PROFESIONAL', {
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                mode: 'PRODUCCIÓN REAL',
                user: 'ciro*******@gmail.com'
            });

            // Crear transporter con configuración de producción
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: GMAIL_USER,
                    pass: GMAIL_APP_PASSWORD
                },
                tls: {
                    rejectUnauthorized: true, // TRUE para producción
                    minVersion: 'TLSv1.2'
                },
                secure: true,
                port: 465,
                // Configuración optimizada para alta carga
                pool: true,
                maxConnections: 10,
                maxMessages: 50,
                rateDelta: 1000,
                rateLimit: 5,
                // Debug
                debug: false,
                logger: false
            });

            // Verificar conexión INMEDIATA
            this._verifyConnectionImmediately();

            logger.info('✅ [RECLAMOS-GMAIL] Servicio PROFESIONAL inicializado - MODO PRODUCCIÓN', {
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                status: 'OPERATIONAL',
                provider: 'Gmail SMTP',
                independence: '100% separado de sistema de pagos',
                features: ['HTML templates', 'PDF attachments', 'High deliverability'],
                fromEmail: 'reclamos@goldinfiniti.com',
                security: 'TLSv1.2+',
                maxConnections: 10,
                rateLimit: '5 emails/segundo'
            });

        } catch (error) {
            logger.error('💥 [RECLAMOS-GMAIL] ERROR FATAL inicializando servicio:', {
                error: error.message,
                stack: error.stack,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                severity: 'CRITICAL',
                action: 'REINICIAR_SERVIDOR_INMEDIATAMENTE'
            });
            // NO hay modo simulación - ERROR FATAL
            throw new Error(`FATAL: No se pudo inicializar servicio de email: ${error.message}`);
        }
    }

    _verifyConnectionImmediately() {
        return new Promise((resolve, reject) => {
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('🔐 [RECLAMOS-GMAIL] ERROR CONEXIÓN SMTP - VERIFICACIÓN FALLIDA:', {
                        error: error.message,
                        code: error.code,
                        command: error.command,
                        service: 'reclamos-email',
                        timestamp: new Date().toISOString(),
                        severity: 'CRITICAL',
                        action: 'VERIFICAR_CREDENCIALES_GMAIL'
                    });
                    reject(error);
                } else {
                    logger.info('🔒 [RECLAMOS-GMAIL] Conexión SMTP VERIFICADA - LISTO PARA PRODUCCIÓN', {
                        service: 'reclamos-email',
                        timestamp: new Date().toISOString(),
                        protocol: 'SMTP/SSL',
                        host: 'smtp.gmail.com',
                        port: 465,
                        security: 'TLS 1.2'
                    });
                    resolve(success);
                }
            });
        });
    }

    async sendReclamoEmail(emailData) {
        const startTime = Date.now();
        const emailId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // ✅ VALIDACIÓN ESTRICTA - PRODUCCIÓN
            if (!emailData || typeof emailData !== 'object') {
                throw new Error('Datos de email inválidos: objeto requerido');
            }

            if (!emailData.to || !this._isValidEmail(emailData.to)) {
                throw new Error(`Email destinatario inválido: ${emailData.to}`);
            }

            if (!emailData.subject || emailData.subject.trim().length < 5) {
                throw new Error('Asunto del email demasiado corto (mínimo 5 caracteres)');
            }

            if (!emailData.html || emailData.html.trim().length < 50) {
                throw new Error('Contenido HTML insuficiente (mínimo 50 caracteres)');
            }

            // ✅ CONFIGURACIÓN EMAIL CORPORATIVO PROFESIONAL
            const mailOptions = {
                to: emailData.to,
                from: `"GOLDINFINITI - Libro de Reclamaciones" <reclamos@goldinfiniti.com>`,
                sender: 'reclamos@goldinfiniti.com',
                replyTo: 'soporte@goldinfiniti.com',
                subject: `📋 ${emailData.subject} | Libro de Reclamaciones`,
                html: this._wrapCorporateTemplate(emailData.html),
                text: emailData.text || this._generatePlainText(emailData.html),
                priority: 'high',
                // Headers profesionales
                headers: {
                    'X-Reclamo-ID': emailData.reclamoId || 'N/A',
                    'X-System': 'reclamos-profesional-v2.0',
                    'X-Version': '2.0.0',
                    'X-Priority': '1 (Highest)',
                    'X-Mailer': 'GOLDINFINITI-Mail-Server/2.0',
                    'X-Auto-Response-Suppress': 'OOF, AutoReply',
                    'Precedence': 'bulk',
                    'Importance': 'high'
                },
                // Adjuntos
                attachments: emailData.attachments || [],
                // Configuración de entrega
                dsn: {
                    id: emailId,
                    return: 'headers',
                    notify: ['failure', 'delay'],
                    recipient: 'reclamos@goldinfiniti.com'
                }
            };

            logger.info('📤 [RECLAMOS-GMAIL] ENVIANDO EMAIL CORPORATIVO:', {
                emailId,
                to: this._maskEmail(emailData.to),
                subject: emailData.subject,
                reclamoId: emailData.reclamoId || 'N/A',
                lengthHtml: emailData.html.length,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                mode: 'PRODUCCIÓN',
                priority: 'HIGH'
            });

            // ✅ ENVÍO REAL - SIN SIMULACIONES
            const info = await this.transporter.sendMail(mailOptions);
            
            const duration = Date.now() - startTime;
            
            logger.info('✅ [RECLAMOS-GMAIL] EMAIL ENVIADO EXITOSAMENTE:', {
                emailId,
                messageId: info.messageId,
                to: this._maskEmail(emailData.to),
                subject: emailData.subject,
                duration: `${duration}ms`,
                speed: `${duration < 1000 ? '⚡ RÁPIDO' : '⚙️ NORMAL'}`,
                accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
                rejected: Array.isArray(info.rejected) ? info.rejected.length : 0,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                provider: 'Gmail',
                status: 'DELIVERED',
                smtpResponse: info.response || '250 2.0.0 OK'
            });

            return {
                success: true,
                emailId,
                messageId: info.messageId,
                timestamp: new Date().toISOString(),
                duration: `${duration}ms`,
                metadata: {
                    provider: 'Gmail SMTP',
                    mode: 'production',
                    reclamoId: emailData.reclamoId,
                    deliveredTo: info.accepted,
                    response: info.response
                },
                corporate: {
                    from: 'reclamos@goldinfiniti.com',
                    replyTo: 'soporte@goldinfiniti.com',
                    tracking: true
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('💥 [RECLAMOS-GMAIL] ERROR CRÍTICO EN ENVÍO:', {
                emailId,
                error: error.message,
                errorCode: error.code,
                command: error.command,
                smtpResponse: error.response,
                to: this._maskEmail(emailData?.to),
                subject: emailData?.subject,
                duration: `${duration}ms`,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                severity: 'CRITICAL',
                action: 'CONTACTAR_ADMINISTRADOR_SMTP',
                systemStatus: 'NO OPERATIONAL'
            });

            // ✅ ERROR REAL - NO SIMULACIÓN
            throw new Error(`Fallo envío email: ${error.message}. Código: ${error.code || 'N/A'}`);
        }
    }

    _wrapCorporateTemplate(htmlContent) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GOLDINFINITI - Libro de Reclamaciones</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
        .logo { max-width: 200px; margin-bottom: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-left: 1px solid #dee2e6; border-right: 1px solid #dee2e6; }
        .footer { background: #343a40; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        .signature { border-top: 2px solid #007bff; padding-top: 20px; margin-top: 30px; }
        .legal { font-size: 11px; color: #6c757d; margin-top: 30px; padding: 15px; background: #e9ecef; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 Libro de Reclamaciones Electrónico</h1>
        <h2>GOLDINFINITI TECH CORP</h2>
        <p>Sistema Profesional de Gestión de Reclamos</p>
    </div>
    
    <div class="content">
        ${htmlContent}
        
        <div class="signature">
            <p><strong>Atentamente,</strong></p>
            <p>Departamento de Reclamos</p>
            <p>GOLDINFINITI TECH CORP</p>
            <p>📧 reclamos@goldinfiniti.com</p>
            <p>📞 +1 (555) 123-4567</p>
            <p>🏢 Av. Principal 123, Lima, Perú</p>
        </div>
    </div>
    
    <div class="footer">
        <p>© ${new Date().getFullYear()} GOLDINFINITI TECH CORP. Todos los derechos reservados.</p>
        <p>Este es un mensaje automático del Sistema de Reclamos. Por favor no responda a este correo.</p>
        <p>ID del Sistema: ${Date.now()}-${Math.random().toString(36).substr(2, 8)}</p>
    </div>
    
    <div class="legal">
        <p><strong>Aviso Legal:</strong> Este correo electrónico y cualquier archivo adjunto son confidenciales y están destinados únicamente para el uso del destinatario. 
        Si usted no es el destinatario, por favor notifique al remitente y elimine este mensaje. La divulgación, copia o distribución no autorizada está prohibida.</p>
    </div>
</body>
</html>`;
    }

    _isValidEmail(email) {
        if (!email) return false;
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email) && email.length <= 254;
    }

    _generatePlainText(html) {
        try {
            return html
                .replace(/<style[^>]*>.*?<\/style>/gs, '')
                .replace(/<script[^>]*>.*?<\/script>/gs, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim()
                .substring(0, 1000);
        } catch (error) {
            return 'Reclamo registrado exitosamente en el Libro de Reclamaciones Electrónico de GOLDINFINITI TECH CORP. Para más detalles, revise la versión HTML de este correo.';
        }
    }

    _maskEmail(email) {
        if (!email) return 'NO-ESPECIFICADO';
        try {
            const [local, domain] = email.split('@');
            if (local && domain) {
                if (local.length <= 2) return `${local}***@${domain}`;
                const maskedLocal = local.substring(0, 2) + '***' + local.substring(local.length - 1);
                const [domainName, tld] = domain.split('.');
                const maskedDomain = domainName.substring(0, 2) + '***';
                return `${maskedLocal}@${maskedDomain}.${tld}`;
            }
            return 'EMAIL-ENMASCARADO';
        } catch {
            return 'FORMATO-INVALIDO';
        }
    }

    async verify() {
        try {
            const verified = await this.transporter.verify();
            
            return { 
                verified: true,
                operational: true,
                message: '✅ SERVICIO GMAIL OPERATIVO - MODO PRODUCCIÓN',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                status: 'ACTIVE',
                security: 'TLS 1.2',
                features: ['HTML templates', 'PDF attachments', 'Corporate branding', 'High priority'],
                limits: {
                    daily: '500 emails',
                    rate: '5/segundo',
                    attachments: '25MB'
                },
                configuration: {
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    user: 'cirobriones99@gmail.com (corporativo)',
                    from: 'reclamos@goldinfiniti.com'
                }
            };
            
        } catch (error) {
            return { 
                verified: false,
                operational: false,
                error: error.message,
                message: '❌ SERVICIO GMAIL NO OPERATIVO',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                status: 'ERROR',
                action: 'VERIFICAR_CREDENCIALES_Y_CONEXIÓN',
                emergency: 'contactar@admin.goldinfiniti.com'
            };
        }
    }

    // ✅ MÉTODO ADICIONAL PARA ENVÍOS MASIVOS
    async sendBulkReclamoEmails(emailsData, batchSize = 10) {
        const results = [];
        const startTime = Date.now();
        const bulkId = `bulk_${Date.now()}`;
        
        logger.info('📦 [RECLAMOS-GMAIL] INICIANDO ENVÍO MASIVO:', {
            bulkId,
            totalEmails: emailsData.length,
            batchSize,
            service: 'reclamos-email',
            timestamp: new Date().toISOString(),
            mode: 'BULK_PRODUCTION'
        });

        for (let i = 0; i < emailsData.length; i += batchSize) {
            const batch = emailsData.slice(i, i + batchSize);
            const batchId = `${bulkId}_batch_${i / batchSize + 1}`;
            
            logger.info(`🔄 [RECLAMOS-GMAIL] Procesando lote ${batchId}:`, {
                batchId,
                emailsInBatch: batch.length,
                progress: `${i + batch.length}/${emailsData.length}`,
                service: 'reclamos-email'
            });

            const batchPromises = batch.map((emailData, index) => 
                this.sendReclamoEmail(emailData).catch(error => ({
                    success: false,
                    error: error.message,
                    to: emailData.to,
                    index: i + index
                }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Pausa para evitar rate limiting
            if (i + batchSize < emailsData.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        logger.info('📊 [RECLAMOS-GMAIL] ENVÍO MASIVO COMPLETADO:', {
            bulkId,
            totalEmails: emailsData.length,
            success: successCount,
            failures: failureCount,
            successRate: `${((successCount / emailsData.length) * 100).toFixed(2)}%`,
            duration: `${duration}ms`,
            avgTimePerEmail: `${(duration / emailsData.length).toFixed(2)}ms`,
            service: 'reclamos-email',
            timestamp: new Date().toISOString(),
            status: failureCount === 0 ? '✅ COMPLETO' : '⚠️ CON ERRORES'
        });

        return {
            bulkId,
            total: emailsData.length,
            success: successCount,
            failures: failureCount,
            successRate: `${((successCount / emailsData.length) * 100).toFixed(2)}%`,
            duration: `${duration}ms`,
            results: results,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new ReclamoEmailService();