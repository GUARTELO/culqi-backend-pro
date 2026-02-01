const reclamoEmailService = require('../../../services/reclamo/emailService');
const logger = require('../../../core/utils/logger');

// 🔥 SOLUCIÓN SIMPLE Y DIRECTA
const admin = require('firebase-admin');

// INICIALIZACIÓN GARANTIZADA
const initializeFirebase = () => {
  try {
    console.log('🔄 ReclamoController: Inicializando Firebase...');
    
    // 1. VERIFICAR SI YA HAY APP
    if (admin.apps.length > 0) {
      console.log('✅ Firebase ya inicializado, usando instancia existente');
      return admin.firestore();
    }
    
    // 2. OBTENER CREDENCIALES DE RENDER
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.error('❌ ERROR: FIREBASE_SERVICE_ACCOUNT no configurada en Render');
      throw new Error('Configura FIREBASE_SERVICE_ACCOUNT en Render');
    }
    
    console.log('🔐 Parseando credenciales de Render...');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // 3. INICIALIZAR CON CREDENCIALES
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://mi-tienda-online-10630.firebaseio.com"
    });
    
    console.log('✅ Firebase inicializado exitosamente');
    console.log(`📊 Project: ${serviceAccount.project_id}`);
    
    return admin.firestore();
    
  } catch (error) {
    console.error('❌ ERROR inicializando Firebase:', error.message);
    throw error;
  }
};

// INTENTAR INICIALIZAR
let db;
try {
  db = initializeFirebase();
  console.log('🎯 Firestore listo para operaciones');
} catch (error) {
  console.error('🔥 ERROR FATAL: No se pudo inicializar Firebase');
  // Crear mock simple para evitar crash
  db = {
    collection: () => ({ 
      doc: () => ({ 
        get: () => Promise.resolve({ exists: false }) 
      }) 
    }),
    _isMock: true
  };
}

// VERIFICAR
console.log('🔍 Estado Firestore:', db._isMock ? 'MOCK' : 'REAL');

const COLECCION_RECLAMOS = 'libro_reclamaciones_indecopi';

class ReclamoController {
    // ... EL RESTO DE TU CÓDIGO PERMANECE EXACTAMENTE IGUAL ...
    // ...
    // ... TODO EL RESTO DEL CÓDIGO PERMANECE EXACTAMENTE IGUAL ...
    
    /**
     * 🔥 ENDPOINT PRINCIPAL - ENVÍA EMAILS DE CONFIRMACIÓN
     * POST /api/v1/reclamos
     * 
     * @param {Object} req - Request con { reclamoId }
     * @param {Object} res - Response
     */
    async crearReclamo(req, res) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        // LOG INICIAL
        logger.info('🔥 RECLAMO_CONTROLLER - Iniciando procesamiento', {
            requestId,
            reclamoId: req.body?.reclamoId,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            method: req.method,
            endpoint: req.originalUrl
        });
        
