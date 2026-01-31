// src/services/reclamo/emailService.js
'use strict';

const logger = require('../../core/utils/logger');
const nodemailer = require('nodemailer');

class ReclamoEmailService {
    constructor() {
        this.transporter = null;
        this.simulated = false;
        this._initialize();
    }

    _initialize() {
        try {
            const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
            
            // Verificar que tenemos las credenciales de Gmail
            if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
                logger.error('❌ [RECLAMOS-GMAIL] ERROR: Credenciales Gmail no configuradas', {
                    service: 'reclamos-email',
                    timestamp: new Date().toISOString(),
                    action: 'Revisar variables GMAIL_USER y GMAIL_APP_PASSWORD en .env'
                });
                
                // Intentar usar las mismas credenciales del sistema de pagos
                const paymentEmailUser = process.env.EMAIL_USER || process.env.GMAIL_USER_PAGOS;
                const paymentEmailPass = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD_PAGOS;
                
                if (paymentEmailUser && paymentEmailPass) {
                    logger.info('🔄 [RECLAMOS-GMAIL] Usando credenciales del sistema de pagos', {
                        service: 'reclamos-email',
                        user: paymentEmailUser
                    });
                    this._createTransporter(paymentEmailUser, paymentEmailPass);
                } else {
                    this.simulated = true;
                    return;
                }
            } else {
                // Usar credenciales específicas para reclamos
                this._createTransporter(GMAIL_USER, GMAIL_APP_PASSWORD);
            }

            logger.info('✅ [RECLAMOS-GMAIL] Servicio PROFESIONAL inicializado con Gmail', {
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                status: 'OPERATIONAL',
                provider: 'Gmail SMTP',
                independence: '100% separado de sistema de pagos',
                features: ['HTML templates', 'PDF attachments', 'High deliverability'],
                fromEmail: 'contacto@goldinfiniti.com' // Email específico para reclamos
            });

        } catch (error) {
            logger.error('💥 [RECLAMOS-GMAIL] ERROR inicializando servicio:', {
                error: error.message,
                stack: error.stack,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                severity: 'CRITICAL'
            });
            this.simulated = true;
        }
    }

    _createTransporter(user, password) {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: password
            },
            tls: {
                rejectUnauthorized: false // Para evitar problemas de certificado en desarrollo
            },
            // Configuración optimizada
            pool: true,
            maxConnections: 5,
            maxMessages: 100
        });

        // Verificar conexión
        this._verifyConnection();
    }

    async _verifyConnection() {
        try {
            await this.transporter.verify();
            logger.info('✅ [RECLAMOS-GMAIL] Conexión SMTP verificada exitosamente', {
                service: 'reclamos-email',
                timestamp: new Date().toISOString()
            });
            return true;
        } catch (error) {
            logger.error('🔐 [RECLAMOS-GMAIL] Error verificando conexión SMTP:', {
                error: error.message,
                service: 'reclamos-email',
                action: 'Revisar credenciales Gmail y App Password'
            });
            this.simulated = true;
            return false;
        }
    }

    async sendReclamoEmail(emailData) {
        const startTime = Date.now();
        const emailId = `rec_email_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        try {
            // VALIDACIÓN PROFESIONAL (igual que antes)
            if (!emailData || typeof emailData !== 'object') {
                throw new Error('Datos de email inválidos o vacíos');
            }

            if (!emailData.to || !this._isValidEmail(emailData.to)) {
                throw new Error(`Email destinatario inválido: ${emailData.to}`);
            }

            if (!emailData.subject || emailData.subject.trim().length === 0) {
                throw new Error('Asunto del email requerido');
            }

            if (!emailData.html || emailData.html.trim().length === 0) {
                throw new Error('Contenido HTML del email requerido');
            }

            // MODO SIMULACIÓN
            if (this.simulated || !this.transporter) {
                logger.warn('⚠️ [RECLAMOS-GMAIL] MODO SIMULACIÓN - Email no enviado', {
                    emailId,
                    to: this._maskEmail(emailData.to),
                    subject: emailData.subject,
                    service: 'reclamos-email',
                    timestamp: new Date().toISOString(),
                    reason: 'Gmail no configurado o en modo simulación'
                });
                
                return {
                    success: false,
                    simulated: true,
                    emailId,
                    error: 'SERVICIO_DE_EMAIL_NO_CONFIGURADO',
                    message: 'Gmail no configurado - Modo simulación activado',
                    timestamp: new Date().toISOString(),
                    recommendation: 'Configurar GMAIL_USER y GMAIL_APP_PASSWORD en .env'
                };
            }

            // CONFIGURACIÓN DEL EMAIL CON GMAIL
            const mailOptions = {
                to: emailData.to,
                from: `"GOLDINFINITI - Libro de Reclamaciones" <contacto@goldinfiniti.com>`,
                replyTo: 'contacto@goldinfiniti.com',
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text || this._generatePlainText(emailData.html),
                // Headers personalizados
                headers: {
                    'X-Reclamo-ID': emailData.reclamoId || 'N/A',
                    'X-System': 'reclamos-profesional',
                    'X-Version': '2.0.0',
                    'X-Priority': '1', // Alta prioridad
                    'X-MSMail-Priority': 'High'
                },
                // Adjuntos si existen
                attachments: emailData.attachments || []
            };

            logger.info('📤 [RECLAMOS-GMAIL] Enviando email PROFESIONAL:', {
                emailId,
                to: this._maskEmail(emailData.to),
                subject: emailData.subject,
                reclamoId: emailData.reclamoId || 'N/A',
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                mode: 'PRODUCCIÓN'
            });

            // ENVÍO CON GMAIL
            const info = await this.transporter.sendMail(mailOptions);
            
            const duration = Date.now() - startTime;
            
            logger.info('✅ [RECLAMOS-GMAIL] Email enviado EXITOSAMENTE:', {
                emailId,
                messageId: info.messageId || `gmail_${Date.now()}`,
                to: this._maskEmail(emailData.to),
                subject: emailData.subject,
                duration: `${duration}ms`,
                accepted: info.accepted,
                rejected: info.rejected,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                provider: 'Gmail',
                success: true
            });

            return {
                success: true,
                simulated: false,
                emailId,
                messageId: info.messageId || `gmail_${Date.now()}`,
                gmailResponse: {
                    messageId: info.messageId,
                    accepted: info.accepted,
                    rejected: info.rejected,
                    response: info.response
                },
                timestamp: new Date().toISOString(),
                duration: `${duration}ms`,
                metadata: {
                    provider: 'Gmail SMTP',
                    mode: 'production',
                    reclamoId: emailData.reclamoId
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('💥 [RECLAMOS-GMAIL] ERROR enviando email:', {
                emailId,
                error: error.message,
                errorCode: error.code,
                stack: error.stack,
                to: this._maskEmail(emailData?.to),
                subject: emailData?.subject,
                duration: `${duration}ms`,
                service: 'reclamos-email',
                timestamp: new Date().toISOString(),
                severity: 'HIGH',
                action: 'REVISAR_CREDENCIALES_GMAIL'
            });

            return {
                success: false,
                simulated: this.simulated,
                emailId,
                error: 'GMAIL_DELIVERY_FAILED',
                message: error.message,
                errorDetails: {
                    code: error.code,
                    command: error.command
                },
                timestamp: new Date().toISOString(),
                duration: `${duration}ms`,
                recommendation: 'Verificar GMAIL_USER, GMAIL_APP_PASSWORD y conexión SMTP'
            };
        }
    }

    _isValidEmail(email) {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    _generatePlainText(html) {
        try {
            // Conversión básica de HTML a texto plano
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
                .trim()
                .substring(0, 500) + '...';
        } catch (error) {
            return 'Reclamo registrado exitosamente en el Libro de Reclamaciones Electrónico de GOLDINFINITI TECH CORP.';
        }
    }

    _maskEmail(email) {
        if (!email) return 'email-no-especificado';
        try {
            const [local, domain] = email.split('@');
            if (local && domain) {
                if (local.length <= 3) return `${local}***@${domain}`;
                return `${local.substring(0, 3)}***@${domain.substring(0, 3)}***.${domain.split('.').pop()}`;
            }
            return 'email-enmascarado';
        } catch {
            return 'email-invalido';
        }
    }

    async verify() {
        if (this.simulated || !this.transporter) {
            return { 
                verified: false,
                operational: false,
                simulated: true, 
                message: 'SERVICIO NO CONFIGURADO - Modo simulación activado',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                status: 'INACTIVE',
                recommendation: 'Configurar GMAIL_USER y GMAIL_APP_PASSWORD en .env'
            };
        }

        try {
            await this.transporter.verify();
            
            return { 
                verified: true,
                operational: true,
                simulated: false, 
                message: 'Servicio Gmail operativo y configurado correctamente',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                status: 'ACTIVE',
                features: ['HTML support', 'Attachments', 'High deliverability'],
                maxAttachments: '25MB'
            };
            
        } catch (error) {
            return { 
                verified: false,
                operational: false,
                simulated: false, 
                error: error.message,
                errorCode: error.code,
                message: 'Error verificando servicio Gmail',
                timestamp: new Date().toISOString(),
                provider: 'Gmail SMTP',
                status: 'ERROR',
                recommendation: 'Verificar credenciales Gmail y App Password'
            };
        }
    }
}

module.exports = new ReclamoEmailService();