// src/api/v1/payments/routes.js

'use strict';

const express = require('express');
const crypto = require('crypto');

const paymentController = require('./controller');

const router = express.Router({ mergeParams: true });

const {
    NODE_ENV = 'production',
    npm_package_version,
    MAX_PAYMENT_AMOUNT,
} = process.env;

const DEFAULT_MAX_PAYMENT_AMOUNT = 500000;

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function createRequestId(prefix = 'req') {
    return `${prefix}_${crypto.randomUUID()}`;
}

function log(level, requestId, message, meta = {}) {
    const safeLevel = ['debug', 'info', 'warn', 'error'].includes(level)
        ? level
        : 'info';

    const payload = {
        level: safeLevel,
        requestId,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
    };

    console[safeLevel](JSON.stringify(payload));
}

function sendJson(res, statusCode, body) {
    return res.status(statusCode).json({
        ...body,
        timestamp: new Date().toISOString(),
    });
}

function getMaxPaymentAmount() {
    const configuredAmount = Number(MAX_PAYMENT_AMOUNT);

    if (!Number.isFinite(configuredAmount) || configuredAmount <= 0) {
        return DEFAULT_MAX_PAYMENT_AMOUNT;
    }

    return configuredAmount;
}

// ======================================================
// MIDDLEWARES
// ======================================================

router.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    next();
});

// ======================================================
// RUTAS DE PAGOS
// ======================================================

router.post('/', paymentController.processPayment);
router.post('/process', paymentController.processPayment);
router.get('/stats', paymentController.getStats);
router.get('/verify/:paymentId', paymentController.verifyPayment);

// Consultar estado de una orden (para polling YAPE/QR)
router.get('/orders/:orderId', paymentController.getOrderStatus);

// Crear orden para YAPE, PLIN, PagoEfectivo
router.post('/create-order', paymentController.createOrder);

// Generar QR para una orden existente
router.post('/orders/:orderId/checkout', paymentController.createOrderCheckout);

// ✅ WEBHOOK PARA CULQI (YAPE, QR, PAGOEFECTIVO)
router.post('/culqi-webhook', paymentController.handleCulqiWebhook.bind(paymentController));

// ======================================================
// RUTAS DE SALUD Y CONFIGURACIÓN
// ======================================================

router.get('/health', (req, res) => {
    return sendJson(res, 200, {
        success: true,
        service: 'payments-api',
        status: 'operational',
        environment: NODE_ENV,
        version: npm_package_version || '1.0.0',
        uptime: process.uptime(),
    });
});

router.get('/methods', (req, res) => {
    return sendJson(res, 200, {
        success: true,
        methods: [
            {
                type: 'card',
                provider: 'culqi',
                brands: ['Visa', 'Mastercard', 'American Express', 'Diners Club'],
                currencies: ['PEN', 'USD'],
                limits: {
                    min_amount: 1.0,
                    max_amount: getMaxPaymentAmount(),
                },
            },
        ],
    });
});

module.exports = router;