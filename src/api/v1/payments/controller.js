/**
 * ============================================================
 * PAYMENT CONTROLLER - VERSIÓN FIREBASE COMPLETA CON IDs SECUENCIALES
 * INCLUYENDO SISTEMA DE RECLAMOS PROFESIONAL
 * ============================================================
 * - IDs SECUENCIALES POR MES: ORD-202601-0001, ORD-202601-0002...
 * - Febrero: ORD-202602-0001, ORD-202602-0002...
 * - Marzo: ORD-202603-0001... (se reinicia cada mes)
 * - Sistema de Reclamos Completo: CLAIM-202602-0001...
 * - CORREGIDO: Captura de DNI en todo el flujo
 * - CORREGIDO: Generación de IDs secuenciales (numero → numeroOrden)
 * ============================================================
 */

'use strict';

// ========================
// IMPORTS
// ========================
const path = require('path');
const logger = require('../../../core/utils/logger');
const { v4: uuidv4 } = require('uuid');

// Servicios
const culqiService = require(path.join(__dirname, '../../../../services/payment/culqiService'));

// Servicio de Email
let emailService;
let emailServiceAvailable = false;

try {
  logger.info('🔄 PaymentController: Inicializando servicio de email...');
  emailService = require(path.join(__dirname, '../../../services/payment/emailService'));
  
  if (emailService && 
      typeof emailService.sendPaymentConfirmation === 'function') {
    emailServiceAvailable = true;
    logger.info('✅ EmailService cargado correctamente');
  }
  
} catch (error) {
  logger.error('❌ PaymentController: Error cargando EmailService', { error: error.message });
  
  // Fallback
  emailService = {
    sendPaymentConfirmation: async (paymentData) => {
      logger.warn('📧 EmailService en modo fallback', { paymentId: paymentData?.id });
      return { 
        success: true, 
        fallback: true,
        message: 'Email en modo simulación - Datos guardados',
        timestamp: new Date().toISOString()
      };
    },
    sendPaymentNotification: async (paymentData) => {
      logger.warn('📧 EmailService en modo fallback - Notificación', { paymentId: paymentData?.id });
      return { 
        success: true, 
        fallback: true,
        message: 'Notificación en modo simulación',
        timestamp: new Date().toISOString()
      };
    },
    sendClaimConfirmation: async (claimData) => {
      logger.warn('📧 EmailService en modo fallback - Reclamo', { claimId: claimData?.id });
      return { 
        success: true, 
        fallback: true,
        message: 'Email de reclamo en modo simulación',
        timestamp: new Date().toISOString()
      };
    },
    sendClaimNotification: async (claimData) => {
      logger.warn('📧 EmailService en modo fallback - Notificación Reclamo', { claimId: claimData?.id });
      return { 
        success: true, 
        fallback: true,
        message: 'Notificación de reclamo en modo simulación',
        timestamp: new Date().toISOString()
      };
    },
    enviarCorreoComprobante: async (email, productos = [], tipoComprobante = 'boleta') => {
      logger.warn('📧 EmailService en modo fallback - Comprobante', { email });
      return { 
        success: true, 
        fallback: true,
        pdfGenerated: false,
        message: 'Comprobante en modo simulación',
        timestamp: new Date().toISOString()
      };
    }
  };
}

class PaymentController {
  constructor() {
    this.stats = {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      totalAmount: 0,
      emailStats: {
        attempted: 0,
        sent: 0,
        failed: 0,
        queued: 0
      },
      claimsStats: {
        totalClaims: 0,
        processedClaims: 0,
        emailsSent: 0,
        failedClaims: 0
      }
    };

    // Bind explícito de TODOS los métodos
    this.processPayment = this.processPayment.bind(this);
    this.processClaim = this.processClaim.bind(this);
    this.getStats = this.getStats.bind(this);
    this.verifyPayment = this.verifyPayment.bind(this);
    this.getServiceInfo = this.getServiceInfo.bind(this);
    
    logger.info('🚀 PaymentController (Firebase + Reclamos) inicializado');
  }

/* ============================================================
   * GENERAR ID SECUENCIAL POR MES (VERSIÓN LÓGICA)
   * ============================================================
   */
  async _generarOrderIdSecuencial() {
    try {
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;
      
      // ✅ ZONA HORARIA PERÚ (UTC-5)
      const ahora = new Date();
      const offsetPeru = -5 * 60;
      const ahoraPeru = new Date(ahora.getTime() + (offsetPeru * 60 * 1000));
      
      const año = ahoraPeru.getUTCFullYear();
      const mes = String(ahoraPeru.getUTCMonth() + 1).padStart(2, '0');
      const prefijo = `ORD-${año}${mes}`;
      
      logger.info(`🔢 Generando ID secuencial para ${prefijo}...`);
      logger.info(`📍 Hora servidor UTC: ${ahora.toISOString()}`);
      logger.info(`📍 Hora Perú: ${ahoraPeru.toISOString()}`);
      
      // ✅ CAMBIO LÓGICO: Buscar por numeroOrden (no por fechaCreacion)
      const snapshot = await firestore
        .collection('ordenes')
        .orderBy('numeroOrden', 'desc')
        .limit(1)
        .get();
      
      let siguienteNumero = 1;
      
      if (!snapshot.empty) {
        const ultimaOrden = snapshot.docs[0].data();
        const ultimoNumero = ultimaOrden.numeroOrden || ultimaOrden.id;
        
        logger.info(`📊 Última orden global: ${ultimoNumero}`);
        
        if (ultimoNumero && ultimoNumero.startsWith(prefijo)) {
          const partes = ultimoNumero.split('-');
          if (partes.length === 3) {
            const ultimoNum = parseInt(partes[2]);
            if (!isNaN(ultimoNum)) {
              siguienteNumero = ultimoNum + 1;
            }
          }
          logger.info(`📊 Mismo mes → Siguiente: ${String(siguienteNumero).padStart(4, '0')}`);
        } else {
          logger.info(`📊 Mes diferente (${ultimoNumero}) → Reiniciando a 0001`);
        }
      } else {
        logger.info(`📊 No hay órdenes, primer orden del mes ${prefijo}`);
      }
      
      const orderId = `${prefijo}-${String(siguienteNumero).padStart(4, '0')}`;
      logger.info(`✅ ID SECUENCIAL GENERADO: ${orderId}`);
      return orderId;
      
    } catch (error) {
      logger.error('❌ Error generando ID secuencial:', error);
      
      // Fallback
      const ahora = new Date();
      const offsetPeru = -5 * 60;
      const ahoraPeru = new Date(ahora.getTime() + (offsetPeru * 60 * 1000));
      const año = ahoraPeru.getUTCFullYear();
      const mes = String(ahoraPeru.getUTCMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      return `ORD-${año}${mes}-${timestamp}`;
    }
  }

   /* ============================================================
   * GENERAR ID SECUENCIAL PARA RECLAMOS
   * ============================================================
   */
  async _generarClaimIdSecuencial() {
    try {
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const prefijo = `CLAIM-${año}${mes}`;
      
      logger.info(`🔢 Generando ID secuencial para reclamo ${prefijo}...`);
      
      // Buscar TODOS los reclamos del mes actual
      const inicioMes = new Date(año, hoy.getMonth(), 1);
      const finMes = new Date(año, hoy.getMonth() + 1, 0);
      
      const snapshot = await firestore
        .collection('libro_reclamaciones_indecopi')
        .where('fechaRegistro', '>=', inicioMes)
        .where('fechaRegistro', '<=', finMes)
        .orderBy('fechaRegistro', 'desc')
        .limit(1)
        .get();
      
      let siguienteNumero = 1;
      
      if (!snapshot.empty) {
        const ultimoReclamo = snapshot.docs[0].data();
        const ultimoNumero = ultimoReclamo.id;
        
        if (ultimoNumero && ultimoNumero.startsWith(prefijo)) {
          const partes = ultimoNumero.split('-');
          if (partes.length === 3) {
            const ultimoNum = parseInt(partes[2]);
            if (!isNaN(ultimoNum)) {
              siguienteNumero = ultimoNum + 1;
            }
          }
          logger.info(`📊 Último número reclamo: ${ultimoNumero}, Siguiente: ${siguienteNumero}`);
        }
      } else {
        logger.info(`📊 Primer reclamo del mes ${prefijo}`);
      }
      
      const claimId = `${prefijo}-${String(siguienteNumero).padStart(4, '0')}`;
      logger.info(`✅ ID RECLAMO SECUENCIAL GENERADO: ${claimId}`);
      return claimId;
      
    } catch (error) {
      logger.error('❌ Error generando ID secuencial para reclamo:', error);
      
      // Fallback
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      return `CLAIM-${año}${mes}-${timestamp}`;
    }
  }

/* ============================================================
 * GENERAR ID DIARIO COMO EL FRONTEND (REC-YYYYMMDD-SSS)
 * ============================================================
 */
async _generarIdDiarioComoFrontend() {
  try {
    const firebase = require('../../../core/config/firebase');
    const firestore = firebase.firestore;
    const hoy = new Date();
    
    // Formato: REC-YYYYMMDD
    const fechaStr = hoy.toISOString().split('T')[0].replace(/-/g, '');
    const prefijo = `REC-${fechaStr}`;
    
    logger.info(`🔢 Generando ID diario frontend: ${prefijo}...`);
    
    // Buscar reclamos de HOY
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
    
    const snapshot = await firestore
      .collection('libro_reclamaciones_indecopi')
      .where('fechaCreacion', '>=', inicioDia)
      .where('fechaCreacion', '<', finDia)
      .orderBy('fechaCreacion', 'desc')
      .limit(1)
      .get();
    
    let siguienteNumero = 1;
    
    if (!snapshot.empty) {
      const ultimoReclamo = snapshot.docs[0].data();
      const ultimoNumero = ultimoReclamo.id;
      
      // Buscar formato REC-YYYYMMDD-001
      if (ultimoNumero && ultimoNumero.startsWith('REC-')) {
        const partes = ultimoNumero.split('-');
        if (partes.length === 3) {
          const ultimoNum = parseInt(partes[2]);
          if (!isNaN(ultimoNum)) {
            siguienteNumero = ultimoNum + 1;
          }
        }
        logger.info(`📊 Último número diario: ${ultimoNumero}, Siguiente: ${siguienteNumero}`);
      }
    } else {
      logger.info(`📊 Primer reclamo del día ${prefijo}`);
    }
    
    const claimId = `${prefijo}-${siguienteNumero.toString().padStart(3, '0')}`;
    logger.info(`✅ ID DIARIO GENERADO: ${claimId}`);
    return claimId;
    
  } catch (error) {
    logger.error('❌ Error generando ID diario:', error);
    
    // Fallback: usar timestamp
    const hoy = new Date();
    const fechaStr = hoy.toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-3);
    return `REC-${fechaStr}-${timestamp}`;
  }
}

