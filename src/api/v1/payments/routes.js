// src/api/v1/payments/routes.js

'use strict';

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const paymentController = require('./controller');

const router = express.Router({ mergeParams: true });

const {
    NODE_ENV = 'development',
    npm_package_version,
    MAX_PAYMENT_AMOUNT,
    CULQI_WEBHOOK_SECRET,
    WEBHOOK_SIGNATURE_REQUIRED,
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} = process.env;

const IS_PRODUCTION = NODE_ENV === 'production';
const REQUIRE_WEBHOOK_SIGNATURE =
    IS_PRODUCTION || WEBHOOK_SIGNATURE_REQUIRED === 'true';

const MAX_WEBHOOK_TIMESTAMP_DRIFT_SECONDS =
    Number(WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) || 300;

const DEFAULT_MAX_PAYMENT_AMOUNT = 500000;
const WEBHOOK_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const processedWebhookEvents = new Map();

const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many webhook requests',
    },
});

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

function getHeader(req, name) {
    const value = req.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
}

function normalizeSignature(signature) {
    if (!signature || typeof signature !== 'string') {
        return null;
    }

    return signature.trim().replace(/^sha256=/i, '');
}

function isValidHex(value) {
    return typeof value === 'string' && /^[a-f0-9]+$/i.test(value);
}

function verifyHmacSha256Signature({ signature, rawBody, secretKey }) {
    const receivedSignature = normalizeSignature(signature);

    if (!receivedSignature || !rawBody || !secretKey) {
        return false;
    }

    if (!isValidHex(receivedSignature)) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('hex');

    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function validateWebhookTimestamp(timestamp) {
    if (!timestamp) {
        return true;
    }

    const parsedTimestamp = Number(timestamp);

    if (!Number.isFinite(parsedTimestamp)) {
        return false;
    }

    const timestampMs =
        parsedTimestamp > 9999999999
            ? parsedTimestamp
            : parsedTimestamp * 1000;

    const driftSeconds = Math.abs(Date.now() - timestampMs) / 1000;

    return driftSeconds <= MAX_WEBHOOK_TIMESTAMP_DRIFT_SECONDS;
}

function validateWebhookPayload(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
        return {
            valid: false,
            reason: 'Payload must be an object',
        };
    }

    if (!event.type || typeof event.type !== 'string') {
        return {
            valid: false,
            reason: 'Missing event type',
        };
    }

    if (!event.data || typeof event.data !== 'object') {
        return {
            valid: false,
            reason: 'Missing event data',
        };
    }

    return {
        valid: true,
        reason: null,
    };
}

function getWebhookEventId(event) {
    return (
        event.id ||
        event.event_id ||
        event.data?.id ||
        `${event.type}:${event.data?.id || crypto
            .createHash('sha256')
            .update(JSON.stringify(event))
            .digest('hex')}`
    );
}

function cleanExpiredWebhookEvents() {
    const now = Date.now();

    for (const [eventId, registeredAt] of processedWebhookEvents.entries()) {
        if (now - registeredAt > WEBHOOK_IDEMPOTENCY_TTL_MS) {
            processedWebhookEvents.delete(eventId);
        }
    }
}

function isDuplicateWebhookEvent(eventId) {
    cleanExpiredWebhookEvents();

    if (processedWebhookEvents.has(eventId)) {
        return true;
    }

    processedWebhookEvents.set(eventId, Date.now());
    return false;
}

function getMaxPaymentAmount() {
    const configuredAmount = Number(MAX_PAYMENT_AMOUNT);

    if (!Number.isFinite(configuredAmount) || configuredAmount <= 0) {
        return DEFAULT_MAX_PAYMENT_AMOUNT;
    }

    return configuredAmount;
}

router.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    next();
});

router.post('/', paymentController.processPayment);

router.post('/process', paymentController.processPayment);

router.get('/stats', paymentController.getStats);

router.get('/verify/:paymentId', paymentController.verifyPayment);

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
                brands: [
                    'Visa',
                    'Mastercard',
                    'American Express',
                    'Diners Club',
                ],
                currencies: ['PEN', 'USD'],
                limits: {
                    min_amount: 1.0,
                    max_amount: getMaxPaymentAmount(),
                },
            },
        ],
    });
});

