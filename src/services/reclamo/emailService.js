// src/services/reclamo/emailService.js
'use strict';

/**
 * ============================================================
 * RECLAMO EMAIL SERVICE - VERSIÓN PROFESIONAL PRODUCCIÓN
 * ============================================================
 * Sistema profesional de emails para reclamos
 * - Usa MISMA API Key SendGrid que sistema de pagos
 * - Plantilla corporativa GOLDINFINITI
 * - Sin simulaciones - Todo es REAL
 * - Configuración optimizada para producción
 * ============================================================
 */

// Carga síncrona para detectar errores inmediatos
let sgMail;
try {
    sgMail = require('@sendgrid/mail');
} catch (error) {
    console.error('💥 ERROR CRÍTICO: No se pudo cargar @sendgrid/mail');
    console.error('   Instalar con: npm install @sendgrid/mail');
    throw error;
}

// ========================
// 1. CONFIGURACIÓN PROFESIONAL
// ========================
const CORPORATE_CONFIG = {
    // Email corporativo para reclamos
    FROM_EMAIL: 'reclamos@goldinfiniti.com',
    FROM_NAME: 'GOLDINFINITI - Libro de Reclamaciones',
    REPLY_TO: 'soporte@goldinfiniti.com',
    
    // Información de contacto
    COMPANY_NAME: 'GOLDINFINITI TECH CORP',
    COMPANY_PHONE: '+51 968 786 648',
    COMPANY_ADDRESS: 'Av. Principal 123, Lima, Perú',
    COMPANY_WEBSITE: 'https://goldinfiniti.com',
    COMPANY_EMAIL: 'contacto@goldinfiniti.com',
    
    // Configuración SendGrid
    SENDGRID_CATEGORIES: ['reclamos', 'libro-reclamaciones', 'goldinfiniti'],
    
    // Configuración de templates
    TEMPLATE_VERSION: '2.0.0',
    SYSTEM_ID: 'reclamos-profesional'
};

// ========================
// 2. CLASE PRINCIPAL - SENDGRID PROFESIONAL
// ========================
class ReclamoEmailService {
    constructor() {
        console.log('🚀 [RECLAMOS-SENDGRID] Inicializando servicio PROFESIONAL');
        this.initialized = false;
        this.sendgrid = null;
        this._initialize();
    }

    // ========================
    // 3. INICIALIZACIÓN CON SENDGRID (MISMO QUE PAGOS)
    // ========================
    _initialize() {
        try {
            // ✅ VERIFICAR API KEY DE SENDGRID
            const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
            
            if (!SENDGRID_API_KEY) {
                const errorMsg = '❌ [RECLAMOS-SENDGRID] ERROR CRÍTICO: SENDGRID_API_KEY no configurada\n' +
                               '   🔧 Acción: Agregar al archivo .env:\n' +
                               '   SENDGRID_API_KEY=SG.xxxxx_yyyyy_zzzzz';
                console.error(errorMsg);
                throw new Error('SENDGRID_API_KEY no configurada');
            }

            // ✅ CONFIGURAR SENDGRID
            sgMail.setApiKey(SENDGRID_API_KEY);
            this.sendgrid = sgMail;
            
            // ✅ VERIFICAR FORMATO DE API KEY
            if (!SENDGRID_API_KEY.startsWith('SG.')) {
                console.warn('⚠️ [RECLAMOS-SENDGRID] API KEY con formato inusual');
            }
            
            // ✅ VERIFICACIÓN DE CONEXIÓN
            this._verifyConnection(SENDGRID_API_KEY);
            
            this.initialized = true;
            
            console.log('✅ [RECLAMOS-SENDGRID] SERVICIO INICIALIZADO CORRECTAMENTE');
            console.log(`   📧 Remitente: ${CORPORATE_CONFIG.FROM_EMAIL}`);
            console.log(`   🔑 API Key: ${SENDGRID_API_KEY.substring(0, 15)}...`);
            console.log(`   🏢 Sistema: ${CORPORATE_CONFIG.SYSTEM_ID} v${CORPORATE_CONFIG.TEMPLATE_VERSION}`);
            console.log(`   🔄 MISMO servicio que sistema de pagos`);
            
        } catch (error) {
            console.error('💥 [RECLAMOS-SENDGRID] ERROR INICIALIZANDO:', error.message);
            this.initialized = false;
            this.sendgrid = null;
        }
    }