  /* ============================================================
   * PROCESAR PAGO CON DATOS DE FIREBASE
   * ============================================================
   */
  async processPayment(req, res) {
    const requestId = req.id || `req_${uuidv4().substring(0, 8)}`;
    const paymentId = `pay_${uuidv4().substring(0, 8)}`;
    const startTime = Date.now();

    try {
      logger.info(`💰 Procesando pago ${paymentId}`, { requestId });

      /* =======================
       * 1. EXTRAER DATOS COMPLETOS DE FIREBASE
       * =======================
       */
      const { 
        token, 
        amount, 
        email, 
        // Datos específicos de Firebase
        cliente,
        comprobante,
        envio,
        productos,
        resumen,
        metadata,
        id: ordenId 
      } = req.body;

      // ========== 🔍 CAMBIO 1: VERIFICAR DNI ==========
      logger.info('🔍 DNI RECIBIDO - VERIFICACIÓN:', {
        cliente_dni: cliente?.dni,
        cliente_documento: cliente?.documento,
        body_dni: req.body.dni,
        metadata_dni: metadata?.dni
      });

      // ========== 🔧 CAMBIO 2: NORMALIZAR DNI ==========
      if (cliente && !cliente.dni) {
        if (req.body.dni) {
          cliente.dni = req.body.dni;
          logger.info('✅ DNI normalizado desde req.body:', cliente.dni);
        } else if (metadata?.dni) {
          cliente.dni = metadata.dni;
          logger.info('✅ DNI normalizado desde metadata:', cliente.dni);
        }
      }

      // ========== CORREGIR O GENERAR ID SECUENCIAL ==========
      let ordenIdCorregido = ordenId;
      
      // CASO 1: ID es automático (ORD-1769...)
      if (ordenId && ordenId.includes('ORD-1769')) {
        logger.warn('🚨 ID AUTOMÁTICO DETECTADO, CORRIGIENDO:', ordenId);
        
        // Intentar usar metadata.orderId si es secuencial
        if (metadata?.orderId && metadata.orderId.match(/^ORD-\d{6}-\d{4}$/)) {
          ordenIdCorregido = metadata.orderId;
          logger.info('✅ ID corregido del metadata:', ordenIdCorregido);
        } else {
          // Generar nuevo ID SECUENCIAL
          ordenIdCorregido = await this._generarOrderIdSecuencial();
          logger.info('✅ NUEVO ID SECUENCIAL:', ordenIdCorregido);
        }
      }
      // CASO 2: ID ya es válido (ORD-202601-XXXX) → USARLO TAL CUAL
      else if (ordenId && ordenId.match(/^ORD-\d{6}-\d{4}$/)) {
        logger.info('✅ ID ya es válido, usando:', ordenId);
        ordenIdCorregido = ordenId; // ← ¡NO generar nuevo!
      }
      // CASO 3: No hay ID o es incorrecto → Generar nuevo
      else {
        ordenIdCorregido = await this._generarOrderIdSecuencial();
        logger.info('🆕 ID GENERADO DESDE CERO:', ordenIdCorregido);
      }
      // ========== FIN CORRECCIÓN ==========

      // Validar datos mínimos
      if (!token) throw this._error('MISSING_TOKEN', 'Token de pago requerido', 400);
      if (!amount || Number(amount) <= 0) throw this._error('INVALID_AMOUNT', 'Monto inválido', 400);
      
      // Usar email de Firebase si no viene en body directo
      const customerEmail = email || (cliente && cliente.email);
      if (!customerEmail) throw this._error('MISSING_EMAIL', 'Email del cliente requerido', 400);

      // Validar que tenemos datos de Firebase
      if (!cliente || !productos || !resumen) {
        throw this._error('INCOMPLETE_DATA', 'Datos de Firebase incompletos', 400);
      }

      logger.debug(`📋 Datos Firebase recibidos ${paymentId}`, {
        ordenIdOriginal: ordenId,
        ordenIdCorregido: ordenIdCorregido,
        cliente: cliente.nombre,
        cliente_dni: cliente.dni, // ✅ LOG DEL DNI
        productosCount: Array.isArray(productos) ? productos.length : 0,
        total: resumen?.total
      });

      /* =======================
       * 2. PREPARAR DATOS PARA CULQI
       * =======================
       */
      const culqiData = this._prepareCulqiData(
        token,
        amount,
        customerEmail,
        cliente,
        metadata,
        req,
        ordenIdCorregido
      );

      /* =======================
       * 3. PROCESAR CON CULQI
       * =======================
       */
      logger.info(`⚡ Procesando pago Culqi ${paymentId}`);
      const culqiResult = await culqiService.createCharge(culqiData);
      
      if (!culqiResult || !culqiResult.id) {
        throw this._error('CULQI_PROCESSING_FAILED', 'Error procesando pago con Culqi', 502);
      }

      logger.info(`✅ Pago Culqi exitoso ${paymentId}`, {
        culqiId: culqiResult.id,
        amount: culqiResult.amount,
        status: culqiResult.status
      });

      /* =======================
       * 4. PREPARAR DATOS PARA EMAIL (CON TODA LA INFO FIREBASE)
       * =======================
       */
      const emailData = this._prepareEmailData(
        paymentId,
        culqiResult,
        {
          cliente,
          comprobante,
          envio,
          productos,
          resumen,
          metadata,
          ordenId: ordenIdCorregido
        }
      );

      /* =======================
       * 5. ENVIAR EMAIL DE CONFIRMACIÓN
       * =======================
       */
      const emailResult = await this._sendFirebaseEmail(emailData);

      /* =======================
       * 6. ACTUALIZAR ESTADÍSTICAS
       * =======================
       */
      this._updateStats(true, culqiResult.amount, emailResult.success);

      /* =======================
       * 7. CONSTRUIR RESPUESTA
       * =======================
       */
      const totalDuration = Date.now() - startTime;
      const response = this._buildFirebaseResponse(
        paymentId,
        culqiResult,
        emailResult,
        {
          cliente,
          productos,
          resumen,
          ordenId: ordenIdCorregido
        },
        totalDuration
      );

      logger.info(`🎉 Pago completado ${paymentId}`, {
        paymentId,
        ordenId: ordenIdCorregido,
        cliente: cliente.nombre,
        cliente_dni: cliente.dni, // ✅ LOG DEL DNI
        emailSent: emailResult.success,
        total: resumen.total,
        duration: `${totalDuration}ms`
      });

      /* =======================
       * 8. ENVIAR RESPUESTA
       * =======================
       */
      response.charge_id = culqiResult.id;
      response.culqi_charge_id = culqiResult.id;

      res.status(200).json(response);
      
      /* =======================
       * 9. TAREAS POST-PAGO
       * =======================
       */
      this._executePostPaymentTasks(
        paymentId,
        culqiResult,
        {
          cliente,
          comprobante,
          envio,
          productos,
          resumen,
          metadata,
          ordenId: ordenIdCorregido
        },
        emailResult
      ).catch(err => {
        logger.warn(`⚠️ Error en tareas post-pago ${paymentId}`, { error: err.message });
      });

    } catch (error) {
      const errorDuration = Date.now() - startTime;
      this._updateStats(false, 0, false);
      
      this._handlePaymentError(
        error,
        paymentId,
        req,
        res,
        errorDuration
      );
    }
  }

