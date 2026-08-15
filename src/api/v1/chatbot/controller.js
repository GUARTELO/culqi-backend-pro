// ================================================================
// CONTROLADOR DEL CHATBOT
// ================================================================
// Ubicación: src/api/v1/chatbot/controller.js
// ================================================================

const chatbotService = require('../../../services/chatbotService');

// ============================================================
// PROCESAR MENSAJE DEL USUARIO
// ============================================================
exports.processMessage = async (req, res) => {
    try {
        const { message, phone, channel } = req.body;

        // Validaciones
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'El mensaje es obligatorio',
                code: 'MESSAGE_REQUIRED'
            });
        }

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'El teléfono es obligatorio',
                code: 'PHONE_REQUIRED'
            });
        }

        // Limpiar teléfono
        const cleanPhone = phone.replace(/\D/g, '');
        const channelType = channel || 'web';

        console.log(`[ChatbotController] Mensaje de ${cleanPhone}: "${message}"`);

        // Procesar mensaje
        const response = await chatbotService.processMessage(message, cleanPhone, channelType);

        res.json({
            success: true,
            response: response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ChatbotController] Error en processMessage:', error);
        res.status(500).json({
            success: false,
            error: 'Error procesando el mensaje'
        });
    }
};

// ============================================================
// CONSULTAR PEDIDO POR NÚMERO
// ============================================================
exports.getOrder = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        if (!orderNumber) {
            return res.status(400).json({
                success: false,
                error: 'Número de pedido obligatorio',
                code: 'ORDER_NUMBER_REQUIRED'
            });
        }

        // Validar formato
        if (!/^(BR-?\d{4}-?\d{4}|BR-\d{4}-\d{4})$/i.test(orderNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de pedido inválido. Ejemplo: BR-2026-1234',
                code: 'INVALID_ORDER_FORMAT'
            });
        }

        const response = await chatbotService.getOrderStatus(orderNumber);

        res.json({
            success: true,
            response: response,
            orderNumber: orderNumber.toUpperCase(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ChatbotController] Error en getOrder:', error);
        res.status(500).json({
            success: false,
            error: 'Error consultando el pedido'
        });
    }
};

// ============================================================
// BUSCAR PRODUCTOS
// ============================================================
exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'El término de búsqueda es obligatorio',
                code: 'SEARCH_TERM_REQUIRED'
            });
        }

        if (q.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'La búsqueda debe tener al menos 2 caracteres',
                code: 'SEARCH_TERM_TOO_SHORT'
            });
        }

        if (q.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'La búsqueda no puede exceder los 50 caracteres',
                code: 'SEARCH_TERM_TOO_LONG'
            });
        }

        const response = await chatbotService.searchProducts(q);

        res.json({
            success: true,
            response: response,
            query: q,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ChatbotController] Error en searchProducts:', error);
        res.status(500).json({
            success: false,
            error: 'Error buscando productos'
        });
    }
};

// ============================================================
// NOTIFICAR A ASESOR HUMANO
// ============================================================
exports.notifyHuman = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'El teléfono es obligatorio',
                code: 'PHONE_REQUIRED'
            });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const response = await chatbotService.transferToHuman(cleanPhone);

        res.json({
            success: true,
            response: response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ChatbotController] Error en notifyHuman:', error);
        res.status(500).json({
            success: false,
            error: 'Error notificando al administrador'
        });
    }
};

// ============================================================
// HEALTH CHECK
// ============================================================
exports.healthCheck = async (req, res) => {
    try {
        const admin = require('firebase-admin');
        let firebaseStatus = 'ok';
        try {
            await admin.firestore().collection('chatbot_sessions').limit(1).get();
        } catch (e) {
            firebaseStatus = 'error';
        }

        res.json({
            success: true,
            service: 'Chatbot Brioni',
            status: 'operational',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            checks: {
                firebase: firebaseStatus,
                email: process.env.EMAIL_USER ? 'configured' : 'not_configured'
            }
        });

    } catch (error) {
        console.error('[ChatbotController] Error en healthCheck:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
};

// ============================================================
// ESTADÍSTICAS
// ============================================================
exports.getStats = async (req, res) => {
    try {
        const admin = require('firebase-admin');
        const firestore = admin.firestore();
        const sessionsRef = firestore.collection('chatbot_sessions');
        
        const totalSnapshot = await sessionsRef.count().get();
        const totalSessions = totalSnapshot.data().count || 0;

        // Sesiones activas (última hora)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const activeSnapshot = await sessionsRef
            .where('lastActivityAt', '>=', oneHourAgo)
            .count()
            .get();
        const activeSessions = activeSnapshot.data().count || 0;

        res.json({
            success: true,
            stats: {
                totalSessions,
                activeSessions,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[ChatbotController] Error en getStats:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo estadísticas'
        });
    }
};