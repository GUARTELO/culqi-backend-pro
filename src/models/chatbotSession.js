// ================================================================
// MODELO DE SESIÓN - CHATBOT BRIONI v2.0
// ================================================================
// Ubicación:
// src/models/chatbotSession.js
//
// RESPONSABILIDAD:
// Gestionar exclusivamente las sesiones del chatbot.
//
// AISLAMIENTO:
// - NO utiliza el Firebase principal.
// - NO utiliza admin.firestore().
// - NO inicializa Firebase.
// - NO accede a src/core/config/firebase.js.
// - Utiliza exclusivamente:
//   src/api/v1/chatbot/config/firebase.js
//
// FIRESTORE UTILIZADO:
//
// chatbotSession.js
//       │
//       ▼
// chatbotFirebase.getFirestore()
//       │
//       ▼
// admin.app('chatbot')
//       │
//       ▼
// Firestore
//       │
//       ▼
// chatbot_sessions
// ================================================================

const chatbotFirebase = require('../api/v1/chatbot/config/firebase');

// ================================================================
// FIRESTORE EXCLUSIVO DEL CHATBOT
// ================================================================
//
// La instancia es obtenida únicamente desde:
//
// src/api/v1/chatbot/config/firebase.js
//
// Ese archivo es responsable de utilizar:
//
// admin.app('chatbot')
//
// Por lo tanto este modelo nunca utiliza:
//
// admin.firestore()
//
// ================================================================

const firestore = chatbotFirebase.getFirestore();

// ================================================================
// FIELD VALUE
// ================================================================
//
// Firebase Admin expone FieldValue a través del módulo firebase-admin.
// Esto NO selecciona la aplicación Firebase principal.
//
// La aplicación que determina el Firestore utilizado es:
//
// chatbotFirebase.getFirestore()
//
// Por lo tanto las operaciones de este modelo continúan apuntando
// exclusivamente al Firestore de la instancia "chatbot".
// ================================================================

const FieldValue = require('firebase-admin').firestore.FieldValue;

// ================================================================
// NORMALIZAR TELÉFONO
// ================================================================

/**
 * Normaliza un número de teléfono.
 *
 * Elimina todo carácter que no sea numérico.
 *
 * Ejemplo:
 *
 * "+51 999-888-777"
 *
 * se convierte en:
 *
 * "51999888777"
 *
 * @param {string|number} phone
 * @returns {string|null}
 */
function normalizePhone(phone) {

    if (!phone) {
        return null;
    }

    return String(phone).replace(/\D/g, '');
}

// ================================================================
// VERIFICAR EXPIRACIÓN
// ================================================================

/**
 * Verifica si una sesión ha expirado.
 *
 * La sesión expira después de 30 minutos
 * de inactividad.
 *
 * @param {object|string|Date} lastActivityAt
 * @returns {boolean}
 */
function isSessionExpired(lastActivityAt) {

    if (!lastActivityAt) {
        return true;
    }

    const now = Date.now();

    let lastActivity;

    try {

        if (
            lastActivityAt &&
            typeof lastActivityAt.toDate === 'function'
        ) {

            lastActivity =
                lastActivityAt.toDate().getTime();

        } else {

            lastActivity =
                new Date(lastActivityAt).getTime();
        }

    } catch (error) {

        return true;
    }

    // Fecha inválida
    if (Number.isNaN(lastActivity)) {
        return true;
    }

    const inactivityMinutes =
        (now - lastActivity) / (1000 * 60);

    return inactivityMinutes > 30;
}

// ================================================================
// CLASE CHATBOT SESSION
// ================================================================

class ChatbotSession {

    /**
     * Constructor de sesión.
     *
     * @param {string|number} phone
     * @param {string} channel
     */
    constructor(phone, channel = 'web') {

        // --------------------------------------------------------
        // NORMALIZAR TELÉFONO
        // --------------------------------------------------------

        this.phone =
            normalizePhone(phone);

        // --------------------------------------------------------
        // CANAL
        // --------------------------------------------------------

        this.channel =
            channel;

        // --------------------------------------------------------
        // VALIDACIÓN
        // --------------------------------------------------------

        if (!this.phone) {

            throw new Error(
                'Teléfono inválido'
            );
        }

        // --------------------------------------------------------
        // COLECCIÓN DEL CHATBOT
        // --------------------------------------------------------
        //
        // IMPORTANTE:
        //
        // firestore proviene de:
        //
        // chatbotFirebase.getFirestore()
        //
        // y NO de:
        //
        // admin.firestore()
        //
        // --------------------------------------------------------

        this.collection =
            firestore.collection(
                'chatbot_sessions'
            );

        // --------------------------------------------------------
        // DOCUMENTO DE LA SESIÓN
        // --------------------------------------------------------

        this.doc =
            this.collection.doc(
                this.phone
            );
    }

