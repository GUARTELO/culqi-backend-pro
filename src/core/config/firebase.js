// src/core/config/firebase.js - VERSIÓN SIMPLIFICADA Y SEGURA
const admin = require('firebase-admin');

// Variables globales
let firestore = null;
let auth = null;
let isInitialized = false;

/**
 * Mock de Firestore para fallback seguro
 */
function createMockFirestore() {
  return {
    projectId: 'mi-tienda-online-10630',
    databaseId: '(default)',
    collection: (name) => ({
      doc: (id) => ({
        get: () => Promise.resolve({ exists: false, data: () => null }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      }),
      get: () => Promise.resolve({ empty: true, docs: [] }),
      where: () => ({ get: () => Promise.resolve({ empty: true, docs: [] }) }),
      orderBy: () => ({ get: () => Promise.resolve({ empty: true, docs: [] }) }),
      limit: () => ({ get: () => Promise.resolve({ empty: true, docs: [] }) })
    }),
    listCollections: () => Promise.resolve([]),
    _isMock: true
  };
}

/**
 * Mock de Auth para fallback seguro
 */
function createMockAuth() {
  return {
    verifyIdToken: () => Promise.reject(new Error('Auth no disponible')),
    getUser: () => Promise.reject(new Error('Auth no disponible')),
    _isMock: true
  };
}

/**
 * Inicializar Firebase de forma SEGURA (sin errores críticos)
 */
const initializeFirebase = () => {
  if (isInitialized) {
    console.log('ℹ️ Firebase ya está inicializado');
    return { firestore, auth, isConnected: true };
  }

  console.log('🔄 Intentando conectar a Firebase...');

  try {
    // OPCIÓN 1: Variable de entorno en Render.com
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('📦 Detectada variable FIREBASE_SERVICE_ACCOUNT');
      
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        if (!admin.apps.length) {
        admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key
  }),
  projectId: serviceAccount.project_id,
  databaseURL: "https://mi-tienda-online-10630.firebaseio.com"
});


          
          console.log('✅ Firebase inicializado con credenciales de entorno');
        }
      } catch (parseError) {
        console.warn('⚠️ Error parseando credenciales:', parseError.message);
      }
    }
    
    // OPCIÓN 2: Archivo local (solo desarrollo)
    if (!admin.apps.length) {
      try {
        // Intentar cargar archivo local - RUTA CORREGIDA
        const serviceAccount = require('../../../config/firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: "https://mi-tienda-online-10630.firebaseio.com"
        });
        console.log('✅ Firebase inicializado con archivo local');
      } catch (fileError) {
        console.warn('⚠️ No se encontró archivo de credenciales local:', fileError.message);
      }
    }

    // Si se pudo inicializar
if (admin.apps.length > 0) {
  firestore = admin.firestore();
  auth = admin.auth();
  isInitialized = true;

  console.log('✅ Firebase configurado correctamente');
  console.log('📊 Proyecto: mi-tienda-online-10630');
  console.log('📍 Ubicación: nam5 (us-central1)');
} else {
  console.error('❌ Firebase NO inicializado en PRODUCCIÓN');
  throw new Error('Firebase no pudo inicializarse. Servicio detenido.');
}


  } catch (error) {
  console.error('❌ Error CRÍTICO inicializando Firebase:', error.message);
  throw error;
}


  return { 
    firestore, 
    auth, 
    isConnected: isInitialized,
    projectId: 'mi-tienda-online-10630'
  };
};

// Inicializar automáticamente al cargar el módulo
initializeFirebase();

module.exports = {
  // ✅ Exportar las variables globales
  firestore,    // Esto exporta Firestore real o mock
  auth,         // Igual aquí
  isConnected: isInitialized,  // Boolean
  
  // Información de diagnóstico
  getStatus: () => ({
    connected: isInitialized,
    initialized: isInitialized,
    hasApps: admin.apps.length > 0,
    projectId: process.env.FIREBASE_PROJECT_ID || 'mi-tienda-online-10630',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),
    isMock: firestore && firestore._isMock === true
  }),

  // Método para reconectar si es necesario
  reconnect: () => {
    console.log('🔄 Solicitada reconexión a Firebase');
    isInitialized = false;
    firestore = null;
    auth = null;
    return initializeFirebase();
  }
};