        try {
            // 1. VALIDACIÓN ESTRICTA DE DATOS DE ENTRADA
            const { reclamoId } = req.body;
            
            if (!reclamoId) {
                logger.warn('VALIDACIÓN FALLIDA - reclamoId requerido', { requestId });
                return this._responderError(res, 400, 'BAD_REQUEST', 'El campo reclamoId es requerido');
            }
            
            // 2. VALIDAR FORMATO DEL CORRELATIVO
            if (!this._validarFormatoCorrelativo(reclamoId)) {
                logger.warn('VALIDACIÓN FALLIDA - Formato de correlativo inválido', {
                    requestId,
                    reclamoId,
                    formatoRecibido: reclamoId,
                    formatoEsperado: 'REC-YYYYMMDD-NNN'
                });
                return this._responderError(res, 400, 'INVALID_FORMAT', 
                    `Formato de reclamoId inválido. Recibido: "${reclamoId}". Esperado: "REC-YYYYMMDD-NNN"`);
            }
            
            // 3. VERIFICAR EXISTENCIA EN FIREBASE
            const existeEnFirebase = await this._verificarExistenciaFirebase(reclamoId);
            
            if (!existeEnFirebase.existe) {
                logger.error('RECLAMO NO ENCONTRADO EN FIREBASE', {
                    requestId,
                    reclamoId,
                    error: existeEnFirebase.error
                });
                return this._responderError(res, 404, 'NOT_FOUND', 
                    `El reclamo ${reclamoId} no fue encontrado en el sistema. Verifique el número.`);
            }
            
            // 4. OBTENER DATOS COMPLETOS PARA LOGGING
            const datosReclamo = await this._obtenerDatosReclamo(reclamoId);
            
            logger.info('✅ VALIDACIONES SUPERADAS - Iniciando envío de emails', {
                requestId,
                reclamoId,
                cliente: datosReclamo.consumidor?.nombreCompleto,
                emailCliente: datosReclamo.consumidor?.email,
                timestampFirebase: datosReclamo.fechaRegistro,
                tipoReclamo: datosReclamo.reclamo?.tipoSolicitud
            });
            
            // 5. EJECUTAR ENVÍO DE EMAILS (USUARIO + ADMIN)
            const resultadoEmails = await reclamoEmailService.enviarConfirmacion(reclamoId);
            
            const processingTime = Date.now() - startTime;
            
            // 6. RESPUESTA DE ÉXITO
            logger.info('🎉 PROCESAMIENTO COMPLETADO - Emails enviados exitosamente', {
                requestId,
                reclamoId,
                processingTime: `${processingTime}ms`,
                emailUsuario: resultadoEmails.emails?.usuario?.sent ? 'ENVIADO' : 'FALLADO',
                emailAdmin: resultadoEmails.emails?.admin?.sent ? 'ENVIADO' : 'FALLADO',
                messageIdUsuario: resultadoEmails.emails?.usuario?.messageId,
                messageIdAdmin: resultadoEmails.emails?.admin?.messageId
            });
            
            return res.status(200).json({
                success: true,
                message: 'Reclamo procesado exitosamente',
                metadata: {
                    requestId,
                    processingTime: `${processingTime}ms`,
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'production',
                    version: '1.0.0'
                },
                data: {
                    reclamo: {
                        id: reclamoId,
                        numeroReclamo: datosReclamo.numeroReclamo || reclamoId,
                        estado: 'NOTIFICADO',
                        fechaRegistro: datosReclamo.fechaRegistro,
                        fechaLimiteRespuesta: datosReclamo.legal?.fechaLimiteRespuesta
                    },
                    emails: {
                        usuario: {
                            sent: resultadoEmails.emails?.usuario?.sent || false,
                            recipient: datosReclamo.consumidor?.email,
                            messageId: resultadoEmails.emails?.usuario?.messageId,
                            timestamp: new Date().toISOString()
                        },
                        admin: {
                            sent: resultadoEmails.emails?.admin?.sent || false,
                            recipient: 'cirobriones99@gmail.com',
                            messageId: resultadoEmails.emails?.admin?.messageId,
                            timestamp: new Date().toISOString()
                        }
                    },
                    cliente: {
                        nombre: datosReclamo.consumidor?.nombreCompleto,
                        documento: `${datosReclamo.consumidor?.tipoDocumento || ''} ${datosReclamo.consumidor?.numeroDocumento || ''}`.trim(),
                        telefono: datosReclamo.consumidor?.telefono
                    }
                }
            });
            
        } catch (error) {
            const errorTime = Date.now() - startTime;
            
            // LOG DE ERROR CRÍTICO
            logger.error('💥 ERROR CRÍTICO EN CONTROLLER DE RECLAMOS', {
                requestId,
                reclamoId: req.body?.reclamoId,
                error: error.message,
                stack: error.stack,
                processingTime: `${errorTime}ms`,
                endpoint: req.originalUrl,
                body: req.body
            });
            
            // RESPUESTA DE ERROR CONTROLADA
            return this._responderError(res, 500, 'INTERNAL_SERVER_ERROR',
                'Ocurrió un error interno al procesar el reclamo. El equipo técnico ha sido notificado.');
        }
    }
    
    // ==================== MÉTODOS PRIVADOS ====================
    
    /**
     * 🔥 VALIDA EL FORMATO DEL CORRELATIVO
     * Formato: REC-YYYYMMDD-NNN
     */
    _validarFormatoCorrelativo(reclamoId) {
        const regex = /^REC-\d{8}-\d{3}$/;
        if (!regex.test(reclamoId)) return false;
        
        // Extraer fecha del correlativo
        const fechaStr = reclamoId.substring(4, 12); // YYYYMMDD
        const año = parseInt(fechaStr.substring(0, 4));
        const mes = parseInt(fechaStr.substring(4, 6)) - 1;
        const dia = parseInt(fechaStr.substring(6, 8));
        
        // Validar fecha real
        const fecha = new Date(año, mes, dia);
        return fecha.getFullYear() === año && 
               fecha.getMonth() === mes && 
               fecha.getDate() === dia;
    }
    
    /**
     * 🔥 VERIFICA SI EL RECLAMO EXISTE EN FIREBASE
     */
           async _verificarExistenciaFirebase(reclamoId) {
        try {
            console.log('🔍 ReclamoController: Buscando reclamo:', reclamoId);
            
            // VERIFICAR QUE DB SEA VÁLIDO
            if (!db || typeof db.collection !== 'function') {
                console.error('❌ ERROR: Firestore no está disponible');
                console.error('   db es:', typeof db);
                console.error('   db.collection:', typeof db?.collection);
                return { existe: false, error: 'Firebase no configurado' };
            }
            
            // BUSCAR SIMPLEMENTE
            const docRef = db.collection(COLECCION_RECLAMOS).doc(reclamoId);
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                console.log('✅ Reclamo encontrado:', reclamoId);
                return { existe: true, tipo: 'id_directo' };
            }
            
            console.log('⚠️ Reclamo no encontrado:', reclamoId);
            return { existe: false, error: 'No encontrado' };
            
        } catch (error) {
            console.error('❌ ERROR en Firebase:', error.message);
            console.error('   Stack:', error.stack);
            return { existe: false, error: error.message };
        }
    }
    
    /**
     * 🔥 OBTIENE DATOS DEL RECLAMO PARA LOGGING
     */
    async _obtenerDatosReclamo(reclamoId) {
        try {
            let docSnap = await db.collection(COLECCION_RECLAMOS).doc(reclamoId).get();
            
            if (!docSnap.exists) {
                const querySnapshot = await db.collection(COLECCION_RECLAMOS)
                    .where('numeroReclamo', '==', reclamoId)
                    .limit(1)
                    .get();
                    
                if (!querySnapshot.empty) {
                    docSnap = querySnapshot.docs[0];
                }
            }
            
            return docSnap.exists ? docSnap.data() : {};
        } catch (error) {
            logger.warn('Error obteniendo datos de reclamo para logging:', error);
            return {};
        }
    }
    
    /**
     * 🔥 RESPONDER ERROR ESTANDARIZADO
     */
    _responderError(res, statusCode, errorCode, message) {
        return res.status(statusCode).json({
            success: false,
            error: {
                code: errorCode,
                message: message,
                timestamp: new Date().toISOString()
            },
            metadata: {
                service: 'libro_reclamaciones',
                version: '1.0.0'
            }
        });
    }
    
    /**
     * 🔥 ENDPOINT DE HEALTH CHECK
     */
        async healthCheck(req, res) {
        try {
            // VERIFICACIÓN SIMPLE DE FIREBASE
            let firebaseCheck = 'DISCONNECTED';
            
            if (db && !db._isMock) {
                try {
                    // Intentar operación simple
                    await db.collection(COLECCION_RECLAMOS).limit(1).get();
                    firebaseCheck = 'CONNECTED';
                } catch (error) {
                    firebaseCheck = 'ERROR: ' + error.message;
                }
            } else if (db._isMock) {
                firebaseCheck = 'MOCK (sin conexión real)';
            }
            
            res.status(200).json({
                success: true,
                service: 'libro_reclamaciones_api',
                status: 'OPERATIONAL',
                timestamp: new Date().toISOString(),
                checks: {
                    firebase: firebaseCheck,
                    sendgrid: process.env.SENDGRID_API_KEY ? 'CONFIGURADO' : 'NO_CONFIGURADO',
                    environment: process.env.NODE_ENV || 'production',
                    uptime: process.uptime()
                },
                version: '1.0.0',
                endpoints: {
                    crearReclamo: 'POST /api/v1/reclamos',
                    health: 'GET /api/v1/reclamos/health'
                }
            });
        } catch (error) {
            res.status(200).json({
                success: false,
                service: 'libro_reclamaciones_api',
                status: 'DEGRADED',
                error: error.message,
                timestamp: new Date().toISOString(),
                firebase_status: db?._isMock ? 'MOCK' : 'UNKNOWN'
            });
        }
    }
}

module.exports = new ReclamoController();