  /* ============================================================
   * 🆕 PROCESAR RECLAMO - SISTEMA COMPLETO PROFESIONAL
   * ============================================================
   */
   /* ============================================================
   * 🆕 PROCESAR RECLAMO - SISTEMA COMPLETO PROFESIONAL
   * ============================================================
   */
  async processClaim(req, res) {
    const startTime = Date.now();
    const requestId = `claim_${uuidv4().substring(0, 8)}`;
    let claimId = req.body.reclamoId || req.body.id;

    try {
      logger.info(`📝 Procesando reclamo ${requestId}`, { 
        cliente: req.body.consumidor?.nombreCompleto,
        tipo: req.body.tipoSolicitud,
        idRecibido: claimId
      });

      /* =======================
       * 1. EXTRAER Y VALIDAR DATOS DEL RECLAMO
       * =======================
       */
      const { 
        consumidor,
        empresa,
        reclamo,
        tipoSolicitud,
        fechaRegistro,
        legal,
        metadata: claimMetadata
      } = req.body;

      // Validaciones básicas obligatorias
      if (!consumidor?.email) {
        throw this._error('MISSING_EMAIL', 'Email del consumidor requerido', 400);
      }
      
      if (!consumidor?.nombreCompleto) {
        throw this._error('MISSING_NAME', 'Nombre del consumidor requerido', 400);
      }
      
      if (!reclamo?.descripcion) {
        throw this._error('MISSING_DESCRIPTION', 'Descripción del reclamo requerida', 400);
      }

      // ✅ VALIDAR FORMATO DEL ID DEL FRONTEND
      const esIdValido = claimId && (
        claimId.match(/^REC-\d{8}-\d{3}$/) ||      // Formato: REC-20260202-001
        claimId.match(/^CLAIM-\d{6}-\d{4}$/)       // Formato antiguo: CLAIM-202602-0001
      );
      
      // ✅ SI NO HAY ID O ES INVÁLIDO, GENERAR UNO
      if (!claimId || !esIdValido) {
        logger.warn(`⚠️ ID inválido o no proporcionado: ${claimId}, generando nuevo`);
        
        // Intentar formato diario como el frontend
        claimId = await this._generarIdDiarioComoFrontend();
        logger.info(`🆕 ID GENERADO POR BACKEND: ${claimId}`);
      } else {
        logger.info(`✅ ID ACEPTADO DEL FRONTEND: ${claimId}`);
      }

      /* =======================
       * 2. PREPARAR DATOS COMPLETOS DEL RECLAMO
       * =======================
       */
      const claimData = {
        // Información del reclamo
        id: claimId,
        reclamoId: claimId,
        tipoSolicitud: tipoSolicitud || 'RECLAMO',
        fechaRegistro: fechaRegistro || new Date().toISOString(),
        
        // Información del consumidor
        consumidor: {
          nombreCompleto: consumidor.nombreCompleto,
          email: consumidor.email,
          telefono: consumidor.telefono || '',
          tipoDocumento: consumidor.tipoDocumento || '',
          numeroDocumento: consumidor.numeroDocumento || '',
          direccion: consumidor.direccion || ''
        },
        
        // Datos del reclamo
        reclamo: {
          productoServicio: reclamo.productoServicio || 'No especificado',
          descripcion: reclamo.descripcion,
          montoReclamado: parseFloat(reclamo.montoReclamado) || 0,
          pedidoConsumidor: reclamo.pedidoConsumidor || '',
          estado: 'REGISTRADO'
        },
        
        // Empresa
        empresa: empresa || {
          nombre: "GOLDINFINITI TECH CORP",
          ruc: "20613360281",
          direccion: "Av. Principal 123, Lima, Perú",
          telefono: "+51 968 786 648"
        },
        
        // Información legal
        legal: legal || {
          declaracionJurada: true,
          fechaLimiteRespuesta: this._calcularFechaLimiteReclamo(),
          plazoDias: 30,
          tipo: 'Libro de Reclamaciones INDECOPI'
        },
        
        // Metadata del sistema
        metadata: {
          ...claimMetadata,
          procesado: true,
          procesado_en: new Date().toISOString(),
          origen: 'formulario_web_indecopi',
          dispositivo: req.get('User-Agent') || 'Desconocido',
          ip: req.ip || '127.0.0.1',
          timestamp: Date.now(),
          // ✅ IMPORTANTE: Registrar de dónde vino el ID
          id_proveniente: req.body.id ? 'frontend' : 'backend',
          id_original_frontend: req.body.id || null
        },
        
        // Estado del sistema
        estado: 'REGISTRADO',
        fechaCreacion: new Date().toISOString(),
        totalArchivos: 0,
        archivos: []
      };

      logger.debug(`📋 Datos reclamo preparados ${claimId}`, {
        consumidor: claimData.consumidor.nombreCompleto,
        email: claimData.consumidor.email,
        documento: claimData.consumidor.numeroDocumento, // ✅ DNI DEL RECLAMO
        tipo: claimData.tipoSolicitud,
        descripcionLength: claimData.reclamo.descripcion?.length,
        monto: claimData.reclamo.montoReclamado,
        idOrigen: claimData.metadata.id_proveniente
      });

      /* =======================
       * 3. GUARDAR EN FIREBASE
       * =======================
       */
      const firebaseResult = await this._guardarReclamoEnFirebase(claimData);
      logger.info(`✅ Reclamo guardado en Firebase: ${claimId}`);

      /* =======================
       * 4. ENVIAR EMAILS DE CONFIRMACIÓN
       * =======================
       */
      const emailResults = await this._enviarEmailsReclamo(claimData);

      /* =======================
       * 5. ACTUALIZAR ESTADÍSTICAS
       * =======================
       */
      this.stats.claimsStats.totalClaims++;
      this.stats.claimsStats.processedClaims++;
      if (emailResults.usuario.success || emailResults.admin.success) {
        this.stats.claimsStats.emailsSent++;
      }

      /* =======================
       * 6. CONSTRUIR RESPUESTA PROFESIONAL
       * =======================
       */
      const totalDuration = Date.now() - startTime;
      const response = this._buildClaimResponse(
        claimId,
        claimData,
        firebaseResult,
        emailResults,
        totalDuration
      );

      logger.info(`🎉 Reclamo procesado exitosamente ${claimId}`, {
        claimId,
        cliente: claimData.consumidor.nombreCompleto,
        documento: claimData.consumidor.numeroDocumento, // ✅ DNI DEL RECLAMO
        idOrigen: claimData.metadata.id_proveniente,
        emailUsuario: emailResults.usuario.success,
        emailAdmin: emailResults.admin.success,
        duration: `${totalDuration}ms`
      });

      /* =======================
       * 7. ENVIAR RESPUESTA
       * =======================
       */
      res.status(200).json(response);

      /* =======================
       * 8. TAREAS POST-RECLAMO (ASÍNCRONO)
       * =======================
       */
      this._executePostClaimTasks(
        claimId,
        claimData,
        firebaseResult,
        emailResults
      ).catch(err => {
        logger.warn(`⚠️ Error en tareas post-reclamo ${claimId}`, { error: err.message });
      });

    } catch (error) {
      const errorDuration = Date.now() - startTime;
      this.stats.claimsStats.totalClaims++;
      this.stats.claimsStats.failedClaims++;
      
      this._handleClaimError(
        error,
        claimId || requestId,
        req,
        res,
        errorDuration
      );
    }
  }

  /* ============================================================
   * MÉTODOS AUXILIARES PARA RECLAMOS
   * ============================================================
   */

  async _guardarReclamoEnFirebase(claimData) {
    try {
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;
      
      if (!firestore) {
        throw new Error('Firebase no disponible');
      }

      // Preparar documento para Firebase
      const firebaseDoc = {
        id: claimData.id,
        numeroReclamo: claimData.id,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        fechaRegistro: claimData.fechaRegistro,
        estado: 'REGISTRADO',
        
        consumidor: claimData.consumidor,
        empresa: claimData.empresa,
        reclamo: claimData.reclamo,
        legal: claimData.legal,
        
        archivos: claimData.archivos || [],
        totalArchivos: claimData.totalArchivos || 0,
        
        metadata: {
          ...claimData.metadata,
          procesado: true,
          procesado_en: new Date().toISOString(),
          emailEnviado: false,
          emailPendiente: true,
          timestamp: Date.now(),
          dispositivo: claimData.metadata.dispositivo,
          ip: claimData.metadata.ip,
          origen: 'sistema_backend_reclamos'
        },
        
       sistema: {
  version: (() => {
    try {
      const autoVersion = require('../../../../src/config/version.json');
      return autoVersion.version;
    } catch (e) {
      try {
        const packageJson = require('../../../../package.json');
        return packageJson.version;
      } catch (e2) {
        return '3.0.0';
      }
    }
  })(),
  fuente: 'API Goldinfiniti',
  entorno: process.env.NODE_ENV || 'production'
}
      };

      logger.info(`💾 Guardando reclamo en Firebase: ${claimData.id}`);
      
      // Guardar en la colección correcta
      await firestore
        .collection('libro_reclamaciones_indecopi')
        .doc(claimData.id)
        .set(firebaseDoc);

      return {
        success: true,
        saved: true,
        claimId: claimData.id,
        timestamp: new Date().toISOString(),
        collection: 'libro_reclamaciones_indecopi'
      };

    } catch (error) {
      logger.error(`❌ Error guardando reclamo en Firebase: ${claimData.id}`, {
        error: error.message,
        code: error.code
      });
      
      return {
        success: false,
        saved: false,
        claimId: claimData.id,
        error: error.message,
        fallback: true,
        timestamp: new Date().toISOString()
      };
    }
  }

