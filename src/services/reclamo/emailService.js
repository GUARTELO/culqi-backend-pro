// src/services/reclamo/emailService.js
'use strict';

const nodemailer = require('nodemailer');
const logger = require('../../core/utils/logger');

class ReclamoEmailService {
    constructor() {
        this.transporter = null;
        this.simulated = false;
        this._initialize();
    }

    _initialize() {
        try {
            const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
            
            if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
                logger.warn('📧 [RECLAMOS-EMAIL] Credenciales no configuradas - MODO SIMULACIÓN', {
                    service: 'reclamos-email'
                });
                this.simulated = true;
                return;
            }

            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: GMAIL_USER,
                    pass: GMAIL_APP_PASSWORD
                }
            });

            logger.info('✅ [RECLAMOS-EMAIL] Servicio INDEPENDIENTE inicializado con Gmail', {
                service: 'reclamos-email',
                independence: '100% separado de sistema de pagos'
            });

        } catch (error) {
            logger.error('❌ [RECLAMOS-EMAIL] Error inicializando servicio independiente:', {
                error: error.message,
                service: 'reclamos-email'
            });
            this.simulated = true;
        }
    }

    async sendReclamoEmail(emailData) {
        try {
            if (this.simulated || !this.transporter) {
                logger.info('📧 [RECLAMOS-EMAIL SIMULADO] Email preparado:', {
                    to: this._maskEmail(emailData.to),
                    subject: emailData.subject,
                    service: 'reclamos-email'
                });
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                return {
                    success: true,
                    simulated: true,
                    messageId: `sim_rec_${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    independence: 'completa del sistema de pagos'
                };
            }

            const mailOptions = {
                from: `"GOLDINFINITI - Libro de Reclamaciones" <${process.env.GMAIL_USER}>`,
                to: emailData.to,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text || 'Reclamo registrado exitosamente.'
            };

            logger.info('📤 [RECLAMOS-EMAIL REAL] Enviando email INDEPENDIENTE:', {
                to: this._maskEmail(emailData.to),
                subject: emailData.subject,
                service: 'reclamos-email'
            });

            const result = await this.transporter.sendMail(mailOptions);
            
            logger.info('✅ [RECLAMOS-EMAIL] Email enviado exitosamente (SISTEMA INDEPENDIENTE):', {
                messageId: result.messageId,
                to: this._maskEmail(emailData.to),
                service: 'reclamos-email'
            });

            return {
                success: true,
                simulated: false,
                messageId: result.messageId,
                timestamp: new Date().toISOString(),
                independence: 'completa del sistema de pagos'
            };

        } catch (error) {
            logger.error('❌ [RECLAMOS-EMAIL] Error enviando email:', {
                error: error.message,
                to: this._maskEmail(emailData.to),
                service: 'reclamos-email',
                note: 'Este error NO afecta el sistema de pagos'
            });
            
            return {
                success: false,
                error: error.message,
                simulated: this.simulated,
                timestamp: new Date().toISOString()
            };
        }
    }

    _maskEmail(email) {
        if (!email) return 'unknown@email.com';
        const [local, domain] = email.split('@');
        return local && domain ? `${local.substring(0, 2)}***@${domain}` : email;
    }

    async verify() {
        if (this.simulated || !this.transporter) {
            return { 
                verified: true, 
                simulated: true, 
                message: 'Modo simulación',
                independence: 'completa del sistema de pagos'
            };
        }

        try {
            await this.transporter.verify();
            return { 
                verified: true, 
                simulated: false, 
                message: 'Servicio de email para reclamos operativo',
                independence: 'completa del sistema de pagos'
            };
        } catch (error) {
            return { 
                verified: false, 
                error: error.message, 
                simulated: false,
                note: 'Este error NO afecta el sistema de pagos'
            };
        }
    }
}

module.exports = new ReclamoEmailService();