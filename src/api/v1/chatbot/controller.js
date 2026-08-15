// ================================================================
// CONTROLADOR DEL CHATBOT BRIONI
// ================================================================
// Ubicación:
// src/api/v1/chatbot/controller.js
// ================================================================
//
// AISLAMIENTO FIREBASE
// ================================================================
//
// Este controlador NO utiliza:
//
//     admin.firestore()
//
// Este controlador NO utiliza:
//
//     src/core/config/firebase.js
//
// Utiliza exclusivamente:
//
//     src/api/v1/chatbot/config/firebase.js
//
// Flujo:
//
// Controller
//     │
//     ▼
// chatbotService
//     │
//     ├── ChatbotSession
//     │
//     └── chatbotFirebase
//              │
//              ▼
//       admin.app('chatbot')
//              │
//              ▼
//           Firestore
//
// ================================================================

const chatbotService =
    require('../../../services/chatbotService');

const chatbotFirebase =
    require('./config/firebase');

// ================================================================
// FIRESTORE EXCLUSIVO DEL CHATBOT
// ================================================================
//
// IMPORTANTE:
//
// No utilizar:
//
//     admin.firestore()
//
// Se obtiene exclusivamente:
//
//     chatbotFirebase.getFirestore()
//
// ================================================================

const firestore =
    chatbotFirebase.getFirestore();

// ============================================================
// PROCESAR MENSAJE DEL USUARIO
// ============================================================

exports.processMessage = async (req, res) => {

    try {

        const {
            message,
            phone,
            channel
        } = req.body;

        // ========================================================
        // VALIDAR MENSAJE
        // ========================================================

        if (!message) {

            return res.status(400).json({

                success: false,

                error:
                    'El mensaje es obligatorio',

                code:
                    'MESSAGE_REQUIRED'
            });
        }

        // ========================================================
        // VALIDAR TELÉFONO
        // ========================================================

        if (!phone) {

            return res.status(400).json({

                success: false,

                error:
                    'El teléfono es obligatorio',

                code:
                    'PHONE_REQUIRED'
            });
        }

        // ========================================================
        // LIMPIAR TELÉFONO
        // ========================================================

        const cleanPhone =
            String(phone).replace(/\D/g, '');

        const channelType =
            channel || 'web';

        // ========================================================
        // LOG
        // ========================================================

        console.log(
            `[ChatbotController] Mensaje de ${cleanPhone}: "${message}"`
        );

        // ========================================================
        // PROCESAR MENSAJE
        // ========================================================

        const response =
            await chatbotService.processMessage(
                message,
                cleanPhone,
                channelType
            );

        // ========================================================
        // RESPUESTA
        // ========================================================

        return res.json({

            success: true,

            response,

            timestamp:
                new Date().toISOString()
        });

    } catch (error) {

        console.error(
            '[ChatbotController] Error en processMessage:',
            error
        );

        return res.status(500).json({

            success: false,

            error:
                'Error procesando el mensaje'
        });
    }
};

// ============================================================
// CONSULTAR PEDIDO POR NÚMERO
// ============================================================

exports.getOrder = async (req, res) => {

    try {

        const {
            orderNumber
        } = req.params;

        // ========================================================
        // VALIDAR
        // ========================================================

        if (!orderNumber) {

            return res.status(400).json({

                success: false,

                error:
                    'Número de pedido obligatorio',

                code:
                    'ORDER_NUMBER_REQUIRED'
            });
        }

        // ========================================================
        // VALIDAR FORMATO
        // ========================================================

        if (
            !/^(BR-?\d{4}-?\d{4}|BR-\d{4}-\d{4})$/i
                .test(orderNumber)
        ) {

            return res.status(400).json({

                success: false,

                error:
                    'Formato de pedido inválido. Ejemplo: BR-2026-1234',

                code:
                    'INVALID_ORDER_FORMAT'
            });
        }

        // ========================================================
        // CONSULTAR SERVICIO
        // ========================================================

        const response =
            await chatbotService.getOrderStatus(
                orderNumber
            );

        // ========================================================
        // RESPUESTA
        // ========================================================

        return res.json({

            success: true,

            response,

            orderNumber:
                orderNumber.toUpperCase(),

            timestamp:
                new Date().toISOString()
        });

    } catch (error) {

        console.error(
            '[ChatbotController] Error en getOrder:',
            error
        );

        return res.status(500).json({

            success: false,

            error:
                'Error consultando el pedido'
        });
    }
};

// ============================================================
// BUSCAR PRODUCTOS
// ============================================================

exports.searchProducts = async (req, res) => {

    try {

        const {
            q
        } = req.query;

        // ========================================================
        // VALIDAR EXISTENCIA
        // ========================================================

        if (!q) {

            return res.status(400).json({

                success: false,

                error:
                    'El término de búsqueda es obligatorio',

                code:
                    'SEARCH_TERM_REQUIRED'
            });
        }

        // ========================================================
        // VALIDAR LONGITUD MÍNIMA
        // ========================================================

        if (q.length < 2) {

            return res.status(400).json({

                success: false,

                error:
                    'La búsqueda debe tener al menos 2 caracteres',

                code:
                    'SEARCH_TERM_TOO_SHORT'
            });
        }

        // ========================================================
        // VALIDAR LONGITUD MÁXIMA
        // ========================================================

        if (q.length > 50) {

            return res.status(400).json({

                success: false,

                error:
                    'La búsqueda no puede exceder los 50 caracteres',

                code:
                    'SEARCH_TERM_TOO_LONG'
            });
        }

        // ========================================================
        // BUSCAR
        // ========================================================

        const response =
            await chatbotService.searchProducts(q);

        // ========================================================
        // RESPUESTA
        // ========================================================

        return res.json({

            success: true,

            response,

            query:
                q,

            timestamp:
                new Date().toISOString()
        });

    } catch (error) {

        console.error(
            '[ChatbotController] Error en searchProducts:',
            error
        );

        return res.status(500).json({

            success: false,

            error:
                'Error buscando productos'
        });
    }
};

