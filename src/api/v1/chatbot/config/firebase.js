// ================================================================
// FIREBASE DEL CHATBOT BRIONI
// INSTANCIA NOMBRADA Y AISLADA
// ================================================================
// Ubicación:
// src/api/v1/chatbot/config/firebase.js
//
// OBJETIVO:
//
// Crear una instancia Firebase EXCLUSIVA para el chatbot:
//
//     admin.app('chatbot')
//
// IMPORTANTE:
//
// - NO modifica src/core/config/firebase.js
// - NO reemplaza la instancia Firebase principal
// - NO utiliza admin.firestore()
// - NO utiliza la app Firebase por defecto para operaciones
// - El chatbot obtiene Firestore exclusivamente mediante:
//       getFirestore()
// - La instancia del chatbot se identifica como:
//       admin.app('chatbot')
//
// ================================================================

const admin = require('firebase-admin');
const path = require('path');

// ================================================================
// CONFIGURACIÓN
// ================================================================

const CHATBOT_APP_NAME = 'chatbot';

const PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID ||
    'mi-tienda-online-10630';

// ================================================================
// ESTADO INTERNO
// ================================================================

let chatbotApp = null;
let chatbotFirestore = null;
let initialized = false;
let lastError = null;

// ================================================================
// OBTENER CREDENCIALES
// ================================================================
//
// PRIORIDAD:
//
// 1. FIREBASE_SERVICE_ACCOUNT
// 2. Archivo local de service account
// 3. Opciones de la app principal como fallback
//
// IMPORTANTE:
//
// La opción 3 NO reutiliza la instancia Firestore principal.
//
// Únicamente utiliza su configuración para crear:
//
//     admin.app('chatbot')
//
// ================================================================

function getCredentials() {

    // ============================================================
    // OPCIÓN 1
    // FIREBASE_SERVICE_ACCOUNT
    // ============================================================

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {

        try {

            const serviceAccount =
                JSON.parse(
                    process.env.FIREBASE_SERVICE_ACCOUNT
                );

            if (
                !serviceAccount.project_id ||
                !serviceAccount.client_email ||
                !serviceAccount.private_key
            ) {

                throw new Error(
                    'FIREBASE_SERVICE_ACCOUNT no contiene las credenciales requeridas'
                );
            }

            return {

                credential:
                    admin.credential.cert({

                        projectId:
                            serviceAccount.project_id,

                        clientEmail:
                            serviceAccount.client_email,

                        privateKey:
                            serviceAccount.private_key
                    }),

                projectId:
                    serviceAccount.project_id
            };

        } catch (error) {

            console.error(
                '[Chatbot Firebase] ❌ Error leyendo FIREBASE_SERVICE_ACCOUNT:',
                error.message
            );

            throw new Error(
                'FIREBASE_SERVICE_ACCOUNT inválida'
            );
        }
    }

    // ============================================================
    // OPCIÓN 2
    // ARCHIVO LOCAL
    // ============================================================

    const serviceAccountPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        path.resolve(
            process.cwd(),
            'config',
            'firebase-service-account.json'
        );

    try {

        const serviceAccount =
            require(serviceAccountPath);

        if (
            !serviceAccount.project_id ||
            !serviceAccount.client_email ||
            !serviceAccount.private_key
        ) {

            throw new Error(
                'El archivo de credenciales no contiene los campos requeridos'
            );
        }

        console.log(
            '[Chatbot Firebase] 🔐 Usando credenciales locales'
        );

        return {

            credential:
                admin.credential.cert({

                    projectId:
                        serviceAccount.project_id,

                    clientEmail:
                        serviceAccount.client_email,

                    privateKey:
                        serviceAccount.private_key
                }),

            projectId:
                serviceAccount.project_id
        };

    } catch (error) {

        // ========================================================
        // Si el archivo no existe, continuamos con el fallback.
        // ========================================================

        if (
            error.code !== 'MODULE_NOT_FOUND'
        ) {

            console.error(
                '[Chatbot Firebase] ⚠️ Error leyendo credenciales locales:',
                error.message
            );
        }
    }

    // ============================================================
    // OPCIÓN 3
    // FALLBACK A LA APP PRINCIPAL
    // ============================================================
    //
    // IMPORTANTE:
    //
    // Aquí NO obtenemos Firestore.
    //
    // Solamente reutilizamos las opciones de configuración
    // necesarias para crear una NUEVA app llamada:
    //
    //     chatbot
    //
    // ============================================================

    try {

        const defaultApp =
            admin.app();

        if (
            defaultApp &&
            defaultApp.options
        ) {

            console.log(
                '[Chatbot Firebase] 🔄 Usando configuración de Firebase existente para crear la instancia "chatbot"'
            );

            return {

                ...defaultApp.options,

                projectId:
                    defaultApp.options.projectId ||
                    PROJECT_ID
            };
        }

    } catch (error) {

        console.log(
            '[Chatbot Firebase] ℹ️ La aplicación principal todavía no está disponible'
        );
    }

    // ============================================================
    // SIN CREDENCIALES
    // ============================================================

    throw new Error(
        'No existen credenciales disponibles para Firebase del chatbot'
    );
}

// ================================================================
// CONFIGURAR FIRESTORE
// ================================================================

