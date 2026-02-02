// src/core/config/firebase.js - VERSIÓN PRODUCCIÓN 100% REAL
'use strict';

const admin = require('firebase-admin');
const logger = require('./utils/logger');

// ============================================
// VARIABLES GLOBALES DE CONEXIÓN
// ============================================
let firestore = null;
let auth = null;
let isInitialized = false;
let initializationError = null;

// ============================================
// CONFIGURACIÓN DE PROYECTO
// ============================================
const FIREBASE_CONFIG = {
  projectId: 'mi-tienda-online-10630',
  databaseURL: 'https://mi-tienda-online-10630.firebaseio.com',
  storageBucket: 'mi-tienda-online-10630.appspot.com',
  locationId: 'nam5', // us-central1
  timezone: 'America/Lima'
};

// ============================================
// VALIDACIÓN DE CREDENCIALES
// ============================================
function validateServiceAccount(serviceAccount) {
  if (!serviceAccount) {
    throw new Error('Credenciales vacías');
  }

  const requiredFields = [
    'type',
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id'
  ];

  for (const field of requiredFields) {
    if (!serviceAccount[field]) {
      throw new Error(`Campo requerido faltante: ${field}`);
    }
  }

  // Validar formato de private_key
  if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Formato de private_key inválido');
  }

  return true;
}

