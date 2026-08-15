// ================================================================
// RUTAS DEL CHATBOT BRIONI
// ================================================================
// Ubicación:
// src/api/v1/chatbot/routes.js
// ================================================================
//
// IMPORTANTE:
//
// Este archivo NO accede directamente a Firebase.
//
// NO utilizar:
//
//     require('firebase-admin')
//
// NO utilizar:
//
//     admin.firestore()
//
// Las rutas solamente reciben las solicitudes y las entregan
// al controlador:
//
//     routes
//        ↓
//     controller
//        ↓
//     chatbotService
//        ↓
//     chatbotFirebase
//        ↓
//     admin.app('chatbot')
//        ↓
//     Firestore
//
// El Firebase principal:
//
//     src/core/config/firebase.js
//
// NO SE TOCA.
// ================================================================

const express =
    require('express');

const rateLimit =
    require('express-rate-limit');

const chatbotController =
    require('./controller');

const router =
    express.Router();

// ================================================================
// RATE LIMITING ESPECÍFICO DEL CHATBOT
// ================================================================

// ================================================================
// CHAT
// 30 mensajes por minuto
// ================================================================

const chatLimiter =
    rateLimit({

        windowMs:
            60 * 1000,

        max:
            30,

        message: {

            success:
                false,

            error:
                'Demasiados mensajes. Por favor, espera un momento.',

            code:
                'RATE_LIMIT_EXCEEDED'
        },

        standardHeaders:
            true,

        legacyHeaders:
            false
    });

// ================================================================
// CONSULTAS DE PEDIDOS
// 10 consultas por minuto
// ================================================================

const orderLimiter =
    rateLimit({

        windowMs:
            60 * 1000,

        max:
            10,

        message: {

            success:
                false,

            error:
                'Demasiadas consultas de pedido. Por favor, espera.',

            code:
                'RATE_LIMIT_EXCEEDED'
        },

        standardHeaders:
            true,

        legacyHeaders:
            false
    });

// ================================================================
// BÚSQUEDA DE PRODUCTOS
// 20 búsquedas por minuto
// ================================================================

const searchLimiter =
    rateLimit({

        windowMs:
            60 * 1000,

        max:
            20,

        message: {

            success:
                false,

            error:
                'Demasiadas búsquedas. Por favor, espera.',

            code:
                'RATE_LIMIT_EXCEEDED'
        },

        standardHeaders:
            true,

        legacyHeaders:
            false
    });

// ================================================================
// ENDPOINTS
// ================================================================

// ================================================================
// POST /api/v1/chatbot/message
//
// Procesa un mensaje del usuario.
//
// Body:
//
// {
//     message,
//     phone,
//     channel
// }
// ================================================================

router.post(
    '/message',
    chatLimiter,
    chatbotController.processMessage
);

// ================================================================
// GET /api/v1/chatbot/orders/:orderNumber
//
// Consulta el estado de un pedido.
//
// Ejemplo:
//
// /api/v1/chatbot/orders/BR-2026-1234
// ================================================================

router.get(
    '/orders/:orderNumber',
    orderLimiter,
    chatbotController.getOrder
);

// ================================================================
// GET /api/v1/chatbot/products/search
//
// Busca productos.
//
// Query:
//
// ?q=blazer
// ================================================================

router.get(
    '/products/search',
    searchLimiter,
    chatbotController.searchProducts
);

// ================================================================
// POST /api/v1/chatbot/notify-human
//
// Solicita atención humana.
//
// Body:
//
// {
//     phone
// }
// ================================================================

router.post(
    '/notify-human',
    chatLimiter,
    chatbotController.notifyHuman
);

// ================================================================
// GET /api/v1/chatbot/health
//
// Health check del chatbot.
//
// Este endpoint es atendido por el controller,
// que verifica exclusivamente la instancia Firebase
// del chatbot.
// ================================================================

router.get(
    '/health',
    chatbotController.healthCheck
);

// ================================================================
// GET /api/v1/chatbot/stats
//
// Estadísticas del chatbot.
//
// El controller consulta exclusivamente:
//
//     chatbot_sessions
//
// mediante:
//
//     admin.app('chatbot')
// ================================================================

router.get(
    '/stats',
    chatbotController.getStats
);

// ================================================================
// EXPORTAR ROUTER
// ================================================================

module.exports =
    router;