'use strict';

const logger = require('../../../core/utils/logger');
const { v4: uuidv4 } = require('uuid');
const reclamoEmailService = require('../../../services/reclamo/emailService');

class ReclamoController {
    constructor() {
        this.stats = {
            totalReclamos: 0,
            emailsEnviados: 0,
            emailsFallados: 0,
            lastUpdate: new Date().toISOString()
        };
        
        // ✅ CORRECCIÓN: USAR la instancia YA CREADA, NO hacer "new"
        this.emailService = reclamoEmailService;  // ← SIN "new"
        
        logger.info('🚀 [PRODUCCIÓN] ReclamoController inicializado - Sistema PROFESIONAL de Reclamos', { 
            service: 'reclamos',
            environment: process.env.NODE_ENV || 'production',
            version: '2.0.0'
        });
    }

    /**
     * POST /api/v1/reclamos
     * Endpoint PROFESIONAL para procesar reclamos desde frontend
     */
    async procesarReclamo(req, res) {
        const requestId = `reclamo_prod_${uuidv4().substring(0, 8)}_${Date.now()}`;
        const startTime = Date.now();

        try {
            logger.info(`📧 [PRODUCCIÓN:${requestId}] Iniciando procesamiento de reclamo`, {
                service: 'reclamos-produccion',
                clientIp: req.ip,
                userAgent: req.headers['user-agent'],
                contentType: req.headers['content-type']
            });

            // ✅ VALIDACIÓN PROFESIONAL DE DATOS
            const frontendData = req.body;
            
            if (!frontendData || typeof frontendData !== 'object') {
                return this._errorResponse(res, 400, 'INVALID_REQUEST', 'Cuerpo de la solicitud inválido', requestId);
            }

            if (!frontendData.reclamoId || !frontendData.reclamoId.trim()) {
                return this._errorResponse(res, 400, 'MISSING_RECLAMO_ID', 'ID de reclamo es requerido', requestId);
            }

            if (!frontendData.consumidor?.email || !this._validarEmail(frontendData.consumidor.email)) {
                return this._errorResponse(res, 400, 'INVALID_EMAIL', 'Email del consumidor inválido o faltante', requestId);
            }

            if (!frontendData.consumidor?.nombreCompleto || !frontendData.consumidor.nombreCompleto.trim()) {
                return this._errorResponse(res, 400, 'MISSING_NAME', 'Nombre completo del consumidor es requerido', requestId);
            }

            // ✅ GENERACIÓN DE EMAIL PROFESIONAL
            const emailData = {
                to: frontendData.consumidor.email.trim(),
                nombre: frontendData.consumidor.nombreCompleto.trim(),
                reclamoId: frontendData.reclamoId.trim(),
                subject: `⚠️ CONFIRMACIÓN OFICIAL DE RECLAMO #${frontendData.reclamoId.trim()} - LIBRO DE RECLAMACIONES GOLDINFINITI`,
                html: this._generarHtmlReclamoProfesional(frontendData),
                text: this._generarTextoReclamo(frontendData),
                metadata: {
                    reclamoId: frontendData.reclamoId,
                    fechaRecepcion: new Date().toISOString(),
                    origen: 'libro_reclamaciones_virtual',
                    sistema: 'goldinfiniti_v2'
                }
            };

            logger.info(`📤 [PRODUCCIÓN:${requestId}] Enviando email OFICIAL a cliente`, {
                reclamoId: frontendData.reclamoId,
                cliente: this._maskName(frontendData.consumidor.nombreCompleto),
                email: this._maskEmail(frontendData.consumidor.email),
                timestamp: new Date().toISOString()
            });

            // ✅ ENVÍO PROFESIONAL DE EMAIL
            const emailResult = await this.emailService.sendReclamoEmail(emailData);

            // ✅ ACTUALIZACIÓN DE ESTADÍSTICAS DE PRODUCCIÓN
            this._actualizarEstadisticas(emailResult);

            // ✅ RESPUESTA PROFESIONAL AL FRONTEND
            const totalDuration = Date.now() - startTime;

            const response = {
                success: true,
                message: '✅ RECLAMO REGISTRADO OFICIALMENTE EN EL LIBRO DE RECLAMACIONES',
                requestId,
                timestamp: new Date().toISOString(),
                datosReclamo: {
                    id: frontendData.reclamoId,
                    fechaRegistro: new Date().toISOString(),
                    consumidor: {
                        nombre: this._maskName(frontendData.consumidor.nombreCompleto),
                        email: this._maskEmail(frontendData.consumidor.email),
                        telefono: frontendData.consumidor.telefono ? this._maskPhone(frontendData.consumidor.telefono) : 'No proporcionado'
                    }
                },
                notificacion: {
                    emailEnviado: emailResult.success,
                    timestampEnvio: emailResult.timestamp,
                    idTransaccion: emailResult.messageId,
                    modo: emailResult.simulated ? 'SIMULACIÓN' : 'PRODUCCIÓN',
                    servicio: 'Sistema Independiente de Notificaciones GOLDINFINITI'
                },
                informacionLegal: {
                    plazoRespuesta: '30 días hábiles',
                    referenciaLegal: 'Ley N° 29571 - Código de Protección y Defensa del Consumidor',
                    contactoOficial: 'contacto@goldinfiniti.com',
                    telefonoOficial: '968 786 648',
                    rucEmpresa: '20613360281'
                },
                rendimiento: {
                    tiempoProcesamiento: `${totalDuration}ms`,
                    sistema: 'Backend GOLDINFINITI v2.0',
                    ambiente: process.env.NODE_ENV || 'production'
                }
            };

            logger.info(`✅ [PRODUCCIÓN:${requestId}] Reclamo procesado EXITOSAMENTE`, {
                reclamoId: frontendData.reclamoId,
                cliente: this._maskName(frontendData.consumidor.nombreCompleto),
                emailEnviado: emailResult.success,
                duracion: `${totalDuration}ms`,
                timestamp: new Date().toISOString()
            });

            return res.status(200).json(response);

        } catch (error) {
            const errorDuration = Date.now() - startTime;
            
            logger.error(`💥 [PRODUCCIÓN:${requestId}] ERROR CRÍTICO procesando reclamo`, {
                error: error.message,
                stack: error.stack,
                clienteIp: req.ip,
                duracion: `${errorDuration}ms`,
                timestamp: new Date().toISOString()
            });

            return this._errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 
                'Error interno del sistema. Por favor, intente nuevamente o contacte a soporte.', 
                requestId);
        }
    }

    /**
     * GENERADOR DE HTML PROFESIONAL PARA RECLAMOS
     */
    _generarHtmlReclamoProfesional(data) {
        const { reclamoId, consumidor, reclamo } = data;
        const fechaActual = new Date();
        const fechaFormateada = fechaActual.toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const horaFormateada = fechaActual.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const fechaLimite = this._calcularFechaLimiteLegal(30);

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación Oficial de Reclamo #${reclamoId} - GOLDINFINITI TECH CORP</title>
    <style>
        /* ESTILOS PROFESIONALES PARA PRODUCCIÓN */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f8f9fa;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .email-container {
            max-width: 700px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            border: 1px solid #e0e0e0;
        }
        
        .header-official {
            background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
            color: #ffffff;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header-official::before {
            content: "⚖️";
            font-size: 120px;
            position: absolute;
            opacity: 0.1;
            top: 20px;
            right: 30px;
        }
        
        .header-official h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        
        .header-official .subtitle {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 300;
            margin-top: 5px;
        }
        
        .badge-official {
            background: #d32f2f;
            color: white;
            padding: 12px 28px;
            border-radius: 50px;
            display: inline-block;
            font-weight: 700;
            font-size: 18px;
            margin: 25px 0;
            box-shadow: 0 6px 20px rgba(211, 47, 47, 0.25);
            border: 3px solid #ffcdd2;
            letter-spacing: 1px;
        }
        
        .content-official {
            padding: 40px;
        }
        
        .section-official {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 28px;
            margin: 28px 0;
            border-left: 5px solid #d32f2f;
            border: 1px solid #e9ecef;
        }
        
        .section-title {
            color: #d32f2f;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .section-title i {
            font-size: 24px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin: 25px 0;
        }
        
        .info-card {
            background: white;
            padding: 22px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            border: 1px solid #e0e0e0;
            transition: transform 0.2s ease;
        }
        
        .info-card:hover {
            transform: translateY(-2px);
        }
        
        .info-card strong {
            color: #555;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
            margin-bottom: 8px;
        }
        
        .info-card .value {
            color: #d32f2f;
            font-size: 22px;
            font-weight: 700;
            margin: 8px 0;
        }
        
        .legal-notice {
            background: #fff3e0;
            border: 2px solid #ff9800;
            border-radius: 10px;
            padding: 25px;
            margin: 30px 0;
            position: relative;
        }
        
        .legal-notice::before {
            content: "⚠️";
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border: 2px solid #ff9800;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }
        
        .process-timeline {
            position: relative;
            padding-left: 40px;
            margin: 30px 0;
        }
        
        .process-timeline::before {
            content: "";
            position: absolute;
            left: 20px;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(to bottom, #d32f2f, #ff9800);
        }
        
        .timeline-step {
            position: relative;
            margin-bottom: 28px;
            padding-left: 25px;
        }
        
        .timeline-step::before {
            content: "✓";
            position: absolute;
            left: -30px;
            top: 0;
            background: white;
            border: 3px solid #d32f2f;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: #d32f2f;
            font-weight: bold;
        }
        
        .contact-section {
            background: #e8f5e9;
            border-radius: 10px;
            padding: 25px;
            margin-top: 30px;
        }
        
        .contact-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-top: 20px;
        }
        
        .contact-item {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #c8e6c9;
            transition: all 0.3s ease;
        }
        
        .contact-item:hover {
            border-color: #d32f2f;
            transform: translateY(-3px);
        }
        
        .footer-official {
            background: #263238;
            color: #ffffff;
            padding: 35px 30px;
            text-align: center;
            border-top: 5px solid #d32f2f;
        }
        
        .footer-official p {
            margin: 8px 0;
            font-size: 13px;
            opacity: 0.9;
            line-height: 1.5;
        }
        
        .footer-official .legal-disclaimer {
            font-size: 11px;
            opacity: 0.7;
            margin-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 15px;
        }
        
        @media (max-width: 768px) {
            .content-official {
                padding: 25px;
            }
            .header-official {
                padding: 30px 20px;
            }
            .header-official h1 {
                font-size: 26px;
            }
            .info-grid {
                grid-template-columns: 1fr;
            }
            .contact-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- ENCABEZADO OFICIAL -->
        <div class="header-official">
            <h1>CONFIRMACIÓN OFICIAL DE RECLAMO</h1>
            <div class="subtitle">Libro de Reclamaciones Electrónico • GOLDINFINITI TECH CORP • RUC 20613360281</div>
        </div>
        
        <div class="content-official">
            <!-- NÚMERO DE RECLAMO -->
            <div style="text-align: center;">
                <div class="badge-official">RECLAMO #${reclamoId}</div>
            </div>
            
            <!-- SALUDO PERSONALIZADO -->
            <h2 style="color: #d32f2f; margin: 25px 0 20px 0;">Estimado(a) ${consumidor.nombreCompleto},</h2>
            <p style="margin-bottom: 25px; font-size: 16px; line-height: 1.7;">
                Hemos recibido <strong>oficialmente</strong> su reclamo en nuestro <strong>Libro de Reclamaciones Electrónico</strong>, 
                registrado con fecha <strong>${fechaFormateada}</strong> a las <strong>${horaFormateada}</strong>.
            </p>
            
            <!-- INFORMACIÓN DEL RECLAMO -->
            <div class="section-official">
                <h3 class="section-title"><i>📋</i> INFORMACIÓN DEL RECLAMO</h3>
                <div class="info-grid">
                    <div class="info-card">
                        <strong>Número de Reclamo</strong>
                        <div class="value">#${reclamoId}</div>
                        <small style="color: #666;">Identificador oficial único</small>
                    </div>
                    <div class="info-card">
                        <strong>Fecha de Registro</strong>
                        <div class="value">${fechaFormateada}</div>
                        <small style="color: #666;">${horaFormateada}</small>
                    </div>
                    <div class="info-card">
                        <strong>Solicitante</strong>
                        <div class="value">${consumidor.nombreCompleto}</div>
                        <small style="color: #666;">Titular del reclamo</small>
                    </div>
                </div>
            </div>
            
            <!-- DETALLES DEL RECLAMO -->
            <div class="section-official">
                <h3 class="section-title"><i>📝</i> DETALLES DEL RECLAMO</h3>
                <div style="background: white; padding: 25px; border-radius: 8px; border: 2px solid #f0f0f0; margin: 20px 0;">
                    <p style="margin-bottom: 15px;"><strong>Descripción:</strong></p>
                    <p style="font-size: 15px; line-height: 1.6; color: #444;">
                        ${reclamo.descripcion || 'No se proporcionó descripción adicional.'}
                    </p>
                    ${reclamo.tipo ? `<p style="margin-top: 15px;"><strong>Tipo de Reclamo:</strong> ${reclamo.tipo}</p>` : ''}
                </div>
            </div>
            
            <!-- AVISO LEGAL -->
            <div class="legal-notice">
                <h3 style="color: #e65100; margin-top: 0; text-align: center;">⏱️ PLAZO LEGAL DE RESPUESTA</h3>
                <p style="text-align: center; font-size: 16px; line-height: 1.6;">
                    De acuerdo con la <strong>Ley N° 29571</strong> (Código de Protección y Defensa del Consumidor), 
                    tenemos <strong>30 días hábiles</strong> para emitir respuesta formal a su reclamo.
                </p>
                <p style="text-align: center; font-size: 14px; color: #e65100; margin-top: 15px; font-weight: 600;">
                    📅 <strong>Fecha límite estimada:</strong> ${fechaLimite}
                </p>
            </div>
            
            <!-- PROCESO DE ATENCIÓN -->
            <div class="process-timeline">
                <h3 style="color: #d32f2f; margin-bottom: 25px;">📋 PROCESO DE ATENCIÓN</h3>
                <div class="timeline-step">
                    <strong style="display: block; margin-bottom: 5px; color: #333;">1. RECEPCIÓN Y REGISTRO</strong>
                    <p style="color: #666; font-size: 14px;">Su reclamo ha sido ingresado en nuestro sistema oficial.</p>
                </div>
                <div class="timeline-step">
                    <strong style="display: block; margin-bottom: 5px; color: #333;">2. ANÁLISIS Y EVALUACIÓN</strong>
                    <p style="color: #666; font-size: 14px;">Nuestro equipo especializado revisará su caso detalladamente.</p>
                </div>
                <div class="timeline-step">
                    <strong style="display: block; margin-bottom: 5px; color: #333;">3. INVESTIGACIÓN INTERNA</strong>
                    <p style="color: #666; font-size: 14px;">Recopilaremos toda la información necesaria para su caso.</p>
                </div>
                <div class="timeline-step">
                    <strong style="display: block; margin-bottom: 5px; color: #333;">4. RESPUESTA FORMAL</strong>
                    <p style="color: #666; font-size: 14px;">Le notificaremos nuestra respuesta dentro del plazo legal establecido.</p>
                </div>
            </div>
            
            <!-- CONTACTO OFICIAL -->
            <div class="contact-section">
                <h3 style="color: #2e7d32; margin-bottom: 20px;">📞 CONTACTO OFICIAL</h3>
                <p style="margin-bottom: 20px;">Para consultas sobre el estado de su reclamo:</p>
                <div class="contact-grid">
                    <div class="contact-item">
                        <strong style="display: block; margin-bottom: 8px; color: #d32f2f;">📧 CORREO ELECTRÓNICO</strong>
                        <span style="font-size: 15px;">contacto@goldinfiniti.com</span>
                    </div>
                    <div class="contact-item">
                        <strong style="display: block; margin-bottom: 8px; color: #d32f2f;">📱 TELÉFONO OFICIAL</strong>
                        <span style="font-size: 15px;">968 786 648</span>
                    </div>
                    <div class="contact-item">
                        <strong style="display: block; margin-bottom: 8px; color: #d32f2f;">🏢 EMPRESA</strong>
                        <span style="font-size: 15px;">GOLDINFINITI TECH CORP</span>
                    </div>
                    <div class="contact-item">
                        <strong style="display: block; margin-bottom: 8px; color: #d32f2f;">🔢 RUC</strong>
                        <span style="font-size: 15px;">20613360281</span>
                    </div>
                </div>
            </div>
            
            <!-- MENSAJE FINAL -->
            <div style="text-align: center; margin: 40px 0 30px 0; padding: 25px; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%); border-radius: 12px;">
                <p style="font-size: 18px; color: #d32f2f; font-weight: 700; margin-bottom: 10px;">
                    ¡Gracias por permitirnos atender su caso!
                </p>
                <p style="font-size: 15px; color: #555;">
                    Trabajamos comprometidos para brindarle la mejor solución y mantener su confianza en nuestros servicios.
                </p>
            </div>
        </div>
        
        <!-- PIE DE PÁGINA OFICIAL -->
        <div class="footer-official">
            <p>© ${new Date().getFullYear()} GOLDINFINITI TECH CORP • Todos los derechos reservados</p>
            <p>Libro de Reclamaciones Electrónico • Sistema Certificado v2.0</p>
            <p>RUC 20613360281 • Registro Oficial de Empresa</p>
            <div class="legal-disclaimer">
                Este es un mensaje automático generado por nuestro sistema de Libro de Reclamaciones. 
                Por favor, no responda a este correo. Para consultas, utilice los canales oficiales mencionados.
                Este correo es confidencial y está destinado únicamente al receptor mencionado.
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * MÉTODOS PROFESIONALES AUXILIARES
     */
    _generarTextoReclamo(data) {
        const { reclamoId, consumidor, reclamo } = data;
        const fechaLimite = this._calcularFechaLimiteLegal(30);
        
        return `CONFIRMACIÓN OFICIAL DE RECLAMO #${reclamoId}

Estimado(a) ${consumidor.nombreCompleto},

Hemos recibido oficialmente su reclamo en el Libro de Reclamaciones Electrónico de GOLDINFINITI TECH CORP.

INFORMACIÓN DEL RECLAMO:
• Número de Reclamo: #${reclamoId}
• Fecha de Registro: ${new Date().toLocaleDateString('es-PE')}
• Solicitante: ${consumidor.nombreCompleto}
• Email: ${consumidor.email}

DETALLES:
${reclamo.descripcion || 'No se proporcionó descripción adicional.'}

INFORMACIÓN LEGAL:
De acuerdo con la Ley N° 29571, tenemos 30 días hábiles para emitir respuesta formal.
Fecha límite estimada: ${fechaLimite}

CONTACTO OFICIAL:
• Email: contacto@goldinfiniti.com
• Teléfono: 968 786 648
• RUC: 20613360281

Este es un mensaje automático. No responda a este correo.

GOLDINFINITI TECH CORP
Libro de Reclamaciones Electrónico
RUC 20613360281`;
    }

    _calcularFechaLimiteLegal(diasHabiles) {
        const fecha = new Date();
        let diasAgregados = 0;
        
        while (diasAgregados < diasHabiles) {
            fecha.setDate(fecha.getDate() + 1);
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

    _actualizarEstadisticas(emailResult) {
        this.stats.totalReclamos++;
        
        if (emailResult.success && !emailResult.simulated) {
            this.stats.emailsEnviados++;
        } else if (!emailResult.success) {
            this.stats.emailsFallados++;
        }
        
        this.stats.lastUpdate = new Date().toISOString();
    }

    _validarEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    _maskEmail(email) {
        if (!email) return 'no-especificado@email.com';
        const [local, domain] = email.split('@');
        return local && domain ? 
            `${local.substring(0, 3)}***@${domain.substring(0, 3)}***.com` : 
            'email-enmascarado@dominio.com';
    }

    _maskName(nombre) {
        if (!nombre) return 'Cliente';
        const partes = nombre.trim().split(' ');
        if (partes.length === 1) return `${partes[0].charAt(0)}***`;
        return `${partes[0]} ${partes[1].charAt(0)}***`;
    }

    _maskPhone(telefono) {
        if (!telefono) return 'No proporcionado';
        return telefono.length > 4 ? 
            `***${telefono.substring(telefono.length - 4)}` : 
            '***';
    }

    _errorResponse(res, status, code, message, requestId) {
        logger.error(`❌ [ERROR:${requestId}] ${code}: ${message}`);
        
        return res.status(status).json({
            success: false,
            error: {
                code: code,
                message: message,
                requestId: requestId,
                timestamp: new Date().toISOString(),
                referencia: 'Consulte con soporte@goldinfiniti.com'
            }
        });
    }

    /**
     * ENDPOINTS DE MONITOREO PROFESIONAL
     */
    getStats(req, res) {
        return res.status(200).json({
            success: true,
            sistema: 'Libro de Reclamaciones GOLDINFINITI',
            version: '2.0.0',
            ambiente: process.env.NODE_ENV || 'production',
            timestamp: new Date().toISOString(),
            estadisticas: {
                ...this.stats,
                tasaExito: this.stats.totalReclamos > 0 ? 
                    ((this.stats.emailsEnviados / this.stats.totalReclamos) * 100).toFixed(2) + '%' : 
                    '0%'
            },
            configuracion: {
                servicioEmail: 'Sistema Independiente de Reclamos',
                integridad: '100% separado del sistema de pagos',
                seguridad: 'Nivel 2 - Protección de datos personales',
                cumplimiento: 'Ley N° 29571 - Libro de Reclamaciones'
            }
        });
    }

    healthCheck(req, res) {
        const serviceStatus = this.emailService ? 'OPERATIVO' : 'INOPERATIVO';
        const simulated = this.emailService?.simulated || false;
        
        return res.status(200).json({
            success: true,
            sistema: 'Reclamo Service GOLDINFINITI',
            status: 'OPERATIONAL',
            timestamp: new Date().toISOString(),
            componentes: {
                api: 'OPERATIVO',
                servicioEmail: serviceStatus,
                baseDatos: 'NO_REQUERIDO',
                seguridad: 'ACTIVADO'
            },
            detalles: {
                modoEmail: simulated ? 'SIMULACIÓN' : 'PRODUCCIÓN',
                totalReclamos: this.stats.totalReclamos,
                versionApi: '2.0.0',
                separacionSistemas: 'COMPLETA - No afecta sistema de pagos'
            },
            metrica: {
                uptime: process.uptime(),
                memoria: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
                ambiente: process.env.NODE_ENV || 'production'
            }
        });
    }

    async verifyEmailService(req, res) {
        try {
            if (!this.emailService.verify) {
                return res.status(200).json({
                    success: true,
                    status: 'BÁSICO',
                    mensaje: 'Servicio de email disponible en modo básico',
                    independencia: 'Sistema 100% separado de pagos',
                    timestamp: new Date().toISOString()
                });
            }
            
            const result = await this.emailService.verify();
            
            return res.status(200).json({
                success: true,
                status: 'VERIFICADO',
                ...result,
                sistema: 'Servicio Independiente de Reclamos',
                cumplimiento: 'Estándar GOLDINFINITI v2.0',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'SERVICE_VERIFICATION_FAILED',
                mensaje: 'Error verificando servicio de email',
                detalle: error.message,
                impacto: 'NO AFECTA SISTEMA DE PAGOS',
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new ReclamoController();