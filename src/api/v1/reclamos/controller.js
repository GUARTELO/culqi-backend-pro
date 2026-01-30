'use strict';

const logger = require('../../../core/utils/logger');
const { v4: uuidv4 } = require('uuid');

class ReclamoController {
    constructor() {
        this.stats = {
            totalReclamos: 0,
            emailsEnviados: 0,
            emailsFallados: 0
        };
        
        // Guardar referencia a this para usar en métodos internos
        this._self = this;
        
        // 🚨 Cargar el EmailService REAL
        this.emailService = this._cargarEmailServiceReal();
        
        logger.info('🚀 ReclamoController inicializado', { service: 'reclamos' });
    }

    _cargarEmailServiceReal() {
        try {
            const emailService = require('../../../services/payment/emailService');
            
            // 🔍 DEBUG: Ver qué métodos tiene realmente
            const availableMethods = Object.keys(emailService).filter(k => typeof emailService[k] === 'function');
            logger.info('🔍 EmailService métodos disponibles para reclamos:', { 
                methods: availableMethods.filter(m => !m.startsWith('_')),
                service: 'email-reclamos' 
            });
            
            // Verificar que tenga sendPaymentNotification (el más genérico)
            if (!emailService.sendPaymentNotification) {
                throw new Error('EmailService no tiene sendPaymentNotification');
            }
            
            logger.info('✅ EmailService REAL cargado para reclamos');
            
            // Crear un wrapper que adapte la interfaz
            const self = this;
            
            return {
                // Método principal adaptado
                sendMail: async (emailData) => {
                    logger.info('📤 Adaptando sendMail a sendPaymentNotification', {
                        to: self._maskEmail(emailData.to),
                        subject: emailData.subject,
                        service: 'email-reclamos'
                    });
                    
                    // Crear estructura compatible con sendPaymentNotification
                    const paymentData = {
                        // Información del cliente
                        customerInfo: {
                            email: emailData.to,
                            nombre: emailData.nombre || 'Cliente Reclamo',
                            apellido: '',
                            telefono: ''
                        },
                        
                        // Información del reclamo
                        reclamoInfo: {
                            id: emailData.reclamoId || `REC-${Date.now()}`,
                            fecha: new Date().toISOString(),
                            asunto: emailData.subject,
                            descripcion: 'Reclamo registrado en libro de reclamaciones'
                        },
                        
                        // HTML personalizado
                        htmlContent: emailData.html,
                        
                        // Metadata adicional
                        metadata: {
                            tipo: 'reclamo',
                            origen: 'libro_reclamaciones',
                            template: 'reclamo'
                        }
                    };
                    
                    try {
                        // Llamar al método real del servicio
                        const result = await emailService.sendPaymentNotification(paymentData);
                        
                        // Adaptar la respuesta a nuestro formato esperado
                        return {
                            success: true,
                            messageId: result.messageId || `rec_${Date.now()}`,
                            simulated: false,
                            timestamp: new Date().toISOString()
                        };
                        
                    } catch (error) {
                        logger.error('❌ Error enviando email de reclamo:', {
                            error: error.message,
                            service: 'email-reclamos'
                        });
                        
                        return {
                            success: false,
                            error: error.message,
                            simulated: false,
                            timestamp: new Date().toISOString()
                        };
                    }
                },
                
                // Método para verificar conexión
                verify: async () => {
                    try {
                        if (emailService.verifyService) {
                            return await emailService.verifyService();
                        }
                        return { verified: true, service: 'reclamos' };
                    } catch (error) {
                        throw new Error(`Verificación fallida: ${error.message}`);
                    }
                }
            };
            
        } catch (error) {
            logger.warn('⚠️ EmailService no disponible, usando modo simulación', {
                error: error.message,
                service: 'email-reclamos'
            });
            
            return this._crearEmailServiceSimulado();
        }
    }

    _crearEmailServiceSimulado() {
        const self = this;
        
        return {
            sendMail: async (emailData) => {
                logger.info('📧 [SIMULACIÓN] Email preparado para envío', {
                    to: self._maskEmail(emailData.to),
                    subject: emailData.subject,
                    service: 'email-reclamos'
                });
                
                // Simular delay de envío
                await new Promise(resolve => setTimeout(resolve, 500));
                
                return {
                    success: true,
                    simulated: true,
                    messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString()
                };
            },
            
            verify: async () => {
                return {
                    verified: true,
                    simulated: true,
                    message: 'Servicio en modo simulación'
                };
            }
        };
    }