// ============================================
// INICIALIZACIÓN DE FIREBASE
// ============================================
function initializeFirebase() {
  // Evitar inicialización múltiple
  if (isInitialized) {
    logger.info('✅ Firebase ya está inicializado y funcionando');
    return { success: true, firestore, auth };
  }

  if (initializationError) {
    logger.warn('⚠️ Firebase tuvo un error previo:', initializationError.message);
  }

  logger.info('🚀 INICIALIZANDO FIREBASE PARA PRODUCCIÓN...', {
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    region: process.env.REGION || 'us-east'
  });

  try {
    let serviceAccount = null;
    let source = 'unknown';

    // ============================================
    // 1. OBTENER CREDENCIALES DE VARIABLE DE ENTORNO (RENDER.COM)
    // ============================================
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      logger.info('🔑 Detectada variable FIREBASE_SERVICE_ACCOUNT en entorno');
      
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        source = 'environment_variable';
        
        validateServiceAccount(serviceAccount);
        logger.info('✅ Credenciales de entorno validadas correctamente');
        
      } catch (parseError) {
        throw new Error(`Error parseando FIREBASE_SERVICE_ACCOUNT: ${parseError.message}`);
      }
    }
    // ============================================
    // 2. OBTENER DE ARCHIVO LOCAL (SOLO DESARROLLO)
    // ============================================
    else if (process.env.NODE_ENV === 'development') {
      logger.info('💻 Modo desarrollo: buscando archivo local');
      
      try {
        // Ruta relativa desde este archivo
        const path = require('path');
        const credentialPath = path.join(__dirname, '..', '..', '..', 'config', 'firebase-service-account.json');
        serviceAccount = require(credentialPath);
        source = 'local_file';
        
        validateServiceAccount(serviceAccount);
        logger.info('✅ Credenciales locales validadas correctamente');
        
      } catch (fileError) {
        logger.warn('⚠️ No se pudo cargar archivo local:', fileError.message);
      }
    }

    // ============================================
    // 3. VERIFICAR SI TENEMOS CREDENCIALES
    // ============================================
    if (!serviceAccount) {
      throw new Error(
        'NO SE ENCONTRARON CREDENCIALES DE FIREBASE\n' +
        '────────────────────────────────────────────\n' +
        'EN RENDER.COM, CONFIGURA LA VARIABLE:\n' +
        'Nombre: FIREBASE_SERVICE_ACCOUNT\n' +
        'Valor: (contenido COMPLETO de firebase-service-account.json)\n' +
        '────────────────────────────────────────────'
      );
    }

    // ============================================
    // 4. INICIALIZAR APLICACIÓN FIREBASE
    // ============================================
    if (!admin.apps.length) {
      logger.info(`📦 Inicializando Firebase App desde: ${source}`);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: FIREBASE_CONFIG.databaseURL,
        storageBucket: FIREBASE_CONFIG.storageBucket
      });

      logger.info('✅ Firebase App inicializada exitosamente');
    } else {
      logger.info('ℹ️ Firebase App ya estaba inicializada');
    }

    // ============================================
    // 5. OBTENER SERVICIOS
    // ============================================
    firestore = admin.firestore();
    auth = admin.auth();
    
    // Configuraciones adicionales de Firestore
    firestore.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true
    });

    // ============================================
    // 6. VERIFICAR CONEXIÓN REAL
    // ============================================
    logger.info('🔍 Verificando conexión a Firebase...');
    
    // Test simple de conexión
    firestore.listCollections()
      .then(collections => {
        isInitialized = true;
        initializationError = null;
        
        logger.info('🎉 CONEXIÓN A FIREBASE ESTABLECIDA EXITOSAMENTE', {
          projectId: FIREBASE_CONFIG.projectId,
          location: FIREBASE_CONFIG.locationId,
          collectionsCount: collections.length,
          collections: collections.map(c => c.id),
          timestamp: new Date().toISOString()
        });

        // Log de información del proyecto
        console.log('\n' + '='.repeat(60));
        console.log('🚀 FIREBASE CONECTADO PARA PRODUCCIÓN');
        console.log('='.repeat(60));
        console.log(`📊 Proyecto: ${FIREBASE_CONFIG.projectId}`);
        console.log(`📍 Ubicación: ${FIREBASE_CONFIG.locationId} (${FIREBASE_CONFIG.timezone})`);
        console.log(`🌐 Base de datos: ${FIREBASE_CONFIG.databaseURL}`);
        console.log(`📁 Colecciones: ${collections.length} disponibles`);
        console.log('='.repeat(60) + '\n');
      })
      .catch(testError => {
        initializationError = testError;
        logger.error('❌ Error verificando conexión:', testError.message);
      });

    return { 
      success: true, 
      firestore, 
      auth, 
      source,
      projectId: FIREBASE_CONFIG.projectId 
    };

  } catch (error) {
    // ============================================
    // 7. MANEJO DE ERRORES
    // ============================================
    initializationError = error;
    isInitialized = false;
    
    logger.error('🔥 ERROR CRÍTICO INICIALIZANDO FIREBASE:', {
      error: error.message,
      stack: error.stack,
      environment: process.env.NODE_ENV,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      timestamp: new Date().toISOString()
    });

    // Mensaje claro para producción
    console.error('\n' + '⚠️'.repeat(30));
    console.error('FIREBASE NO CONECTADO - ACCIÓN REQUERIDA:');
    console.error('⚠️'.repeat(30));
    console.error('\n1. Ve a Render.com → tu servicio → Environment');
    console.error('2. Agrega variable: FIREBASE_SERVICE_ACCOUNT');
    console.error('3. Valor: (todo el contenido de firebase-service-account.json)');
    console.error('4. Reinicia el servicio en Render.com');
    console.error('\n' + '─'.repeat(60));
    
    throw error; // En producción, es mejor fallar temprano
  }
}

