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
                subject: `⚠️ CONFIRMACIÓN DE RECLAMO #${frontendData.reclamoId} - LIBRO DE RECLAMACIONES GOLDINFINITI`,
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
        const horaActual = new Date().toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmación de Reclamo #${reclamoId} - GOLDINFINITI</title>
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    line-height: 1.8;
                    color: #333;
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    margin: 40px auto;
                    border: 5px solid #f8f9fa;
                }
                .header-reclamo {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                    padding: 40px 20px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }
                .header-reclamo::before {
                    content: "⚠️";
                    font-size: 80px;
                    position: absolute;
                    opacity: 0.1;
                    top: 10px;
                    right: 20px;
                }
                .header-reclamo h1 {
                    margin: 0;
                    font-size: 32px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                .header-reclamo .subtitle {
                    font-size: 16px;
                    opacity: 0.9;
                    margin-top: 10px;
                    font-weight: 300;
                }
                .content-reclamo {
                    padding: 40px;
                }
                .badge-reclamo {
                    background: #ee5a24;
                    color: white;
                    padding: 12px 25px;
                    border-radius: 50px;
                    display: inline-block;
                    font-weight: bold;
                    font-size: 18px;
                    margin: 20px 0;
                    box-shadow: 0 5px 15px rgba(238, 90, 36, 0.3);
                    border: 3px solid #ffd8cc;
                }
                .section {
                    background: #f8f9fa;
                    border-radius: 15px;
                    padding: 25px;
                    margin: 25px 0;
                    border-left: 5px solid #ee5a24;
                }
                .section-title {
                    color: #ee5a24;
                    margin-top: 0;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .section-title::before {
                    content: "📝";
                    font-size: 24px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin: 25px 0;
                }
                .info-item {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                    border: 2px solid #e9ecef;
                }
                .warning-box {
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 30px 0;
                    text-align: center;
                }
                .footer-reclamo {
                    background: #343a40;
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-top: 5px solid #ee5a24;
                }
                .timeline {
                    position: relative;
                    padding-left: 30px;
                    margin: 25px 0;
                }
                .timeline::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: #ee5a24;
                }
                .timeline-item {
                    position: relative;
                    margin-bottom: 20px;
                    padding-left: 20px;
                }
                .timeline-item::before {
                    content: "⏰";
                    position: absolute;
                    left: -35px;
                    top: 0;
                    background: white;
                    border: 3px solid #ee5a24;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }
                .contact-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }
                .contact-item {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    border: 2px solid #e9ecef;
                }
                @media (max-width: 600px) {
                    .content-reclamo {
                        padding: 20px;
                    }
                    .header-reclamo {
                        padding: 30px 15px;
                    }
                    .header-reclamo h1 {
                        font-size: 24px;
                    }
                    .info-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header-reclamo">
                    <h1>📋 RECLAMO REGISTRADO</h1>
                    <div class="subtitle">Libro de Reclamaciones Electrónico • GOLDINFINITI TECH CORP</div>
                </div>
                
                <div class="content-reclamo">
                    <div class="badge-reclamo">#${reclamoId}</div>
                    
                    <h2 style="color: #ee5a24;">Estimado(a) ${consumidor.nombreCompleto},</h2>
                    <p>Hemos recibido formalmente su reclamo en nuestro <strong>Libro de Reclamaciones Electrónico</strong> y ha sido registrado con el siguiente detalle:</p>
                    
                    <div class="section">
                        <h3 class="section-title">Información del Reclamo</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <strong>🔢 N° de Reclamo:</strong><br>
                                <span style="font-size: 24px; font-weight: bold; color: #ee5a24;">${reclamoId}</span>
                            </div>
                            <div class="info-item">
                                <strong>📅 Fecha de Registro:</strong><br>
                                ${fechaActual}<br>
                                <small>${horaActual}</small>
                            </div>
                            <div class="info-item">
                                <strong>👤 Registrado por:</strong><br>
                                ${consumidor.nombreCompleto}
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Detalles del Reclamo</h3>
                        <p><strong>Descripción:</strong></p>
                        <div style="background: white; padding: 20px; border-radius: 10px; border: 2px dashed #dee2e6; margin: 15px 0;">
                            ${reclamo.descripcion || 'No se proporcionó descripción adicional.'}
                        </div>
                        
                        ${reclamo.tipo ? `
                        <p><strong>Tipo de Reclamo:</strong> ${reclamo.tipo}</p>
                        ` : ''}
                    </div>
                    
                    <div class="warning-box">
                        <h3 style="color: #856404; margin-top: 0;">⏱️ Plazo Legal de Respuesta</h3>
                        <p>De acuerdo con la <strong>Ley N° 29571</strong> (Código de Protección y Defensa del Consumidor), 
                        tenemos <strong>30 días hábiles</strong> para dar respuesta formal a su reclamo.</p>
                        <p style="font-size: 14px; color: #856404;">Fecha límite aproximada: ${this._calcularFechaLimite(30)}</p>
                    </div>
                    
                    <div class="timeline">
                        <h3 style="color: #ee5a24;">📋 Proceso de Atención</h3>
                        <div class="timeline-item">
                            <strong>1. Recepción y Registro</strong><br>
                            <small>Su reclamo ha sido ingresado en nuestro sistema.</small>
                        </div>
                        <div class="timeline-item">
                            <strong>2. Análisis y Evaluación</strong><br>
                            <small>Nuestro equipo especializado revisará su caso.</small>
                        </div>
                        <div class="timeline-item">
                            <strong>3. Investigación Interna</strong><br>
                            <small>Recopilaremos toda la información necesaria.</small>
                        </div>
                        <div class="timeline-item">
                            <strong>4. Respuesta Formal</strong><br>
                            <small>Le notificaremos nuestra respuesta dentro del plazo legal.</small>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">📞 Canales de Contacto</h3>
                        <p>Para consultas sobre el estado de su reclamo:</p>
                        <div class="contact-grid">
                            <div class="contact-item">
                                <strong>📧 Correo Electrónico</strong><br>
                                contacto@goldinfiniti.com
                            </div>
                            <div class="contact-item">
                                <strong>📱 Teléfono</strong><br>
                                968 786 648
                            </div>
                            <div class="contact-item">
                                <strong>🏢 Oficina Principal</strong><br>
                                GOLDINFINITI TECH CORP
                            </div>
                            <div class="contact-item">
                                <strong>🔢 RUC</strong><br>
                                20613360281
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 40px 0 20px 0; padding: 20px; background: #f8f9fa; border-radius: 15px;">
                        <p style="font-size: 18px; color: #ee5a24; font-weight: bold;">
                            Gracias por permitirnos atender su caso.<br>
                            Trabajamos para brindarle la mejor solución.
                        </p>
                    </div>
                </div>
                
                <div class="footer-reclamo">
                    <p style="margin: 0 0 10px 0; font-size: 14px;">
                        © ${new Date().getFullYear()} GOLDINFINITI TECH CORP • Libro de Reclamaciones Electrónico
                    </p>
                    <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                        RUC 20613360281 • Sistema automatizado • Este mensaje es confidencial
                    </p>
                    <p style="margin: 10px 0 0 0; font-size: 11px; opacity: 0.6;">
                        Este correo es una confirmación automática de recepción de su reclamo.
                    </p>
                </div>
            </div>
        </body>
        </html>`;
    }

    _calcularFechaLimite(diasHabiles) {
        const fecha = new Date();
        let diasAgregados = 0;
        
        while (diasAgregados < diasHabiles) {
            fecha.setDate(fecha.getDate() + 1);
            // No contar sábados (6) ni domingos (0)
            if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
                diasAgregados++;
            }
        }
        
        return fecha.toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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