function configureFirestore(firestore) {

    if (!firestore) {

        throw new Error(
            'Firestore del chatbot no está disponible'
        );
    }

    // ============================================================
    // EVITAR PROBLEMAS CON CAMPOS undefined
    // ============================================================

    firestore.settings({
        ignoreUndefinedProperties: true
    });

    return firestore;
}

// ================================================================
// INICIALIZAR FIREBASE DEL CHATBOT
// ================================================================

function initializeChatbotFirebase() {

    // ============================================================
    // SI YA ESTÁ INICIALIZADO
    // ============================================================

    if (
        initialized &&
        chatbotApp &&
        chatbotFirestore
    ) {

        return true;
    }

    // ============================================================
    // INTENTAR RECUPERAR LA APP NOMBRADA EXISTENTE
    // ============================================================

    try {

        chatbotApp =
            admin.app(
                CHATBOT_APP_NAME
            );

        chatbotFirestore =
            configureFirestore(
                chatbotApp.firestore()
            );

        initialized = true;
        lastError = null;

        console.log(
            '[Chatbot Firebase] ✅ Instancia "chatbot" ya existente'
        );

        console.log(
            `[Chatbot Firebase] 📊 Proyecto: ${
                chatbotApp.options.projectId ||
                PROJECT_ID
            }`
        );

        return true;

    } catch (error) {

        // ========================================================
        // La app "chatbot" todavía no existe.
        // Continuamos con la creación.
        // ========================================================
    }

    // ============================================================
    // CREAR NUEVA APP NOMBRADA
    // ============================================================

    try {

        console.log(
            '[Chatbot Firebase] 🔄 Creando instancia Firebase "chatbot"...'
        );

        const options =
            getCredentials();

        chatbotApp =
            admin.initializeApp(
                options,
                CHATBOT_APP_NAME
            );

        chatbotFirestore =
            configureFirestore(
                chatbotApp.firestore()
            );

        initialized = true;
        lastError = null;

        console.log(
            '[Chatbot Firebase] ✅ Instancia "chatbot" creada correctamente'
        );

        console.log(
            `[Chatbot Firebase] 📊 Proyecto: ${
                chatbotApp.options.projectId ||
                PROJECT_ID
            }`
        );

        return true;

    } catch (error) {

        initialized = false;

        chatbotApp = null;

        chatbotFirestore = null;

        lastError =
            error.message;

        console.error(
            '[Chatbot Firebase] ❌ Error inicializando Firebase:',
            error.message
        );

        return false;
    }
}

// ================================================================
// OBTENER FIRESTORE DEL CHATBOT
// ================================================================
//
// ESTA ES LA ÚNICA FUNCIÓN QUE DEBEN UTILIZAR:
//
// chatbotSession.js
// chatbotService.js
// controller.js
//
// para acceder al Firestore del chatbot.
//
// ================================================================

function getFirestore() {

    if (
        !initialized ||
        !chatbotFirestore
    ) {

        const success =
            initializeChatbotFirebase();

        if (!success) {

            throw new Error(
                'Firebase del chatbot no está disponible'
            );
        }
    }

    if (!chatbotFirestore) {

        throw new Error(
            'Firestore del chatbot no está disponible'
        );
    }

    return chatbotFirestore;
}

// ================================================================
// OBTENER APP DEL CHATBOT
// ================================================================

function getApp() {

    if (
        !initialized ||
        !chatbotApp
    ) {

        const success =
            initializeChatbotFirebase();

        if (!success) {

            throw new Error(
                'App Firebase del chatbot no está disponible'
            );
        }
    }

    if (!chatbotApp) {

        throw new Error(
            'App Firebase del chatbot no está disponible'
        );
    }

    return chatbotApp;
}

// ================================================================
// ESTADO
// ================================================================

function getStatus() {

    return {

        initialized,

        available:
            Boolean(
                chatbotFirestore
            ),

        appName:
            CHATBOT_APP_NAME,

        projectId:
            chatbotApp?.options?.projectId ||
            PROJECT_ID,

        lastError,

        timestamp:
            new Date().toISOString()
    };
}

// ================================================================
// CERRAR / LIMPIAR INSTANCIA
// ================================================================
//
// Útil para:
//
// - tests
// - shutdown controlado
// - procesos administrados
//
// NO se utiliza durante una operación normal del chatbot.
//
// ================================================================

async function shutdown() {

    if (!chatbotApp) {

        return true;
    }

    try {

        await chatbotApp.delete();

        chatbotApp = null;

        chatbotFirestore = null;

        initialized = false;

        lastError = null;

        console.log(
            '[Chatbot Firebase] 🔌 Instancia "chatbot" cerrada'
        );

        return true;

    } catch (error) {

        lastError =
            error.message;

        console.error(
            '[Chatbot Firebase] ❌ Error cerrando instancia:',
            error.message
        );

        return false;
    }
}

// ================================================================
// INICIALIZACIÓN
// ================================================================
//
// Se inicializa al cargar el módulo.
//
// Esto permite detectar inmediatamente errores de configuración.
//
// ================================================================

initializeChatbotFirebase();

// ================================================================
// EXPORTAR
// ================================================================

module.exports = {

    // Firestore exclusivo del chatbot
    getFirestore,

    // App Firebase exclusiva del chatbot
    getApp,

    // Estado
    getStatus,

    // Inicialización manual
    initialize:
        initializeChatbotFirebase,

    // Cierre controlado
    shutdown,

    // Disponibilidad
    isAvailable: () =>
        initialized &&
        Boolean(chatbotFirestore)
};