// ============================================================
// NOTIFICAR ASESOR HUMANO
// ============================================================

exports.notifyHuman = async (req, res) => {

    try {

        const {
            phone
        } = req.body;

        // ========================================================
        // VALIDAR TELÉFONO
        // ========================================================

        if (!phone) {

            return res.status(400).json({

                success: false,

                error:
                    'El teléfono es obligatorio',

                code:
                    'PHONE_REQUIRED'
            });
        }

        // ========================================================
        // LIMPIAR TELÉFONO
        // ========================================================

        const cleanPhone =
            String(phone).replace(/\D/g, '');

        // ========================================================
        // TRANSFERIR
        // ========================================================

        const response =
            await chatbotService.transferToHuman(
                cleanPhone
            );

        // ========================================================
        // RESPUESTA
        // ========================================================

        return res.json({

            success: true,

            response,

            timestamp:
                new Date().toISOString()
        });

    } catch (error) {

        console.error(
            '[ChatbotController] Error en notifyHuman:',
            error
        );

        return res.status(500).json({

            success: false,

            error:
                'Error notificando al administrador'
        });
    }
};

// ============================================================
// HEALTH CHECK
// ============================================================
//
// IMPORTANTE:
//
// Antes:
//
//     const admin = require('firebase-admin');
//     admin.firestore()
//
// Ahora:
//
//     firestore
//
// El Firestore utilizado aquí es exclusivamente:
//
//     admin.app('chatbot')
//
// ============================================================

exports.healthCheck = async (req, res) => {

    try {

        let firebaseStatus =
            'ok';

        let firebaseError =
            null;

        // ========================================================
        // VERIFICAR FIRESTORE DEL CHATBOT
        // ========================================================

        try {

            await firestore
                .collection('chatbot_sessions')
                .limit(1)
                .get();

        } catch (error) {

            firebaseStatus =
                'error';

            firebaseError =
                error.message;

            console.error(
                '[ChatbotController] Firebase chatbot health error:',
                error.message
            );
        }

        // ========================================================
        // ESTADO DE LA INSTANCIA
        // ========================================================

        const firebaseInstanceStatus =
            chatbotFirebase.getStatus();

        // ========================================================
        // RESPUESTA
        // ========================================================

        return res.json({

            success:
                firebaseStatus === 'ok',

            service:
                'Chatbot Brioni',

            status:
                firebaseStatus === 'ok'
                    ? 'operational'
                    : 'degraded',

            version:
                '2.0.0',

            timestamp:
                new Date().toISOString(),

            checks: {

                firebase:
                    firebaseStatus,

                firebaseInstance:
                    firebaseInstanceStatus,

                email:
                    process.env.EMAIL_USER
                        ? 'configured'
                        : 'not_configured'
            },

            ...(firebaseError && {

                firebaseError
            })
        });

    } catch (error) {

        console.error(
            '[ChatbotController] Error en healthCheck:',
            error
        );

        return res.status(500).json({

            success: false,

            error:
                'Health check failed'
        });
    }
};

// ============================================================
// ESTADÍSTICAS
// ============================================================
//
// Estas estadísticas utilizan:
//
//     chatbot_sessions
//
// dentro de la instancia:
//
//     admin.app('chatbot')
//
// ============================================================

exports.getStats = async (req, res) => {

    try {

        // ========================================================
        // COLECCIÓN DEL CHATBOT
        // ========================================================

        const sessionsRef =
            firestore.collection(
                'chatbot_sessions'
            );

        // ========================================================
        // TOTAL DE SESIONES
        // ========================================================

        const totalSnapshot =
            await sessionsRef
                .count()
                .get();

        const totalSessions =
            totalSnapshot
                .data()
                .count || 0;

        // ========================================================
        // SESIONES ACTIVAS
        // ÚLTIMA HORA
        // ========================================================

        const oneHourAgo =
            new Date(
                Date.now() -
                60 * 60 * 1000
            );

        const activeSnapshot =
            await sessionsRef
                .where(
                    'lastActivityAt',
                    '>=',
                    oneHourAgo
                )
                .count()
                .get();

        const activeSessions =
            activeSnapshot
                .data()
                .count || 0;

        // ========================================================
        // ESTADO FIREBASE
        // ========================================================

        const firebaseStatus =
            chatbotFirebase.getStatus();

        // ========================================================
        // RESPUESTA
        // ========================================================

        return res.json({

            success:
                true,

            stats: {

                totalSessions,

                activeSessions,

                timestamp:
                    new Date().toISOString()
            },

            firebase:
                firebaseStatus
        });

    } catch (error) {

        console.error(
            '[ChatbotController] Error en getStats:',
            error
        );

        return res.status(500).json({

            success: false,

            error:
                'Error obteniendo estadísticas'
        });
    }
};