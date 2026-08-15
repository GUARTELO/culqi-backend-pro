// ================================================================
// RUTAS DEL CHATBOT
// ================================================================
// Ubicación: src/api/v1/chatbot/routes.js
// ================================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const chatbotController = require('./controller');

// ============================================================
// RATE LIMITING ESPECÍFICO
// ============================================================
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // 30 mensajes por minuto
    message: {
        success: false,
        error: 'Demasiados mensajes. Por favor, espera un momento.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Demasiadas consultas de pedido. Por favor, espera.',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Demasiadas búsquedas. Por favor, espera.',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

// ============================================================
// ENDPOINTS
// ============================================================

/**
 * POST /api/v1/chatbot/message
 * Procesa un mensaje del usuario
 * Body: { message, phone, channel }
 */
router.post('/message', chatLimiter, chatbotController.processMessage);

/**
 * GET /api/v1/chatbot/orders/:orderNumber
 * Consulta el estado de un pedido
 */
router.get('/orders/:orderNumber', orderLimiter, chatbotController.getOrder);

/**
 * GET /api/v1/chatbot/products/search
 * Busca productos por nombre
 * Query: ?q=termino
 */
router.get('/products/search', searchLimiter, chatbotController.searchProducts);

/**
 * POST /api/v1/chatbot/notify-human
 * Notifica al administrador
 * Body: { phone }
 */
router.post('/notify-human', chatLimiter, chatbotController.notifyHuman);

/**
 * GET /api/v1/chatbot/health
 * Health check
 */
router.get('/health', chatbotController.healthCheck);

/**
 * GET /api/v1/chatbot/stats
 * Estadísticas del chatbot
 */
router.get('/stats', chatbotController.getStats);

// ============================================================
// EXPORTAR
// ============================================================
module.exports = router;