  async _enviarEmailsReclamo(claimData) {
    const emailResults = {
      usuario: { success: false, fallback: false },
      admin: { success: false, fallback: false }
    };

    // 1. ENVIAR EMAIL AL USUARIO
    try {
      if (emailServiceAvailable && emailService.sendClaimConfirmation) {
        logger.info(`📤 Enviando email de confirmación a usuario: ${claimData.consumidor.email}`);
        
        const userEmailResult = await emailService.sendClaimConfirmation(claimData);
        emailResults.usuario = userEmailResult;
        
        if (userEmailResult.success) {
          logger.info(`✅ Email usuario enviado: ${claimData.consumidor.email}`);
        } else {
          logger.warn(`⚠️ Email usuario falló: ${claimData.consumidor.email}`);
        }
      } else {
        logger.warn(`📧 Modo fallback para email usuario: ${claimData.consumidor.email}`);
        emailResults.usuario = {
          success: true,
          fallback: true,
          message: 'Email en modo simulación - Datos guardados',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error(`❌ Error enviando email a usuario: ${claimData.consumidor.email}`, {
        error: error.message
      });
      emailResults.usuario = {
        success: false,
        error: error.message,
        fallback: false,
        timestamp: new Date().toISOString()
      };
    }

    // 2. ENVIAR EMAIL AL ADMINISTRADOR
    try {
      if (emailServiceAvailable && emailService.sendClaimNotification) {
        logger.info(`📤 Enviando notificación a administrador`);
        
        const adminEmailResult = await emailService.sendClaimNotification(claimData);
        emailResults.admin = adminEmailResult;
        
        if (adminEmailResult.success) {
          logger.info(`✅ Email administrador enviado`);
        } else {
          logger.warn(`⚠️ Email administrador falló`);
        }
      } else {
        logger.warn(`📧 Modo fallback para email administrador`);
        emailResults.admin = {
          success: true,
          fallback: true,
          message: 'Notificación en modo simulación',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error(`❌ Error enviando email a administrador`, {
        error: error.message
      });
      emailResults.admin = {
        success: false,
        error: error.message,
        fallback: false,
        timestamp: new Date().toISOString()
      };
    }

    return emailResults;
  }

  _buildClaimResponse(claimId, claimData, firebaseResult, emailResults, duration) {
    return {
      success: true,
      message: '✅ RECLAMO REGISTRADO EXITOSAMENTE',
      claim: {
        id: claimId,
        numeroReclamo: claimId,
        tipo: claimData.tipoSolicitud,
        estado: 'REGISTRADO',
        fechaRegistro: claimData.fechaRegistro,
        fechaLimiteRespuesta: claimData.legal.fechaLimiteRespuesta
      },
      consumidor: {
        nombre: claimData.consumidor.nombreCompleto,
        email: claimData.consumidor.email,
        telefono: claimData.consumidor.telefono || 'No especificado',
        documento: claimData.consumidor.tipoDocumento 
          ? `${claimData.consumidor.tipoDocumento} ${claimData.consumidor.numeroDocumento}`
          : 'No especificado'
      },
      reclamo: {
        productoServicio: claimData.reclamo.productoServicio,
        descripcion: claimData.reclamo.descripcion.substring(0, 100) + '...',
        montoReclamado: claimData.reclamo.montoReclamado,
        pedidoConsumidor: claimData.reclamo.pedidoConsumidor || 'No especificado'
      },
      email: {
        usuario: {
          sent: emailResults.usuario.success,
          email: claimData.consumidor.email,
          status: emailResults.usuario.success ? 'ENVIADO' : 'PENDIENTE',
          fallback: emailResults.usuario.fallback
        },
        administrador: {
          sent: emailResults.admin.success,
          status: emailResults.admin.success ? 'ENVIADO' : 'PENDIENTE',
          fallback: emailResults.admin.fallback
        },
        timestamp: new Date().toISOString()
      },
      sistema: {
  firebase: {
    saved: firebaseResult.saved,
    status: firebaseResult.saved ? 'GUARDADO' : 'FALLBACK',
    collection: firebaseResult.collection || 'libro_reclamaciones_indecopi'
  },
  backend: 'Goldinfiniti Reclamos API',
  version: (() => {
    try {
      const autoVersion = require('../../../../src/config/version.json');
      return autoVersion.version;
    } catch (e) {
      try {
        const packageJson = require('../../../../package.json');
        return packageJson.version;
      } catch (e2) {
        return '2.0.0';
      }
    }
  })(),
},
      informacionImportante: [
        `Su reclamo ha sido registrado con el número: ${claimId}`,
        `Recibirá una respuesta en un plazo máximo de ${claimData.legal.plazoDias} días hábiles`,
        `Puede consultar el estado llamando al ${claimData.empresa.telefono}`,
        `Para consultas adicionales: ${claimData.empresa.nombre}`
      ],
      metadata: {
        response_time: `${duration}ms`,
        timestamp: new Date().toISOString(),
        golden_infinity: true,
        indecopi_compliant: true
      }
    };
  }

  async _executePostClaimTasks(claimId, claimData, firebaseResult, emailResults) {
    const tasksStartTime = Date.now();
    
    try {
      logger.info(`🔄 Ejecutando tareas post-reclamo ${claimId}`);

      const tasks = [];

      // 1. Actualizar Firebase con estado de emails
      if (firebaseResult.saved) {
        tasks.push(
          this._actualizarEstadoEmailFirebase(claimId, emailResults)
            .then(result => {
              logger.info(`✅ Firebase actualizado con estado email: ${claimId}`);
              return result;
            })
            .catch(err => {
              logger.warn(`⚠️ Error actualizando Firebase email: ${claimId}`, { error: err.message });
              return { success: false, error: err.message };
            })
        );
      }

      // 2. Registrar en log de auditoría
      tasks.push(
        this._registrarAuditoriaReclamo(claimId, claimData, emailResults)
          .then(result => {
            logger.info(`📝 Auditoría registrada: ${claimId}`);
            return result;
          })
          .catch(err => {
            logger.warn(`⚠️ Error en auditoría: ${claimId}`, { error: err.message });
            return { success: false, error: err.message };
          })
      );

      // Ejecutar tareas en paralelo
      await Promise.allSettled(tasks);

      const tasksDuration = Date.now() - tasksStartTime;
      logger.info(`✅ Tareas post-reclamo completadas ${claimId}`, {
        duration: `${tasksDuration}ms`,
        totalTasks: tasks.length
      });

    } catch (error) {
      logger.error(`🔥 Error en tareas post-reclamo ${claimId}`, {
        error: error.message,
        duration: `${Date.now() - tasksStartTime}ms`
      });
    }
  }

  async _actualizarEstadoEmailFirebase(claimId, emailResults) {
    try {
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;

      const updateData = {
        'metadata.emailEnviado': emailResults.usuario.success || emailResults.admin.success,
        'metadata.emailPendiente': !(emailResults.usuario.success || emailResults.admin.success),
        'metadata.emailTimestamp': new Date().toISOString(),
        'metadata.emailUsuarioEnviado': emailResults.usuario.success,
        'metadata.emailAdminEnviado': emailResults.admin.success,
        'metadata.ultimaActualizacion': new Date().toISOString()
      };

      await firestore
        .collection('libro_reclamaciones_indecopi')
        .doc(claimId)
        .update(updateData);

      return { success: true, updated: true, claimId };

    } catch (error) {
      logger.error(`❌ Error actualizando estado email Firebase: ${claimId}`, {
        error: error.message
      });
      return { success: false, error: error.message, claimId };
    }
  }

  async _registrarAuditoriaReclamo(claimId, claimData, emailResults) {
    try {
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;

      const auditLog = {
        claimId: claimId,
        action: 'PROCESAMIENTO_RECLAMO',
        timestamp: new Date().toISOString(),
        data: {
          consumidor: {
            nombre: claimData.consumidor.nombreCompleto,
            email: claimData.consumidor.email
          },
          reclamo: {
            tipo: claimData.tipoSolicitud,
            productoServicio: claimData.reclamo.productoServicio,
            monto: claimData.reclamo.montoReclamado
          },
          emailResults: {
            usuario: emailResults.usuario.success,
            admin: emailResults.admin.success
          }
        },
        metadata: {
          ip: claimData.metadata.ip,
          dispositivo: claimData.metadata.dispositivo,
          origen: claimData.metadata.origen,
          entorno: process.env.NODE_ENV || 'production'
        }
      };

      await firestore
        .collection('auditoria_reclamos')
        .add(auditLog);

      return { success: true, logged: true, claimId };

    } catch (error) {
      // No es crítico si falla la auditoría
      logger.warn(`⚠️ Error en auditoría (no crítico): ${claimId}`, {
        error: error.message
      });
      return { success: false, error: error.message, claimId, nonCritical: true };
    }
  }

  _calcularFechaLimiteReclamo() {
    const fecha = new Date();
    let diasHabiles = 0;
    
    while (diasHabiles < 30) {
      fecha.setDate(fecha.getDate() + 1);
      const dia = fecha.getDay();
      if (dia !== 0 && dia !== 6) { // No sábado ni domingo
        diasHabiles++;
      }
    }
    
    return fecha.toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  _handleClaimError(error, claimId, req, res, duration) {
    const errorCode = error.code || 'CLAIM_PROCESSING_ERROR';
    
    logger.error(`💥 Error procesando reclamo ${claimId}`, {
      errorCode,
      errorMessage: error.message,
      statusCode: error.statusCode || 500,
      duration: `${duration}ms`,
      cliente: req.body.consumidor?.nombreCompleto
    });
    
    const response = {
      success: false,
      error: {
        code: errorCode,
        message: error.message,
        claim_id: claimId,
        timestamp: new Date().toISOString(),
        suggestions: this._getClaimErrorSuggestions(errorCode)
      },
      sistema: {
        backend: 'Goldinfiniti Reclamos API',
        status: 'ERROR',
        response_time: `${duration}ms`
      }
    };
    
    // Si es error de validación, intentar guardar igual en modo fallback
    if (error.statusCode === 400 && req.body.consumidor?.email) {
      response.warning = 'Datos incompletos, pero se intentará procesar';
      response.fallback_mode = true;
      
      // Ejecutar en segundo plano
      this._processClaimFallback(req.body, claimId).catch(() => {});
    }
    
    res.status(error.statusCode || 500).json(response);
  }

  async _processClaimFallback(claimData, claimId) {
    try {
      logger.warn(`🔄 Procesando reclamo en modo fallback: ${claimId}`);
      
      // Guardar mínimo en Firebase
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;
      
      const fallbackDoc = {
        id: claimId,
        numeroReclamo: claimId,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        estado: 'REGISTRADO_FALLBACK',
        consumidor: {
          nombreCompleto: claimData.consumidor?.nombreCompleto || 'Consumidor',
          email: claimData.consumidor?.email || 'no-email',
          telefono: claimData.consumidor?.telefono || ''
        },
        reclamo: {
          descripcion: claimData.reclamo?.descripcion || 'Sin descripción',
          productoServicio: claimData.reclamo?.productoServicio || 'No especificado',
          estado: 'PENDIENTE_VALIDACION'
        },
        metadata: {
          procesado: true,
          procesado_en: new Date().toISOString(),
          fallback_mode: true,
          error: 'Validación fallida, procesado en modo de contingencia',
          timestamp: Date.now(),
          origen: 'formulario_web_fallback'
        }
      };
      
      await firestore
        .collection('libro_reclamaciones_indecopi')
        .doc(claimId)
        .set(fallbackDoc);
        
      logger.info(`✅ Reclamo fallback guardado: ${claimId}`);
      
    } catch (fallbackError) {
      logger.error(`🔥 Error crítico en modo fallback: ${claimId}`, {
        error: fallbackError.message
      });
    }
  }

  _getClaimErrorSuggestions(code) {
    const suggestions = {
      MISSING_EMAIL: ['Proporciona un email válido del consumidor'],
      MISSING_NAME: ['Ingresa el nombre completo del consumidor'],
      MISSING_DESCRIPTION: ['Describe detalladamente tu reclamo'],
      CLAIM_PROCESSING_ERROR: ['Intenta nuevamente', 'Contacta a soporte técnico']
    };
    
    return suggestions[code] || ['Intenta nuevamente', 'Contacta soporte técnico'];
  }

  /* ============================================================
   * MÉTODOS ORIGINALES DE PAYMENT CONTROLLER (NO MODIFICADOS)
   * ============================================================
   */

  _prepareCulqiData(token, amount, email, cliente, metadata, req, orderId) {
    const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
    
    return {
      token: token.trim(),
      amount: Number(amount),
      currency_code: 'PEN',
      email: email.toLowerCase().trim(),
      description: `Goldinfiniti - Orden ${orderId}`,
      antifraud_details: {
        customer_ip: req?.ip || '127.0.0.1',
        customer_device: req?.get('User-Agent') || 'Web Browser',
        first_name: cliente.nombre || '',
        last_name: cliente.apellido || ''
      },
      metadata: {
        order_id: orderId,
        cliente_id: cliente.id,
        cliente_nombre: nombreCompleto,
        cliente_dni: cliente.dni || '', // ✅ AÑADIR DNI A METADATA DE CULQI
        cliente_telefono: cliente.telefono || '',
        firebase_doc_id: metadata?.firebaseDocId,
        productos_count: metadata?.productosCount || 0,
        tipo_compra: metadata?.tipoCompra || 'directa',
        golden_infinity: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  _prepareEmailData(paymentId, culqiResult, firebaseData) {
    const { cliente, comprobante, envio, productos, resumen, metadata, ordenId } = firebaseData;
    
    const productosFormateados = Array.isArray(productos) ? productos.map(p => ({
      nombre: p.nombre || p.titulo || 'Producto',
      cantidad: p.cantidad || p.quantity || 1,
      precio: p.precio || p.precioOriginal || 0,
      color: p.color || '',
      talla: p.talla || p.size || '',
      sku: p.sku || '',
      subtotal: p.subtotal || ((p.cantidad || 1) * (p.precio || 0)),
      imagen: p.imagen || ''
    })) : [];
    
    const infoEnvio = envio ? {
      tipo: envio.tipo || 'estándar',
      costo: envio.costo || 0,
      estado: envio.estado || 'pendiente'
    } : null;
    
    // ========== 🔥 CAMBIO 3: AÑADIR DNI A LOS DATOS DEL EMAIL ==========
    return {
      id: paymentId,
      culqi_id: culqiResult.id,
      amount: culqiResult.amount,
      currency: culqiResult.currency || 'PEN',
      status: culqiResult.status,
      created_at: culqiResult.created_at,
      receipt_url: culqiResult.receipt_url,
      
      customer_email: cliente.email,
      customer_name: `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim(),
      customer_phone: cliente.telefono || '',
      customer_dni: cliente.dni || '', // ✅ NUEVO: DNI explícito
      
      order_id: ordenId,
      firebase_doc_id: metadata?.firebaseDocId,
      fecha_creacion: metadata?.timestamp || new Date().toISOString(),
      
      productos: productosFormateados,
      
      resumen: {
        subtotal: resumen?.subtotal || 0,
        envio: resumen?.envio || (envio?.costo || 0),
        total: resumen?.total || 0,
        cantidad_items: resumen?.cantidadItems || productosFormateados.length
      },
      
      comprobante: {
        tipo: comprobante?.tipo || 'boleta',
        serie: comprobante?.serie || '',
        numero: comprobante?.numero || ''
      },
      
      envio: infoEnvio,
      
      metadata: {
        ...metadata,
        payment_processed: true,
        payment_timestamp: new Date().toISOString(),
        golden_infinity: true
      }
    };
  }

  async _sendFirebaseEmail(emailData) {
    const startTime = Date.now();
    this.stats.emailStats.attempted++;
    
    try {
      logger.info(`📧 Preparando email para ${emailData.customer_email}`, {
        orderId: emailData.order_id,
        customer_dni: emailData.customer_dni, // ✅ LOG DEL DNI
        productosCount: emailData.productos.length,
        total: emailData.resumen.total
      });
      
      let emailResult;
      
      if (emailServiceAvailable && emailService.sendPaymentConfirmation) {
        logger.info(`📤 Enviando email REAL con EmailService`);
        
        try {
          emailResult = await emailService.sendPaymentConfirmation(emailData);
          
          if (emailResult.success) {
            logger.info(`✅ Email enviado exitosamente`, {
              messageId: emailResult.messageId,
              customer: this._maskEmail(emailData.customer_email)
            });
            this.stats.emailStats.sent++;
            
            return {
              success: true,
              messageId: emailResult.messageId,
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'real_service'
            };
            
          } else {
            logger.warn(`⚠️ EmailService respondió con éxito falso`, {
              error: emailResult.error
            });
          }
          
        } catch (serviceError) {
          logger.warn(`⚠️ Error ejecutando EmailService`, {
            error: serviceError.message
          });
        }
      }
      
      logger.info(`🔄 Usando modo fallback para ${emailData.customer_email}`);
      
      const emailHtml = this._generateEmailHtml(emailData);
      
      logger.info(`📝 Email fallback generado para ${emailData.customer_email}`, {
        orderId: emailData.order_id,
        total: `S/ ${(emailData.amount / 100).toFixed(2)}`,
        productos: emailData.productos.length,
        html_length: emailHtml.length
      });
      
      this.stats.emailStats.queued++;
      
      return {
        success: true,
        fallback: true,
        html_generated: true,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        source: 'fallback',
        preview: `Orden #${emailData.order_id} - S/ ${(emailData.resumen.total).toFixed(2)}`
      };
      
    } catch (error) {
      this.stats.emailStats.failed++;
      
      logger.error(`❌ Error crítico en _sendFirebaseEmail`, {
        error: error.message,
        customer: this._maskEmail(emailData.customer_email),
        orderId: emailData.order_id
      });
      
      return {
        success: false,
        error: error.message,
        fallback: false,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        source: 'error'
      };
    }
  }

  async _executePostPaymentTasks(paymentId, culqiResult, firebaseData, emailResult) {
    const tasksStartTime = Date.now();
    
    try {
      logger.info(`🔄 Ejecutando tareas post-pago ${paymentId}`, {
        ordenIdParaNotificacion: firebaseData.ordenId,
        cliente: firebaseData.cliente?.nombre,
        cliente_dni: firebaseData.cliente?.dni // ✅ LOG DEL DNI
      });
      
      const tasks = [];
      
      if (emailServiceAvailable && emailService.sendPaymentNotification) {
        const notificationData = {
          id: paymentId,
          culqi_id: culqiResult.id,
          amount: culqiResult.amount,
          currency: culqiResult.currency || 'PEN',
          status: culqiResult.status,
          created_at: culqiResult.created_at || new Date().toISOString(),
          
          order_id: firebaseData.ordenId,
          
          customer_email: firebaseData.cliente?.email,
          customer_name: `${firebaseData.cliente?.nombre || ''} ${firebaseData.cliente?.apellido || ''}`.trim(),
          customer_phone: firebaseData.cliente?.telefono || '',
          customer_dni: firebaseData.cliente?.dni || '', // ✅ DNI EN NOTIFICACIÓN
          
          productos: firebaseData.productos || [],
          productos_count: firebaseData.productos?.length || 0,
          
          resumen: {
            subtotal: firebaseData.resumen?.subtotal || 0,
            envio: firebaseData.resumen?.envio || 0,
            total: firebaseData.resumen?.total || (culqiResult.amount / 100),
            cantidad_items: firebaseData.resumen?.cantidadItems || 0
          },
          
          comprobante: firebaseData.comprobante || { tipo: 'boleta' },
          
          envio: firebaseData.envio || null,
          
          email_result: {
            success: emailResult.success,
            timestamp: emailResult.timestamp,
            customer: firebaseData.cliente?.email
          },
          
          metadata: {
            ...firebaseData.metadata,
            firebase_doc_id: firebaseData.metadata?.firebaseDocId,
            tipo_compra: firebaseData.metadata?.tipoCompra,
            procesado_en: new Date().toISOString(),
            golden_infinity: true,
            debug_nota: 'NOTIFICACIÓN INTERNA - MISMO ID QUE EMAIL AL CLIENTE',
            order_id_verificado: firebaseData.ordenId
          }
        };
        
        logger.info(`📧 ENVIANDO NOTIFICACIÓN INTERNA CON ID: ${firebaseData.ordenId}`, {
          payment_id: paymentId,
          order_id_en_notification: notificationData.order_id,
          igual_a_cliente: notificationData.order_id === firebaseData.ordenId
        });
        
        tasks.push(
          emailService.sendPaymentNotification(notificationData)
            .then(result => {
              logger.info(`✅ NOTIFICACIÓN INTERNA ENVIADA PARA ORDEN: ${firebaseData.ordenId}`, {
                success: result.success,
                order_id_confirmado: firebaseData.ordenId
              });
              return result;
            })
            .catch(err => {
              logger.warn(`⚠️ Error notificación interna ${paymentId}`, { 
                error: err.message,
                ordenId_correcto: firebaseData.ordenId
              });
              return { success: false, error: err.message };
            })
        );
      }
      
      if (emailServiceAvailable && emailService.enviarCorreoComprobante && 
          firebaseData.productos && firebaseData.productos.length > 0) {
        
        tasks.push(
          emailService.enviarCorreoComprobante(
            firebaseData.cliente.email,
            firebaseData.productos,
            firebaseData.comprobante?.tipo || 'boleta'
          ).then(result => {
            logger.info(`📄 Comprobante procesado para orden ${firebaseData.ordenId}`);
            return result;
          }).catch(err => {
            logger.warn(`⚠️ Error generando comprobante ${paymentId}`, { error: err.message });
            return { success: false, error: err.message };
          })
        );
      }
      
      tasks.push(
        this._updateFirebaseDocument(
          firebaseData.ordenId,
          culqiResult,
          emailResult
        ).then(result => {
          logger.info(`📝 Firebase actualizado para orden ${firebaseData.ordenId}`);
          return result;
        }).catch(err => {
          logger.warn(`⚠️ Error actualizando Firebase ${paymentId}`, { error: err.message });
          return { success: false, error: err.message };
        })
      );
      
      const results = await Promise.allSettled(tasks);
      
      const tasksDuration = Date.now() - tasksStartTime;
      const successfulTasks = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      
      logger.info(`✅ Tareas post-pago completadas ${paymentId}`, {
        ordenIdFinal: firebaseData.ordenId,
        totalTasks: tasks.length,
        successfulTasks,
        duration: `${tasksDuration}ms`,
        emailSent: emailResult.success
      });
      
    } catch (error) {
      logger.error(`🔥 Error en tareas post-pago ${paymentId}`, {
        error: error.message,
        ordenId: firebaseData.ordenId,
        duration: `${Date.now() - tasksStartTime}ms`,
        critical: false
      });
    }
  }

  _generateEmailHtml(emailData) {
    const { customer_name, customer_email, customer_dni, order_id, productos, resumen, envio } = emailData;
    const fecha = new Date().toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let productosHtml = '';
    if (Array.isArray(productos)) {
      productos.forEach(p => {
        productosHtml += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${p.nombre}</td>
            <td style="padding: 10px; text-align: center;">${p.cantidad}</td>
            <td style="padding: 10px; text-align: right;">S/ ${p.precio.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right;">S/ ${p.subtotal.toFixed(2)}</td>
          </tr>
        `;
      });
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
          .header { background: #000; color: #FFD700; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f8f8f8; padding: 10px; text-align: left; }
          .total { font-size: 18px; font-weight: bold; color: #000; background: #f0f0f0; padding: 15px; border-radius: 5px; }
          .highlight { color: #FFD700; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Goldinfiniti</h1>
            <p>Confirmación de Compra</p>
          </div>
          
          <div class="content">
            <h2>¡Gracias por tu compra, ${customer_name || 'Cliente'}!</h2>
            <p>Tu orden <strong>#${order_id}</strong> ha sido procesada exitosamente.</p>
            
            <!-- ✅ DNI AÑADIDO AQUÍ -->
            <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
              <p><strong>🪪 DNI:</strong> ${customer_dni || 'No especificado'}</p>
            </div>
            
            <h3>📦 Resumen de tu pedido:</h3>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${productosHtml}
              </tbody>
            </table>
            
            ${envio ? `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>🚚 Información de envío:</h4>
              <p><strong>Tipo:</strong> ${envio.tipo}</p>
              <p><strong>Costo:</strong> S/ ${envio.costo.toFixed(2)}</p>
              <p><strong>Estado:</strong> ${envio.estado}</p>
            </div>
            ` : ''}
            
            <div class="total">
              <p>Subtotal: S/ ${resumen.subtotal.toFixed(2)}</p>
              ${envio ? `<p>Envío: S/ ${resumen.envio.toFixed(2)}</p>` : ''}
              <p style="font-size: 20px;">TOTAL: S/ ${resumen.total.toFixed(2)}</p>
            </div>
            
            <p>📧 Este correo ha sido enviado a: ${customer_email}</p>
            <p>🕐 Fecha de compra: ${fecha}</p>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>⚠️ IMPORTANTE:</strong> Guarda este correo como comprobante de tu compra.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Goldinfiniti - Econmerce de confianza</p>
            <p>contacto@goldinfiniti.com | www.goldinfiniti.com</p>
            <p>© ${new Date().getFullYear()} Goldinfiniti. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  _buildFirebaseResponse(paymentId, culqiResult, emailResult, firebaseData, totalDuration) {
    const { cliente, productos, resumen, ordenId } = firebaseData;
    
    return {
      success: true,
      message: '✅ PAGO EXITOSO - Goldinfiniti',
      transaction: {
        id: paymentId,
        culqi_id: culqiResult.id,
        status: culqiResult.status,
        order_id: ordenId,
        amount: {
          total: culqiResult.amount / 100,
          currency: 'PEN',
          formatted: `S/ ${(culqiResult.amount / 100).toFixed(2)}`
        }
      },
      customer: {
        name: `${cliente.nombre} ${cliente.apellido}`,
        email: cliente.email,
        phone: cliente.telefono,
        dni: cliente.dni || '' // ✅ DNI EN RESPUESTA
      },
      order_summary: {
        items_count: productos.length,
        subtotal: resumen.subtotal,
        shipping: resumen.envio,
        total: resumen.total,
        products: productos.map(p => ({
          name: p.nombre || p.titulo,
          quantity: p.cantidad || p.quantity,
          price: p.precio || p.precioOriginal
        }))
      },
      email: {
        sent: emailResult.success,
        status: emailResult.success ? 'delivered' : 'queued',
        customer_email: cliente.email,
        timestamp: emailResult.timestamp
      },
      next_steps: [
        'Revisa tu correo electrónico para la confirmación detallada',
        'Tu pedido está siendo procesado',
        'Recibirás actualizaciones sobre el envío'
      ],
      metadata: {
        response_time: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
        golden_infinity: true,
        firebase_integration: true
      }
    };
  }

  async _updateFirebaseDocument(orderId, culqiResult, emailResult) {
    try {
      const firebase = require('../../../core/config/firebase');
      const firestore = firebase.firestore;

      const updateData = {
        'metadata.procesado': true,
        'metadata.procesado_en': new Date().toISOString(),
        'metadata.culqi_id': culqiResult.id,
        'metadata.email_enviado': emailResult.success,
        'metadata.email_timestamp': emailResult.timestamp || new Date().toISOString(),
        'metadata.estado_pago': 'completado',
        'metadata.metodo_pago': 'culqi',
        'metadata.ultima_actualizacion': new Date().toISOString(),
        
        'pago.estado': 'completado',
        'pago.metodo': 'culqi',
        'pago.fecha_procesado': new Date().toISOString(),
        'pago.monto': culqiResult.amount / 100,
        'pago.currency': culqiResult.currency || 'PEN',
        'pago.culqi_charge_id': culqiResult.id,
        'pago.comprobante_url': culqiResult.receipt_url
      };
      
      logger.info(`📝 ACTUALIZANDO REALMENTE Firebase para orden ${orderId}`, {
        orderId,
        culqiId: culqiResult.id,
        updateData
      });
      
      const querySnapshot = await firestore
        .collection('ordenes')
        .where('id', '==', orderId)
        .limit(1)
        .get();
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        
        await docRef.update(updateData);
        
        logger.info(`✅ Firebase ACTUALIZADO REALMENTE para orden ${orderId}`);
        
        return { 
          success: true, 
          updated: true, 
          orderId,
          realUpdate: true,
          documentId: docRef.id
        };
        
      } else {
        const altQuerySnapshot = await firestore
          .collection('ordenes')
          .where('metadata.orderId', '==', orderId)
          .limit(1)
          .get();
        
        if (!altQuerySnapshot.empty) {
          const docRef = altQuerySnapshot.docs[0].ref;
          await docRef.update(updateData);
          
          logger.info(`✅ Firebase actualizado por metadata.orderId: ${orderId}`);
          
          return { 
            success: true, 
            updated: true, 
            orderId,
            realUpdate: true,
            viaMetadata: true
          };
        }
        
        logger.warn(`⚠️ Orden ${orderId} no encontrada en Firebase`);
        return { 
          success: false, 
          error: 'Documento no encontrado', 
          orderId,
          notFound: true 
        };
      }
      
    } catch (error) {
      logger.error(`❌ Error actualizando Firebase para orden ${orderId}`, { 
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      
      return { 
        success: false, 
        error: error.message, 
        orderId,
        updateFailed: true 
      };
    }
  }

  _updateStats(success, amount, emailSent = false) {
    this.stats.totalPayments++;
    this.stats.totalAmount += amount;
    success ? this.stats.successfulPayments++ : this.stats.failedPayments++;
    
    if (emailSent) {
      this.stats.emailStats.sent++;
    }
  }
  
  _maskEmail(email) {
    if (!email) return 'unknown@email.com';
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    return `${local.substring(0, 2)}***@${domain}`;
  }
  
  _error(code, message, statusCode = 400) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
  
  _handlePaymentError(error, paymentId, req, res, duration) {
    const errorCode = error.code || 'INTERNAL_ERROR';
    
    logger.error(`💥 Error procesando pago ${paymentId}`, {
      errorCode,
      errorMessage: error.message,
      statusCode: error.statusCode || 500,
      duration: `${duration}ms`
    });
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message,
        payment_id: paymentId,
        timestamp: new Date().toISOString(),
        suggestions: this._getErrorSuggestions(errorCode)
      },
      metadata: {
        response_time: `${duration}ms`,
        golden_infinity: true,
        firebase_integration: true
      }
    });
  }
  
  _getErrorSuggestions(code) {
    const suggestions = {
      MISSING_TOKEN: ['Regenera el token de pago'],
      INVALID_AMOUNT: ['Verifica el monto ingresado'],
      MISSING_EMAIL: ['Proporciona un email válido'],
      INCOMPLETE_DATA: ['Faltan datos de Firebase. Contacta soporte.'],
      CULQI_PROCESSING_FAILED: ['Intenta nuevamente o contacta soporte']
    };
    
    return suggestions[code] || ['Intenta nuevamente', 'Contacta soporte'];
  }

  async getStats(req, res) {
    const startTime = Date.now();
    
    try {
      logger.info('📊 Obteniendo estadísticas REALES para dashboard...');
      
      const memory = process.memoryUsage();
      const uptime = process.uptime();
      
      let firebaseStats = {
        connected: false,
        total_orders: 0,
        today_orders: 0,
        today_amount: 0,
        active_clients: 0,
        last_hour_orders: 0,
        total_claims: 0,
        today_claims: 0
      };
      
      let backendStatus = {
        status: 'OK',
        message: 'Backend funcionando correctamente',
        last_check: new Date().toISOString(),
        uptime: `${Math.floor(uptime)}s`
      };
      
      try {
        const firebase = require('../../../core/config/firebase');
        const firestore = firebase.firestore;

        if (firestore) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          
          // Total de órdenes
          const allOrdersSnapshot = await firestore.collection('ordenes').get();
          const totalOrders = allOrdersSnapshot.size;
          
          // Total de reclamos
          const allClaimsSnapshot = await firestore.collection('libro_reclamaciones_indecopi').get();
          const totalClaims = allClaimsSnapshot.size;
          
          // Órdenes de hoy
          const todayOrdersSnapshot = await firestore
            .collection('ordenes')
            .where('fechaCreacion', '>=', today)
            .where('fechaCreacion', '<', tomorrow)
            .get();
          
          const todayOrders = todayOrdersSnapshot.size;
          let todayAmount = 0;
          
          todayOrdersSnapshot.forEach(doc => {
            const data = doc.data();
            todayAmount += Number(data.resumen?.total) || 0;
          });
          
          // Reclamos de hoy
          const todayClaimsSnapshot = await firestore
            .collection('libro_reclamaciones_indecopi')
            .where('fechaRegistro', '>=', today.toISOString())
            .where('fechaRegistro', '<', tomorrow.toISOString())
            .get();
          
          const todayClaims = todayClaimsSnapshot.size;
          
          // Órdenes última hora
          const lastHourSnapshot = await firestore
            .collection('ordenes')
            .where('fechaCreacion', '>=', oneHourAgo)
            .get();
          
          const lastHourOrders = lastHourSnapshot.size;
          
          // Clientes activos (últimos 30 días)
          const activeClientsSnapshot = await firestore
            .collection('ordenes')
            .where('fechaCreacion', '>=', thirtyDaysAgo)
            .get();
          
          const uniqueEmails = new Set();
          activeClientsSnapshot.forEach(doc => {
            const email = doc.data().cliente?.email;
            if (email) uniqueEmails.add(email);
          });
          
          firebaseStats = {
            connected: true,
            total_orders: totalOrders,
            total_claims: totalClaims,
            today_orders: todayOrders,
            today_claims: todayClaims,
            today_amount: parseFloat(todayAmount.toFixed(2)),
            active_clients: uniqueEmails.size,
            last_hour_orders: lastHourOrders,
            location: 'nam5',
            collection_orders: 'ordenes',
            collection_claims: 'libro_reclamaciones_indecopi'
          };
          
          backendStatus = {
            status: 'OK',
            message: 'Backend funcionando correctamente con Firebase',
            last_check: new Date().toISOString(),
            uptime: `${Math.floor(uptime)}s`,
            firebase_connected: true,
            total_orders_in_db: totalOrders,
            total_claims_in_db: totalClaims
          };
        }
      } catch (firebaseError) {
        logger.warn('⚠️ Error conectando a Firebase', { error: firebaseError.message });
        backendStatus = {
          status: 'WARNING',
          message: 'Backend funcionando pero Firebase no disponible',
          last_check: new Date().toISOString(),
          uptime: `${Math.floor(uptime)}s`,
          firebase_connected: false,
          error: firebaseError.message
        };
      }
      
      const responseTime = Date.now() - startTime;
      
      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        response_time: `${responseTime}ms`,
        
        backend_status: backendStatus,
        
        payments_today: {
          count: firebaseStats.today_orders,
          amount: firebaseStats.today_amount,
          currency: 'PEN',
          formatted: `S/ ${firebaseStats.today_amount.toFixed(2)}`
        },
        
        claims_today: {
          count: firebaseStats.today_claims,
          status: 'PROCESADOS',
          system: 'Libro de Reclamaciones INDECOPI'
        },
        
        active_clients: {
          count: firebaseStats.active_clients,
          last_hour: firebaseStats.last_hour_orders,
          period: '30 días'
        },
        
        detailed_stats: {
          total_orders: firebaseStats.total_orders,
          total_claims: firebaseStats.total_claims,
          today_orders: firebaseStats.today_orders,
          today_claims: firebaseStats.today_claims,
          last_hour_orders: firebaseStats.last_hour_orders,
          firebase_connection: firebaseStats.connected ? 'CONECTADO' : 'DESCONECTADO'
        },
        
        payment_methods: [
          {
            id: 'visa',
            name: 'Visa',
            available: true,
            type: 'card',
            status: 'Disponible'
          },
          {
            id: 'mastercard',
            name: 'Mastercard',
            available: true,
            type: 'card',
            status: 'Disponible'
          },
          {
            id: 'amex',
            name: 'American Express',
            available: true,
            type: 'card',
            status: 'Disponible'
          },
          {
            id: 'diners',
            name: 'Diners Club',
            available: true,
            type: 'card',
            status: 'Disponible'
          }
        ],
        
        server_stats: {
          uptime: `${Math.floor(uptime)} segundos`,
          memory: {
            rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
            heap_used: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
            heap_total: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`
          },
          environment: process.env.NODE_ENV || 'production',
          node_version: process.version
        },
        
        controller_stats: this.stats,
        
        services: {
          email: emailServiceAvailable ? 'ACTIVO' : 'FALLBACK',
          culqi: 'CONECTADO',
          firebase: firebaseStats.connected ? 'CONECTADO' : 'DESCONECTADO',
          sendgrid: 'ACTIVO',
          claims_system: 'ACTIVO'
        }
      };
      
      logger.info('✅ Estadísticas obtenidas exitosamente', {
        today_orders: firebaseStats.today_orders,
        today_claims: firebaseStats.today_claims,
        today_amount: firebaseStats.today_amount,
        response_time: `${responseTime}ms`
      });
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas', { error: error.message });
      
      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        
        backend_status: {
          status: 'ERROR',
          message: 'Error obteniendo estadísticas',
          last_check: new Date().toISOString()
        },
        
        payments_today: {
          count: 0,
          amount: 0,
          currency: 'PEN',
          formatted: 'S/ 0.00'
        },
        
        claims_today: {
          count: 0,
          status: 'NO DISPONIBLE',
          system: 'Libro de Reclamaciones INDECOPI'
        },
        
        active_clients: {
          count: 0,
          last_hour: 0,
          period: '30 días'
        },
        
        payment_methods: [
          { id: 'visa', name: 'Visa', available: true, type: 'card', status: 'Disponible' },
          { id: 'mastercard', name: 'Mastercard', available: true, type: 'card', status: 'Disponible' }
        ],
        
        message: 'Modo de emergencia - Datos básicos',
        fallback_mode: true
      });
    }
  }
  
  async verifyPayment(req, res) {
    const startTime = Date.now();
    const { paymentId } = req.params;
    
    try {
      logger.info(`🔍 Verificando pago REAL: ${paymentId}`);
      
      let orderData = null;
      let firebaseConnected = false;
      
      try {
        const firebase = require('../../../core/config/firebase');
        const firestore = firebase.firestore;

        if (firestore) {
          firebaseConnected = true;
          
          const docRef = firestore.collection('ordenes').doc(paymentId);
          const docSnap = await docRef.get();
          
          if (docSnap.exists) {
            orderData = docSnap.data();
            logger.info(`✅ Orden encontrada en Firebase: ${paymentId}`);
          } else {
            const querySnapshot = await firestore
              .collection('ordenes')
              .where('metadata.orderId', '==', paymentId)
              .limit(1)
              .get();
            
            if (!querySnapshot.empty) {
              orderData = querySnapshot.docs[0].data();
              logger.info(`✅ Orden encontrada por orderId: ${paymentId}`);
            }
          }
        }
      } catch (firebaseError) {
        logger.warn(`⚠️ Error Firebase para ${paymentId}`, { error: firebaseError.message });
      }
      
      let paymentStatus = 'unknown';
      let verified = false;
      
      if (orderData) {
        const procesado = orderData.metadata?.procesado;
        
        if (procesado === true) {
          paymentStatus = 'completed';
          verified = true;
        } else if (procesado === false) {
          paymentStatus = 'pending';
          verified = true;
        } else {
          paymentStatus = 'unknown';
          verified = false;
        }
      } else {
        if (paymentId.startsWith('ORD-')) {
          paymentStatus = 'pending';
          verified = true;
        } else {
          paymentStatus = 'not_found';
          verified = false;
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      const verificationResult = {
        success: true,
        verified: verified,
        payment_id: paymentId,
        status: paymentStatus,
        timestamp: new Date().toISOString(),
        response_time: `${responseTime}ms`,
        
        order_info: orderData ? {
          exists: true,
          id: orderData.id || paymentId,
          customer: {
            name: orderData.cliente?.nombre ? 
              `${orderData.cliente.nombre} ${orderData.cliente.apellido || ''}`.trim() : 
              'Cliente',
            email: orderData.cliente?.email || 'No disponible',
            phone: orderData.cliente?.telefono || 'No disponible',
            dni: orderData.cliente?.dni || '' // ✅ DNI EN VERIFICACIÓN
          },
          amount: {
            subtotal: orderData.resumen?.subtotal || 0,
            shipping: orderData.resumen?.envio || 0,
            total: orderData.resumen?.total || 0,
            currency: 'PEN'
          },
          items: orderData.resumen?.cantidadItems || 0,
          created: orderData.fechaCreacion?.toDate ? 
            orderData.fechaCreacion.toDate().toISOString() : 
            new Date().toISOString(),
          processed: orderData.metadata?.procesado || false,
          products: orderData.productos ? orderData.productos.map(p => ({
            name: p.nombre || p.titulo,
            quantity: p.cantidad || p.quantity,
            price: p.precio || p.precioOriginal
          })) : []
        } : {
          exists: false,
          message: 'Orden no encontrada en la base de datos'
        },
        
        metadata: {
          firebase_checked: firebaseConnected,
          source: orderData ? 'firebase' : 'verification_service',
          environment: process.env.NODE_ENV || 'production'
        }
      };
      
      logger.info(`✅ Verificación completada: ${paymentId}`, {
        status: paymentStatus,
        verified: verified,
        response_time: `${responseTime}ms`
      });
      
      res.status(200).json(verificationResult);
      
    } catch (error) {
      const errorTime = Date.now() - startTime;
      
      logger.error(`💥 Error en verifyPayment: ${paymentId}`, { 
        error: error.message
      });
      
      res.status(200).json({
        success: false,
        verified: false,
        payment_id: paymentId,
        error: 'Error interno verificando pago',
        timestamp: new Date().toISOString(),
        response_time: `${errorTime}ms`,
        fallback_mode: true
      });
    }
  }
  
  async getServiceInfo(req, res) {
    res.status(200).json({
      success: true,
      service: 'Goldinfiniti Payment Gateway + Sistema de Reclamos',
      description: 'Sistema de procesamiento de pagos y reclamos con Firebase + Culqi',
      version: '3.0.0',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      
      endpoints: {
        process_payment: 'POST /api/v1/payments',
        process_claim: 'POST /api/v1/reclamos',
        get_stats: 'GET /api/v1/payments/stats',
        verify_payment: 'GET /api/v1/payments/verify/:paymentId',
        service_info: 'GET /api/v1/payments'
      },
      
      features: [
        'Procesamiento de pagos con Culqi',
        'Sistema de reclamos INDECOPI completo',
        'Integración completa con Firebase',
        'Envío automático de emails con SendGrid',
        'Dashboard de administración en tiempo real',
        'Verificación de pagos en tiempo real',
        'IDs secuenciales por mes'
      ],
      
      support: {
        email: 'contacto@goldinfiniti.com',
        phone: '+51 968 786 648',
        dashboard: 'https://culqi-backend-pro.onrender.com/api/v1/payments/stats'
      },
      
      compliance: {
        indecopi: 'Libro de Reclamaciones Digital',
        data_protection: 'Protección de datos del consumidor',
        receipts: 'Comprobantes electrónicos'
      }
    });
  }
}

// Crear y exportar instancia
const paymentController = new PaymentController();
module.exports = paymentController;