async function handleWebhookEvent(event, requestId) {
    const eventType = event.type;
    const eventData = event.data;

    log('info', requestId, 'Webhook event received', {
        eventType,
        eventId: getWebhookEventId(event),
    });

    switch (eventType) {
        case 'charge.completed': {
            const charge = eventData;

            log('info', requestId, 'Payment completed', {
                chargeId: charge.id,
                amount: typeof charge.amount === 'number'
                    ? charge.amount / 100
                    : null,
                currency: charge.currency || null,
                orderId: charge.order_id || charge.metadata?.order_id || null,
            });

            /*
             * Aqui debe ir la integracion real con tu sistema:
             * - Buscar orden/viaje por metadata u order_id.
             * - Validar monto y moneda contra tu base de datos.
             * - Marcar pago como aprobado.
             * - Activar el viaje/servicio correspondiente.
             * - Guardar el webhook recibido para auditoria.
             */

            break;
        }

        case 'charge.failed': {
            const charge = eventData;

            log('warn', requestId, 'Payment failed', {
                chargeId: charge.id,
                failureCode: charge.failure_code || null,
                failureMessage: charge.failure_message || null,
            });

            /*
             * Aqui corresponde marcar el pago como fallido
             * y notificar al cliente si aplica.
             */

            break;
        }

        case 'refund.completed': {
            const refund = eventData;

            log('info', requestId, 'Refund completed', {
                refundId: refund.id,
                chargeId: refund.charge_id || null,
                amount: typeof refund.amount === 'number'
                    ? refund.amount / 100
                    : null,
            });

            /*
             * Aqui corresponde actualizar el estado del reembolso
             * y conciliar el pago original.
             */

            break;
        }

        default:
            log('info', requestId, 'Unhandled webhook event', {
                eventType,
            });
    }

    return eventType;
}

router.post('/webhook', webhookLimiter, async (req, res) => {
    const requestId = req.id || createRequestId('wh');

    try {
        const event = req.body;
        const payloadValidation = validateWebhookPayload(event);

        if (!payloadValidation.valid) {
            log('warn', requestId, 'Invalid webhook payload', {
                reason: payloadValidation.reason,
            });

            return sendJson(res, 400, {
                success: false,
                error: 'Invalid payload',
            });
        }

        if (REQUIRE_WEBHOOK_SIGNATURE) {
            const signature =
                getHeader(req, 'x-culqi-signature') ||
                getHeader(req, 'culqi-signature') ||
                getHeader(req, 'x-signature');

            const timestamp =
                getHeader(req, 'x-culqi-timestamp') ||
                getHeader(req, 'x-webhook-timestamp');

            if (!CULQI_WEBHOOK_SECRET) {
                log('error', requestId, 'CULQI_WEBHOOK_SECRET not configured');

                return sendJson(res, 500, {
                    success: false,
                    error: 'Webhook configuration error',
                });
            }

            if (!signature) {
                log('warn', requestId, 'Missing webhook signature');

                return sendJson(res, 401, {
                    success: false,
                    error: 'Missing signature',
                });
            }

            if (!req.rawBody) {
                log('error', requestId, 'Missing raw body for signature verification');

                return sendJson(res, 500, {
                    success: false,
                    error: 'Webhook raw body not configured',
                });
            }

            if (!validateWebhookTimestamp(timestamp)) {
                log('warn', requestId, 'Invalid webhook timestamp', {
                    timestamp,
                });

                return sendJson(res, 401, {
                    success: false,
                    error: 'Invalid timestamp',
                });
            }

            const isValidSignature = verifyHmacSha256Signature({
                signature,
                rawBody: req.rawBody,
                secretKey: CULQI_WEBHOOK_SECRET,
            });

            if (!isValidSignature) {
                log('warn', requestId, 'Invalid webhook signature');

                return sendJson(res, 401, {
                    success: false,
                    error: 'Invalid signature',
                });
            }

            log('info', requestId, 'Webhook signature verified');
        }

        const eventId = getWebhookEventId(event);

        if (isDuplicateWebhookEvent(eventId)) {
            log('info', requestId, 'Duplicate webhook ignored', {
                eventId,
                eventType: event.type,
            });

            return sendJson(res, 200, {
                success: true,
                received: true,
                duplicate: true,
                event: event.type,
                requestId,
            });
        }

        const eventType = await handleWebhookEvent(event, requestId);

        return sendJson(res, 200, {
            success: true,
            received: true,
            event: eventType,
            requestId,
        });
    } catch (error) {
        log('error', requestId, 'Webhook processing error', {
            error: error.message,
            stack: IS_PRODUCTION ? undefined : error.stack,
        });

        return sendJson(res, 500, {
            success: false,
            received: false,
            requestId,
            error: IS_PRODUCTION
                ? 'Webhook processing failed'
                : error.message,
        });
    }
});

if (!IS_PRODUCTION) {
    router.get('/test', (req, res) => {
        return sendJson(res, 200, {
            success: true,
            message: 'Payment API operational',
            environment: NODE_ENV,
            signatureRequired: REQUIRE_WEBHOOK_SIGNATURE,
            available_endpoints: [
                'POST   /api/v1/payments',
                'POST   /api/v1/payments/process',
                'GET    /api/v1/payments/stats',
                'GET    /api/v1/payments/verify/:paymentId',
                'GET    /api/v1/payments/health',
                'GET    /api/v1/payments/methods',
                'POST   /api/v1/payments/webhook',
            ],
        });
    });
}

module.exports = router;