// ============================================
// FUNCIÓN DE RECONEXIÓN
// ============================================
function reconnectFirebase() {
  logger.info('🔄 Solicitada reconexión a Firebase...');
  
  // Resetear estado
  isInitialized = false;
  firestore = null;
  auth = null;
  initializationError = null;
  
  try {
    return initializeFirebase();
  } catch (error) {
    logger.error('❌ Error en reconexión:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// FUNCIÓN DE VERIFICACIÓN DE SALUD
// ============================================
async function checkFirebaseHealth() {
  if (!isInitialized || !firestore) {
    return {
      healthy: false,
      initialized: isInitialized,
      error: initializationError ? initializationError.message : 'No inicializado',
      timestamp: new Date().toISOString()
    };
  }

  try {
    // Test simple de lectura
    const startTime = Date.now();
    const testQuery = await firestore
      .collection('ordenes')
      .limit(1)
      .get();
    
    const responseTime = Date.now() - startTime;
    
    // Obtener estadísticas
    const collections = await firestore.listCollections();
    
    return {
      healthy: true,
      initialized: true,
      responseTime: `${responseTime}ms`,
      projectId: FIREBASE_CONFIG.projectId,
      database: FIREBASE_CONFIG.databaseURL,
      location: FIREBASE_CONFIG.locationId,
      collections: {
        count: collections.length,
        names: collections.map(c => c.id)
      },
      testQuery: {
        success: true,
        documents: testQuery.size
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (healthError) {
    return {
      healthy: false,
      initialized: true,
      error: healthError.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA AL CARGAR
// ============================================
// Inicializar Firebase inmediatamente pero sin bloquear
setTimeout(() => {
  try {
    initializeFirebase();
  } catch (error) {
    // El error ya fue logueado en initializeFirebase
    // En producción, continuamos pero sin Firebase
    logger.warn('⚠️ Aplicación continuará SIN Firebase conectado');
  }
}, 1000); // Pequeño delay para que otros módulos se carguen

// ============================================
// EXPORTACIÓN DEL MÓDULO
// ============================================
module.exports = {
  // Getters para acceso seguro
  get firestore() {
    if (!firestore) {
      const error = new Error(
        'Firestore no disponible. ' +
        (initializationError ? initializationError.message : 'Firebase no inicializado.')
      );
      error.code = 'FIREBASE_NOT_INITIALIZED';
      throw error;
    }
    return firestore;
  },
  
  get auth() {
    if (!auth) {
      const error = new Error(
        'Firebase Auth no disponible. ' +
        (initializationError ? initializationError.message : 'Firebase no inicializado.')
      );
      error.code = 'FIREBASE_AUTH_NOT_AVAILABLE';
      throw error;
    }
    return auth;
  },
  
  get isConnected() {
    return isInitialized;
  },
  
  get initializationError() {
    return initializationError;
  },
  
  // Configuración
  config: FIREBASE_CONFIG,
  
  // Métodos
  initialize: initializeFirebase,
  reconnect: reconnectFirebase,
  checkHealth: checkFirebaseHealth,
  
  // Información del estado
  getStatus: () => ({
    connected: isInitialized,
    initialized: isInitialized,
    hasFirestore: !!firestore,
    hasAuth: !!auth,
    projectId: FIREBASE_CONFIG.projectId,
    databaseURL: FIREBASE_CONFIG.databaseURL,
    locationId: FIREBASE_CONFIG.locationId,
    timezone: FIREBASE_CONFIG.timezone,
    environment: process.env.NODE_ENV || 'production',
    hasEnvVariable: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    initializationError: initializationError ? initializationError.message : null,
    timestamp: new Date().toISOString()
  }),
  
  // Helper para uso seguro
  safeQuery: async (collectionName, queryCallback) => {
    if (!isInitialized || !firestore) {
      throw new Error(`Firebase no disponible para consultar ${collectionName}`);
    }
    
    try {
      const collectionRef = firestore.collection(collectionName);
      return await queryCallback(collectionRef);
    } catch (error) {
      logger.error(`Error en consulta a ${collectionName}:`, error.message);
      throw error;
    }
  }
};

// ============================================
// LOG INICIAL
// ============================================
logger.info('📦 Módulo Firebase configurado para producción');
logger.info(`🏢 Proyecto: ${FIREBASE_CONFIG.projectId}`);
logger.info(`📍 Región: ${FIREBASE_CONFIG.locationId}`);