    /**
     * POST /api/v1/reclamos
     * Procesar reclamo desde frontend y enviar email automático
     */
    async procesarReclamo(req, res) {
        const requestId = `reclamo_${uuidv4().substring(0, 8)}`;
        const startTime = Date.now();

        try {
            logger.info(`📧 [${requestId}] Procesando reclamo desde frontend`, {
                service: 'email-reclamos',
                bodyKeys: Object.keys(req.body)
            });

            // 📌 MAPEO de datos del frontend a estructura interna
            const frontendData = req.body;
            
            // Validar datos mínimos
            if (!frontendData.reclamoId) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_RECLAMO_ID',
                    message: 'ID de reclamo requerido'
                });
            }

            if (!frontendData.consumidor?.email) {
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_EMAIL',
                    message: 'Email del consumidor requerido'
                });
            }

            // 🎯 ESTRUCTURA para el EmailService
            const emailData = {
                to: frontendData.consumidor.email,
                nombre: frontendData.consumidor.nombreCompleto || 'Cliente',
                reclamoId: frontendData.reclamoId,
                subject: `📋 Reclamo #${frontendData.reclamoId} - GOLDINFINITI`,
                html: this._generarHtmlReclamo(frontendData),
                text: `Reclamo #${frontendData.reclamoId} registrado exitosamente.`
            };

            logger.info(`📤 [${requestId}] Enviando email a: ${this._maskEmail(emailData.to)}`, {
                reclamoId: frontendData.reclamoId,
                service: 'email-reclamos',
                simulated: this.emailService.sendMail.toString().includes('[SIMULACIÓN]')
            });

            // Enviar email usando nuestro servicio adaptado
            const emailResult = await this.emailService.sendMail(emailData);

            // Actualizar estadísticas
            this.stats.totalReclamos++;
            if (emailResult.success && !emailResult.simulated) {
                this.stats.emailsEnviados++;
            } else if (!emailResult.success) {
                this.stats.emailsFallados++;
            } else if (emailResult.simulated) {
                logger.info('📨 Email simulado enviado (modo desarrollo)');
            }

            // ✅ Respuesta al frontend
            const totalDuration = Date.now() - startTime;

            const response = {
                success: true,
                message: '✅ Reclamo procesado exitosamente',
                requestId,
                reclamoId: frontendData.reclamoId,
                email: {
                    sent: emailResult.success,
                    to: this._maskEmail(frontendData.consumidor.email),
                    subject: emailData.subject,
                    timestamp: new Date().toISOString(),
                    simulated: emailResult.simulated || false,
                    messageId: emailResult.messageId
                },
                metadata: {
                    response_time: `${totalDuration}ms`,
                    timestamp: new Date().toISOString(),
                    service: 'goldinfiniti-reclamos',
                    mode: emailResult.simulated ? 'simulation' : 'production'
                }
            };

            logger.info(`✅ [${requestId}] Reclamo procesado exitosamente`, {
                reclamoId: frontendData.reclamoId,
                cliente: frontendData.consumidor.nombreCompleto,
                emailEnviado: emailResult.success,
                simulated: emailResult.simulated || false,
                duration: `${totalDuration}ms`,
                service: 'email-reclamos'
            });

            return res.status(200).json(response);

        } catch (error) {
            const errorDuration = Date.now() - startTime;
            
            logger.error(`💥 [${requestId}] Error procesando reclamo`, {
                error: error.message,
                stack: error.stack,
                service: 'email-reclamos'
            });

            return res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Error interno del servidor',
                requestId,
                timestamp: new Date().toISOString(),
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    _generarHtmlReclamo(data) {
        const { reclamoId, consumidor, reclamo } = data;
        const fechaActual = new Date().toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reclamo #${reclamoId} - GOLDINFINITI</title>
            <style>
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 0;
                    background-color: #f5f5f5;
                }
                .container {
                    background: white;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    margin: 20px auto;
                }
                .header {
                    background: linear-gradient(135deg, #1a237e 0%, #311b92 100%);
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                }
                .header p {
                    margin: 10px 0 0;
                    opacity: 0.9;
                    font-size: 14px;
                }
                .content {
                    padding: 30px;
                }
                .reclamo-number {
                    background: #4caf50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 25px;
                    display: inline-block;
                    font-weight: bold;
                    font-size: 18px;
                    margin: 20px 0;
                }
                .info-box {
                    background: #f8f9fa;
                    border-left: 4px solid #2196f3;
                    padding: 20px;
                    margin: 25px 0;
                    border-radius: 0 8px 8px 0;
                }
                .info-box h3 {
                    margin-top: 0;
                    color: #1a237e;
                }
                .customer-info {
                    background: #e8f5e9;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .footer {
                    background: #f1f1f1;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                    border-top: 1px solid #ddd;
                }
                .logo {
                    text-align: center;
                    margin: 20px 0;
                    font-size: 24px;
                    font-weight: bold;
                    color: #1a237e;
                }
                .button {
                    display: inline-block;
                    background: #1a237e;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 10px 0;
                }
                @media (max-width: 600px) {
                    .content {
                        padding: 20px;
                    }
                    .header {
                        padding: 20px 15px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Reclamo Registrado</h1>
                    <p>Libro de Reclamaciones - GOLDINFINITI TECH CORP</p>
                </div>
                
                <div class="content">
                    <div class="logo">GOLDINFINITI</div>
                    
                    <div class="reclamo-number">RECLAMO #${reclamoId}</div>
                    
                    <h2>Estimado(a) ${consumidor.nombreCompleto},</h2>
                    
                    <p>Hemos recibido su reclamo exitosamente y ha sido registrado en nuestro sistema con la siguiente información:</p>
                    
                    <div class="customer-info">
                        <p><strong>👤 Cliente:</strong> ${consumidor.nombreCompleto}</p>
                        <p><strong>📧 Email:</strong> ${consumidor.email}</p>
                        ${consumidor.telefono ? `<p><strong>📞 Teléfono:</strong> ${consumidor.telefono}</p>` : ''}
                    </div>
                    
                    <div class="info-box">
                        <h3>📋 Detalles del Reclamo:</h3>
                        <p><strong>ID de Reclamo:</strong> ${reclamoId}</p>
                        <p><strong>Fecha de Registro:</strong> ${fechaActual}</p>
                        <p><strong>Descripción:</strong></p>
                        <p>${reclamo.descripcion || 'No especificada'}</p>
                    </div>
                    
                    <div class="info-box">
                        <h3>⏱️ Proceso de Atención:</h3>
                        <p>De acuerdo con la <strong>Ley N° 29571 (Código de Protección y Defensa del Consumidor)</strong>, 
                        tenemos <strong>30 días hábiles</strong> para dar respuesta formal a su reclamo.</p>
                        <p>Le mantendremos informado sobre el avance de su caso.</p>
                    </div>
                    
                    <div class="info-box">
                        <h3>📞 Canales de Contacto:</h3>
                        <p>Para consultas adicionales sobre su reclamo:</p>
                        <p>📧 <strong>Email:</strong> contacto@goldinfiniti.com</p>
                        <p>📱 <strong>Teléfono:</strong> 968 786 648</p>
                        <p>🏢 <strong>Dirección:</strong> GOLDINFINITI TECH CORP</p>
                        <p>🔢 <strong>RUC:</strong> 20613360281</p>
                    </div>
                    
                    <p style="text-align: center; margin-top: 30px;">
                        <strong>Gracias por confiar en GOLDINFINITI.</strong><br>
                        Trabajamos para brindarle la mejor solución.
                    </p>
                </div>
                
                <div class="footer">
                    <p>© ${new Date().getFullYear()} GOLDINFINITI TECH CORP - Todos los derechos reservados</p>
                    <p>Sistema de Libro de Reclamaciones Virtual - Este es un mensaje automático, por favor no responder.</p>
                    <p>RUC: 20613360281</p>
                </div>
            </div>
        </body>
        </html>`;
    }

    _maskEmail(email) {
        if (!email) return 'unknown@email.com';
        const [local, domain] = email.split('@');
        if (local && domain) {
            if (local.length <= 2) return `${local}***@${domain}`;
            return `${local.substring(0, 2)}***@${domain}`;
        }
        return email;
    }

    // 📊 Métodos adicionales (stats y health)
    getStats(req, res) {
        const isSimulated = this.emailService.sendMail && 
            this.emailService.sendMail.toString().includes('[SIMULACIÓN]');
        
        return res.status(200).json({
            success: true,
            service: 'Goldinfiniti - Libro de Reclamaciones',
            timestamp: new Date().toISOString(),
            stats: this.stats,
            emailService: {
                status: isSimulated ? 'SIMULADO' : 'REAL',
                mode: isSimulated ? 'development' : 'production',
                available: !!this.emailService.sendMail
            },
            uptime: process.uptime()
        });
    }

    healthCheck(req, res) {
        const hasSendMail = typeof this.emailService.sendMail === 'function';
        const isSimulated = hasSendMail && 
            this.emailService.sendMail.toString().includes('[SIMULACIÓN]');
        
        return res.status(200).json({
            success: true,
            service: 'Reclamo Service',
            status: hasSendMail ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            components: {
                emailService: hasSendMail ? 'operational' : 'unavailable',
                database: 'not_required',
                api: 'operational'
            },
            details: {
                emailMode: isSimulated ? 'simulation' : 'production',
                totalReclamos: this.stats.totalReclamos,
                version: '1.0.0'
            }
        });
    }

    // Método para verificar el servicio de email
    async verifyEmailService(req, res) {
        try {
            if (!this.emailService.verify) {
                return res.status(200).json({
                    success: true,
                    message: 'Servicio de email disponible (sin verificación)',
                    simulated: true
                });
            }
            
            const result = await this.emailService.verify();
            
            return res.status(200).json({
                success: true,
                message: 'Servicio de email verificado',
                ...result
            });
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'EMAIL_SERVICE_ERROR',
                message: 'Error verificando servicio de email',
                details: error.message
            });
        }
    }
}

module.exports = new ReclamoController();