    // ============================================================
    // OBTENER SESIÓN
    // ============================================================

    /**
     * Obtiene la sesión del usuario.
     *
     * Comportamiento:
     *
     * 1. Busca la sesión.
     * 2. Si existe:
     *    - verifica expiración.
     * 3. Si expiró:
     *    - la reinicia.
     * 4. Si no existe:
     *    - crea una nueva.
     *
     * @returns {Promise<object>}
     */
    async get() {

        try {

            // ----------------------------------------------------
            // BUSCAR DOCUMENTO
            // ----------------------------------------------------

            const snapshot =
                await this.doc.get();

            // ----------------------------------------------------
            // SESIÓN EXISTENTE
            // ----------------------------------------------------

            if (snapshot.exists) {

                const data =
                    snapshot.data();

                // ------------------------------------------------
                // VERIFICAR EXPIRACIÓN
                // ------------------------------------------------

                if (
                    isSessionExpired(
                        data.lastActivityAt
                    )
                ) {

                    await this.reset();

                    return await this.get();
                }

                // ------------------------------------------------
                // SESIÓN ACTIVA
                // ------------------------------------------------

                return data;
            }

            // ====================================================
            // CREAR SESIÓN NUEVA
            // ====================================================

            const newSession = {

                // ------------------------------------------------
                // IDENTIFICACIÓN
                // ------------------------------------------------

                phone:
                    this.phone,

                channel:
                    this.channel,

                // ------------------------------------------------
                // ESTADO INICIAL
                // ------------------------------------------------

                step:
                    'menu',

                // ------------------------------------------------
                // CONTEXTO
                // ------------------------------------------------

                context: {

                    orderId:
                        null,

                    productId:
                        null,

                    waitingFor:
                        null,

                    lastQuery:
                        null
                },

                // ------------------------------------------------
                // CONTADOR
                // ------------------------------------------------

                messages:
                    0,

                // ------------------------------------------------
                // TIMESTAMPS
                // ------------------------------------------------

                createdAt:
                    FieldValue.serverTimestamp(),

                updatedAt:
                    FieldValue.serverTimestamp(),

                lastActivityAt:
                    FieldValue.serverTimestamp()
            };

            // ----------------------------------------------------
            // GUARDAR SESIÓN
            // ----------------------------------------------------

            await this.doc.set(
                newSession
            );

            // ----------------------------------------------------
            // VOLVER A LEER
            // ----------------------------------------------------

            const created =
                await this.doc.get();

            return created.data();

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en get():',
                error.message
            );

            // ----------------------------------------------------
            // FALLBACK SEGURO
            // ----------------------------------------------------

            return {

                phone:
                    this.phone,

                channel:
                    this.channel,

                step:
                    'menu',

                context:
                    {},

                messages:
                    0
            };
        }
    }

    // ============================================================
    // ACTUALIZAR SESIÓN
    // ============================================================

    /**
     * Actualiza los datos de la sesión.
     *
     * Nunca permite modificar:
     *
     * - phone
     * - channel
     *
     * Además actualiza automáticamente:
     *
     * - updatedAt
     * - lastActivityAt
     *
     * @param {object} data
     * @returns {Promise<boolean>}
     */
    async update(data) {

        try {

            // ----------------------------------------------------
            // VALIDACIÓN
            // ----------------------------------------------------

            if (
                !data ||
                typeof data !== 'object'
            ) {

                return false;
            }

            // ----------------------------------------------------
            // COPIA PARA NO MUTAR EL OBJETO ORIGINAL
            // ----------------------------------------------------

            const safeData = {
                ...data
            };

            // ----------------------------------------------------
            // PROTEGER IDENTIDAD
            // ----------------------------------------------------

            delete safeData.phone;

            delete safeData.channel;

            // ----------------------------------------------------
            // DATOS DE ACTUALIZACIÓN
            // ----------------------------------------------------

            const updateData = {

                ...safeData,

                updatedAt:
                    FieldValue.serverTimestamp(),

                lastActivityAt:
                    FieldValue.serverTimestamp()
            };

            // ----------------------------------------------------
            // ACTUALIZAR
            // ----------------------------------------------------

            await this.doc.set(
                updateData,
                {
                    merge: true
                }
            );

            return true;

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en update():',
                error.message
            );

            return false;
        }
    }

    // ============================================================
    // INCREMENTAR MENSAJES
    // ============================================================

    /**
     * Incrementa atómicamente el contador de mensajes.
     *
     * @returns {Promise<number>}
     */
    async incrementMessages() {

        try {

            await this.doc.update({

                // ------------------------------------------------
                // INCREMENTO ATÓMICO
                // ------------------------------------------------

                messages:
                    FieldValue.increment(1),

                // ------------------------------------------------
                // ACTIVIDAD
                // ------------------------------------------------

                lastActivityAt:
                    FieldValue.serverTimestamp()
            });

            // ----------------------------------------------------
            // LEER NUEVO VALOR
            // ----------------------------------------------------

            const snapshot =
                await this.doc.get();

            const data =
                snapshot.data();

            return data?.messages || 0;

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en incrementMessages():',
                error.message
            );

            return 0;
        }
    }

    // ============================================================
    // ACTUALIZAR CONTEXTO
    // ============================================================

    /**
     * Actualiza completamente el contexto de la sesión.
     *
     * @param {object} contextData
     * @returns {Promise<boolean>}
     */
    async updateContext(contextData) {

        try {

            if (
                !contextData ||
                typeof contextData !== 'object'
            ) {

                return false;
            }

            await this.doc.update({

                context:
                    contextData,

                updatedAt:
                    FieldValue.serverTimestamp(),

                lastActivityAt:
                    FieldValue.serverTimestamp()
            });

            return true;

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en updateContext():',
                error.message
            );

            return false;
        }
    }

    // ============================================================
    // CAMBIAR STEP
    // ============================================================

    /**
     * Cambia el paso actual del chatbot.
     *
     * @param {string} step
     * @returns {Promise<boolean>}
     */
    async setStep(step) {

        try {

            if (
                typeof step !== 'string' ||
                !step.trim()
            ) {

                return false;
            }

            await this.doc.update({

                step:
                    step.trim(),

                updatedAt:
                    FieldValue.serverTimestamp(),

                lastActivityAt:
                    FieldValue.serverTimestamp()
            });

            return true;

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en setStep():',
                error.message
            );

            return false;
        }
    }

    // ============================================================
    // RESET
    // ============================================================

    /**
     * Reinicia la sesión.
     *
     * Regresa:
     *
     * step = menu
     *
     * y limpia el contexto.
     *
     * @returns {Promise<boolean>}
     */
    async reset() {

        try {

            await this.doc.set({

                // ------------------------------------------------
                // STEP INICIAL
                // ------------------------------------------------

                step:
                    'menu',

                // ------------------------------------------------
                // CONTEXTO LIMPIO
                // ------------------------------------------------

                context: {

                    orderId:
                        null,

                    productId:
                        null,

                    waitingFor:
                        null,

                    lastQuery:
                        null
                },

                // ------------------------------------------------
                // TIMESTAMPS
                // ------------------------------------------------

                updatedAt:
                    FieldValue.serverTimestamp(),

                lastActivityAt:
                    FieldValue.serverTimestamp()

            }, {

                merge:
                    true
            });

            return true;

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en reset():',
                error.message
            );

            return false;
        }
    }

    // ============================================================
    // VERIFICAR SESIÓN ACTIVA
    // ============================================================

    /**
     * Verifica si existe una sesión activa.
     *
     * @returns {Promise<boolean>}
     */
    async isActive() {

        try {

            // ----------------------------------------------------
            // OBTENER DOCUMENTO
            // ----------------------------------------------------

            const snapshot =
                await this.doc.get();

            // ----------------------------------------------------
            // NO EXISTE
            // ----------------------------------------------------

            if (!snapshot.exists) {
                return false;
            }

            // ----------------------------------------------------
            // DATOS
            // ----------------------------------------------------

            const data =
                snapshot.data();

            // ----------------------------------------------------
            // VERIFICAR EXPIRACIÓN
            // ----------------------------------------------------

            return !isSessionExpired(
                data.lastActivityAt
            );

        } catch (error) {

            console.error(
                '[ChatbotSession] Error en isActive():',
                error.message
            );

            return false;
        }
    }
}

// ================================================================
// EXPORTAR
// ================================================================

module.exports = {

    ChatbotSession,

    normalizePhone,

    isSessionExpired
};