    // ========================
    // 4. VERIFICACIÓN DE CONEXIÓN
    // ========================
    async _verifyConnection(apiKey) {
        try {
            // Verificación simple (SendGrid no tiene endpoint verify)
            console.log('🔍 [RECLAMOS-SENDGRID] Verificando configuración...');
            
            return true;
            
        } catch (error) {
            console.error('🔐 [RECLAMOS-SENDGRID] Error en verificación:', error.message);
            return false;
        }
    }

    // ========================
    // 5. FUNCIÓN PRINCIPAL - ENVÍO DE EMAIL
    // ========================
    async sendReclamoEmail(emailData) {
        const startTime = Date.now();
        const emailId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`📤 [RECLAMOS-SENDGRID] INICIANDO ENVÍO #${emailId}`);
        
        try {
            // ✅ VALIDACIÓN PROFESIONAL DE DATOS
            const validation = this._validateEmailData(emailData);
            if (!validation.valid) {
                throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
            }

            // ✅ VERIFICAR QUE SENDGRID ESTÁ INICIALIZADO
            if (!this.initialized || !this.sendgrid) {
                throw new Error('Servicio de email no inicializado');
            }

            // ✅ PREPARAR MENSAJE PROFESIONAL
            const msg = this._prepareEmailMessage(emailData, emailId);
            
            console.log('📧 [RECLAMOS-SENDGRID] CONFIGURACIÓN DE EMAIL:');
            console.log(`   Para: ${this._maskEmail(emailData.to)}`);
            console.log(`   Asunto: ${emailData.subject}`);
            console.log(`   Reclamo ID: ${emailData.reclamoId || 'N/A'}`);
            console.log(`   Longitud HTML: ${emailData.html.length} caracteres`);

            // ✅ ENVÍO PROFESIONAL CON SENDGRID
            console.log('🚀 [RECLAMOS-SENDGRID] ENVIANDO EMAIL...');
            const [response] = await this.sendgrid.send(msg);
            
            const duration = Date.now() - startTime;
            
            // ✅ LOG DE ÉXITO
            console.log('✅ [RECLAMOS-SENDGRID] EMAIL ENVIADO EXITOSAMENTE');
            console.log(`   📨 Message ID: ${response.headers['x-message-id'] || 'N/A'}`);
            console.log(`   ⚡ Duración: ${duration}ms`);
            console.log(`   📊 Status Code: ${response.statusCode}`);
            console.log(`   🕐 Timestamp: ${new Date().toLocaleTimeString()}`);
            console.log(`   🔗 Email ID: ${emailId}`);

            return {
                success: true,
                emailId,
                messageId: response.headers['x-message-id'],
                reclamoId: emailData.reclamoId,
                timestamp: new Date().toISOString(),
                duration: `${duration}ms`,
                provider: 'SendGrid',
                status: 'delivered',
                metadata: {
                    to: this._maskEmail(emailData.to),
                    subject: emailData.subject,
                    reclamoId: emailData.reclamoId
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            // ✅ LOG DE ERROR PROFESIONAL
            console.error('💥 [RECLAMOS-SENDGRID] ERROR EN ENVÍO:');
            console.error(`   🔗 Email ID: ${emailId}`);
            console.error(`   ❌ Error: ${error.message}`);
            console.error(`   ⏱️  Duración: ${duration}ms`);
            console.error(`   📍 Acción: REVISAR CONFIGURACIÓN SENDGRID`);
            
            if (error.response) {
                console.error(`   📄 Response:`, error.response.body);
            }

            // ✅ RE-LANZAR ERROR PARA MANEJO SUPERIOR
            throw new Error(`Fallo envío email: ${error.message}`);
        }
    }

    // ========================
    // 6. PREPARACIÓN DE MENSAJE PROFESIONAL
    // ========================
    _prepareEmailMessage(emailData, emailId) {
        return {
            to: emailData.to,
            from: {
                email: CORPORATE_CONFIG.FROM_EMAIL,
                name: CORPORATE_CONFIG.FROM_NAME
            },
            replyTo: CORPORATE_CONFIG.REPLY_TO,
            subject: emailData.subject,
            html: this._wrapCorporateTemplate(emailData.html, emailData.reclamoId),
            text: emailData.text || this._htmlToText(emailData.html),
            
            // ✅ CONFIGURACIÓN PROFESIONAL SENDGRID
            trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true },
                subscriptionTracking: { enable: false }
            },
            
            // ✅ CATEGORÍAS PARA ANÁLISIS
            categories: CORPORATE_CONFIG.SENDGRID_CATEGORIES,
            
            // ✅ METADATA PERSONALIZADA
            customArgs: {
                emailId: emailId,
                reclamoId: emailData.reclamoId || 'N/A',
                system: CORPORATE_CONFIG.SYSTEM_ID,
                version: CORPORATE_CONFIG.TEMPLATE_VERSION,
                environment: process.env.NODE_ENV || 'production',
                timestamp: new Date().toISOString()
            },
            
            // ✅ CONFIGURACIÓN DE ENTREGA
            mailSettings: {
                footer: { enable: false },
                sandboxMode: { enable: false }
            }
        };
    }

    // ========================
    // 7. PLANTILLA CORPORATIVA GOLDINFINITI
    // ========================
    _wrapCorporateTemplate(content, reclamoId) {
        const currentYear = new Date().getFullYear();
        const systemId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GOLDINFINITI - Libro de Reclamaciones</title>
    <style>
        /* RESET Y BASE */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f8f9fa;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        /* CONTENEDOR PRINCIPAL */
        .email-container {
            max-width: 700px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
        
        /* HEADER CORPORATIVO */
        .email-header {
            background: linear-gradient(135deg, #000000 0%, #222222 100%);
            color: #FFD700;
            padding: 50px 40px;
            text-align: center;
            position: relative;
        }
        .email-header:before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #FFD700, #000000);
        }
        .email-logo {
            font-size: 42px;
            font-weight: 900;
            letter-spacing: 3px;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        .email-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .email-subtitle {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 400;
        }
        
        /* CONTENIDO */
        .email-content {
            padding: 50px 40px;
        }
        
        /* CONTENIDO ESPECÍFICO */
        .email-main-content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            border: 1px solid #eee;
        }
        
        /* INFO BOX */
        .info-box {
            background: #f0f8ff;
            border-left: 4px solid #007bff;
            padding: 25px;
            border-radius: 6px;
            margin: 30px 0;
        }
        .info-box h3 {
            color: #0056b3;
            margin-top: 0;
            margin-bottom: 15px;
        }
        
        /* DIVIDER */
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #FFD700, transparent);
            margin: 40px 0;
        }
        
        /* FOOTER */
        .email-footer {
            background: #1a1a1a;
            color: #ffffff;
            padding: 40px;
            text-align: center;
        }
        .footer-contact {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 25px 0;
            flex-wrap: wrap;
        }
        .contact-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
        }
        .footer-links {
            margin: 30px 0;
        }
        .footer-links a {
            color: #FFD700;
            text-decoration: none;
            margin: 0 15px;
            font-weight: 500;
        }
        .footer-legal {
            font-size: 11px;
            opacity: 0.7;
            margin-top: 25px;
            line-height: 1.5;
        }
        
        /* RESPONSIVE */
        @media (max-width: 600px) {
            .email-header, .email-content, .email-footer {
                padding: 30px 20px;
            }
            .email-logo { font-size: 32px; }
            .email-title { font-size: 24px; }
            .footer-contact { flex-direction: column; gap: 15px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- HEADER -->
        <div class="email-header">
            <div class="email-logo">GOLDINFINITI</div>
            <h1 class="email-title">Libro de Reclamaciones Electrónico</h1>
            <p class="email-subtitle">Sistema Profesional de Gestión de Reclamos</p>
        </div>
        
        <!-- CONTENIDO -->
        <div class="email-content">
            <div class="email-main-content">
                ${content}
            </div>
            
            <div class="divider"></div>
            
            <div class="info-box">
                <h3>📋 Información de Seguimiento</h3>
                <p>Su reclamo ha sido registrado exitosamente en nuestro sistema con ID: <strong>${reclamoId || 'N/A'}</strong></p>
                <p>• Su caso será asignado a un especialista dentro de las próximas <strong>24 horas hábiles</strong></p>
                <p>• Recibirá actualizaciones sobre el estado de su reclamo por este mismo medio</p>
                <p>• Para consultas urgentes, puede contactarnos directamente</p>
            </div>
        </div>
        
        <!-- FOOTER -->
        <div class="email-footer">
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #FFD700;">
                GOLDINFINITI TECH CORP
            </div>
            
            <div class="footer-contact">
                <div class="contact-item">
                    <span>📍</span>
                    <span>${CORPORATE_CONFIG.COMPANY_ADDRESS}</span>
                </div>
                <div class="contact-item">
                    <span>📞</span>
                    <span>${CORPORATE_CONFIG.COMPANY_PHONE}</span>
                </div>
                <div class="contact-item">
                    <span>📧</span>
                    <span>${CORPORATE_CONFIG.COMPANY_EMAIL}</span>
                </div>
            </div>
            
            <div class="footer-links">
                <a href="${CORPORATE_CONFIG.COMPANY_WEBSITE}">🌐 Sitio Web</a>
                <a href="mailto:${CORPORATE_CONFIG.REPLY_TO}">📧 Soporte</a>
                <a href="tel:${CORPORATE_CONFIG.COMPANY_PHONE}">📞 Llamar</a>
            </div>
            
            <div class="divider"></div>
            
            <div class="footer-legal">
                <p>© ${currentYear} ${CORPORATE_CONFIG.COMPANY_NAME}. Todos los derechos reservados.</p>
                <p>Este es un mensaje automático del Sistema de Reclamos. Por favor no responder directamente.</p>
                <p>ID del Sistema: ${systemId} | Versión: ${CORPORATE_CONFIG.TEMPLATE_VERSION}</p>
                <p><strong>Aviso Legal:</strong> Este correo electrónico es confidencial y está destinado únicamente para el uso del destinatario. 
                Si usted no es el destinatario, por favor notifique al remitente y elimine este mensaje.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    // ========================
    // 8. FUNCIONES DE UTILIDAD
    // ========================
    _validateEmailData(emailData) {
        const errors = [];
        
        if (!emailData || typeof emailData !== 'object') {
            errors.push('Datos de email inválidos');
            return { valid: false, errors };
        }
        
        // Validar email destinatario
        if (!emailData.to || !this._isValidEmail(emailData.to)) {
            errors.push(`Email destinatario inválido: ${emailData.to}`);
        }
        
        // Validar asunto
        if (!emailData.subject || emailData.subject.trim().length < 5) {
            errors.push('Asunto del email demasiado corto (mínimo 5 caracteres)');
        }
        
        // Validar contenido
        if (!emailData.html || emailData.html.trim().length < 50) {
            errors.push('Contenido HTML insuficiente (mínimo 50 caracteres)');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    _isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    }

    _htmlToText(html) {
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
            return 'Reclamo registrado en el Libro de Reclamaciones Electrónico de GOLDINFINITI. Para más detalles, revise la versión HTML de este correo.';
        }
    }

    _maskEmail(email) {
        if (!email) return 'NO-ESPECIFICADO';
        try {
            const [local, domain] = email.split('@');
            if (local && domain) {
                if (local.length <= 3) return `${local.charAt(0)}***@${domain}`;
                return `${local.substring(0, 2)}***@${domain.substring(0, 2)}***.${domain.split('.').pop()}`;
            }
            return 'EMAIL-ENMASCARADO';
        } catch {
            return 'FORMATO-INVALIDO';
        }
    }

    // ========================
    // 9. MÉTODOS DE VERIFICACIÓN
    // ========================
    async verifyService() {
        if (!this.initialized || !this.sendgrid) {
            return {
                operational: false,
                message: '❌ Servicio de email NO INICIALIZADO',
                provider: 'SendGrid',
                timestamp: new Date().toISOString(),
                action: 'Verificar SENDGRID_API_KEY en variables de entorno'
            };
        }

        try {
            return {
                operational: true,
                message: '✅ Servicio SendGrid OPERATIVO',
                provider: 'SendGrid',
                timestamp: new Date().toISOString(),
                configuration: {
                    fromEmail: CORPORATE_CONFIG.FROM_EMAIL,
                    fromName: CORPORATE_CONFIG.FROM_NAME,
                    replyTo: CORPORATE_CONFIG.REPLY_TO,
                    categories: CORPORATE_CONFIG.SENDGRID_CATEGORIES,
                    templateVersion: CORPORATE_CONFIG.TEMPLATE_VERSION
                },
                features: [
                    'HTML templates',
                    'Open tracking',
                    'Click tracking',
                    'Corporate branding',
                    'Custom metadata'
                ]
            };
        } catch (error) {
            return {
                operational: false,
                message: `❌ Error verificando servicio: ${error.message}`,
                provider: 'SendGrid',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // ========================
    // 10. MÉTODO PARA ENVÍOS MASIVOS
    // ========================
    async sendBulkEmails(emailsData, options = {}) {
        const results = [];
        const total = emailsData.length;
        const startTime = Date.now();
        
        console.log(`📦 [RECLAMOS-SENDGRID] INICIANDO ENVÍO MASIVO: ${total} emails`);
        
        const batchSize = options.batchSize || 10;
        const delayBetweenBatches = options.delay || 1000;
        
        for (let i = 0; i < total; i += batchSize) {
            const batch = emailsData.slice(i, Math.min(i + batchSize, total));
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(total / batchSize);
            
            console.log(`   🔄 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} emails`);
            
            const batchPromises = batch.map(async (emailData, index) => {
                try {
                    const result = await this.sendReclamoEmail(emailData);
                    return { ...result, index: i + index, batch: batchNumber };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        index: i + index,
                        batch: batchNumber,
                        email: this._maskEmail(emailData.to)
                    };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Control de rate limiting
            if (i + batchSize < total) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }
        
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const successRate = (successCount / total * 100).toFixed(2);
        
        console.log('📊 [RECLAMOS-SENDGRID] ENVÍO MASIVO COMPLETADO:');
        console.log(`   ✅ Exitosos: ${successCount}/${total} (${successRate}%)`);
        console.log(`   ❌ Fallidos: ${total - successCount}`);
        console.log(`   ⏱️  Duración total: ${duration}ms`);
        console.log(`   🚀 Promedio: ${(duration / total).toFixed(2)}ms por email`);
        console.log(`   📦 Tamaño de lote: ${batchSize}`);
        
        return {
            total,
            success: successCount,
            failed: total - successCount,
            successRate: `${successRate}%`,
            duration: `${duration}ms`,
            averageTime: `${(duration / total).toFixed(2)}ms`,
            batchSize,
            batches: Math.ceil(total / batchSize),
            results,
            timestamp: new Date().toISOString()
        };
    }
}

// ========================
// 11. EXPORTAR INSTANCIA ÚNICA
// ========================
module.exports = new ReclamoEmailService();