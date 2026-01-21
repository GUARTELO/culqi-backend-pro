// src/core/config/firebase.js - VERSIÓN SIMPLIFICADA Y SEGURA
const admin = require('firebase-admin');

// Variables globales
let firestore = null;
let auth = null;
let isInitialized = false;

/**
 * Inicializar Firebase de forma SEGURA (sin errores críticos)
 */
const initializeFirebase = () => {
  if (isInitialized) {
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
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://mi-tienda-online-10630.firebaseio.com"
          });
          
          console.log('✅ Firebase inicializado con credenciales de entorno');
        }
      } catch (parseError) {
        console.warn('⚠️ Error parseando credenciales:', parseError.message);
      }
    }
    
    // OPCIÓN 2: Archivo local (solo desarrollo)
    if (!admin.apps.length && process.env.NODE_ENV === 'development') {
      try {
        // Intentar cargar archivo local
        const serviceAccount = require('../../../firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: "https://mi-tienda-online-10630.firebaseio.com"
        });
        console.log('✅ Firebase inicializado con archivo local');
      } catch (fileError) {
        console.warn('⚠️ No se encontró archivo de credenciales local');
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
      console.warn('⚠️ Firebase NO inicializado - Modo sin conexión a BD');
      console.warn('💡 Configura FIREBASE_SERVICE_ACCOUNT en Render.com');
    }

  } catch (error) {
    console.error('❌ Error en Firebase (no crítico):', error.message);
    // NO lanzar error - el backend puede funcionar sin Firebase
  }

  return { 
    firestore, 
    auth, 
    isConnected: isInitialized,
    projectId: 'mi-tienda-online-10630'
  };
};

// Inicializar e exportar
const firebase = initializeFirebase();

module.exports = {
  firestore: firebase.firestore,
  auth: firebase.auth,
  isConnected: () => firebase.isConnected,
  
  // Información de diagnóstico
  getStatus: () => ({
    connected: firebase.isConnected,
    initialized: isInitialized,
    hasApps: admin.apps.length > 0,
    projectId: firebase.projectId,
    environment: process.env.NODE_ENV || 'unknown'
  }),
  
  // Método para reconectar si es necesario
  reconnect: () => {
    isInitialized = false;
    return initializeFirebase();
  }
};