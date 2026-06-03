'use strict';

/**
 * ============================================================
 * CULQI SERVICE - MODERN ENTERPRISE VERSION
 * ============================================================
 */

const axios = require('axios');
const crypto = require('crypto');
const validator = require('validator');

const logger = require('../../core/utils/logger');

/* ============================================================
 * CONFIG
 * ============================================================
 */

const CONFIG = Object.freeze({
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    circuitMaxFailures: 5,
    circuitTimeout: 30000,

    validCurrencies: ['PEN', 'USD'],

    minimumAmounts: {
        PEN: 3,
        USD: 1
    }
});

/* ============================================================
 * CUSTOM ERROR
 * ============================================================
 */

class CulqiError extends Error {
    constructor({
        code,
        message,
        statusCode = 500,
        details = null,
        retryable = false,
        provider = 'culqi'
    }) {
        super(message);

        this.name = 'CulqiError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.retryable = retryable;
        this.provider = provider;
        this.culqiError = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/* ============================================================
 * SERVICE
 * ============================================================
 */

class CulqiService {
    constructor() {
        this._validateEnvironment();

        this.secretKey = process.env.CULQI_SECRET_KEY;

        this.webhookSecret =
            process.env.CULQI_WEBHOOK_SECRET || '';

        this.baseURL =
            process.env.CULQI_BASE_URL ||
            'https://api.culqi.com/v2';

        this.failureCount = 0;
        this.circuitOpen = false;
        this.circuitOpenUntil = null;

        this.metrics = {
            requests: 0,
            failures: 0,
            retries: 0,
            circuitTrips: 0,
            webhooks: 0
        };

        this.http = axios.create({
            baseURL: this.baseURL,
            timeout: CONFIG.timeout,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'CulqiService/4.0'
            }
        });

        this._setupInterceptors();


        logger.info('CulqiService initialized', {
            environment: process.env.NODE_ENV,
            baseURL: this.baseURL
        });
        
    }

    /* ============================================================
     * ENVIRONMENT
     * ============================================================
     */

    _validateEnvironment() {
        if (!process.env.CULQI_SECRET_KEY) {
            throw new Error(
                'CULQI_SECRET_KEY environment variable is required'
            );
        }
    }

    /* ============================================================
     * INTERCEPTORS
     * ============================================================
     */

    _setupInterceptors() {
        this.http.interceptors.request.use(
            (config) => {
                config.metadata = {
                    startTime: Date.now()
                };

                this.metrics.requests++;

                logger.debug('Culqi request', {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    requestId: config.headers['X-Request-Id']
                });

                if (config.data) {
                    logger.debug(
                        'Culqi payload',
                        this._sanitizePayload(config.data)
                    );
                }

                return config;
            },
            (error) => Promise.reject(error)
        );

        this.http.interceptors.response.use(
            (response) => {
                this.failureCount = 0;

                const duration =
                    Date.now() -
                    response.config.metadata.startTime;

                logger.debug('Culqi response', {
                    status: response.status,
                    duration: `${duration}ms`
                });

                return response;
            },
            (error) => {
                const status = error.response?.status;

                const shouldCountFailure =
                    !status || status >= 500;

                if (shouldCountFailure) {
                    this.failureCount++;
                    this.metrics.failures++;
                }

                if (
                    this.failureCount >=
                        CONFIG.circuitMaxFailures &&
                    !this.circuitOpen
                ) {
                    this._openCircuit();
                }

                return Promise.reject(
                    this._transformError(error)
                );
            }
        );
    }

  /* ============================================================
     * HELPERS (NUEVO)
     * ============================================================
     */

    _safeString(value) {
        if (!value) return undefined;
        const str = String(value).trim();
        return str.length > 0 ? str : undefined;
    }


  /* ============================================================
 * CHARGES
 * ============================================================
 */

async createCharge(data) {

    this._checkCircuit();

    // ============================================================
    // NORMALIZAR DATA
    // ============================================================

    const normalized =
        this._normalizeChargeData(data);

    // ============================================================
    // VALIDAR
    // ============================================================

    this._validateChargeData(normalized);

    // ============================================================
    // CONSTRUIR PAYLOAD
    // ============================================================

    const payload =
        this._buildChargePayload(normalized);

    // ============================================================
    // REQUEST IDS
    // ============================================================

    const requestId =
        normalized.requestId ||
        crypto.randomUUID();

    const idempotencyKey =
        normalized.idempotencyKey ||
        crypto.randomUUID();

    try {

        // ============================================================
        // LOG PRINCIPAL
        // ============================================================

        logger.info('Creating Culqi charge', {
            requestId,
            amount: payload.amount,
            currency: payload.currency_code,
            email: this._maskEmail(
                normalized.email
            )
        });

        // ============================================================
        // LOG PAYLOAD COMPLETO SANITIZADO
        // ============================================================

        logger.info(
            '🔥 PAYLOAD ENVIADO A CULQI',
            this._sanitizePayload(payload)
        );

        // ============================================================
        // REQUEST A CULQI
        // ============================================================

        const response = await this.http.post(
            '/charges',
            payload,
            {
                headers: {
                    'X-Request-Id': requestId,
                    'Idempotency-Key':
                        idempotencyKey
                }
            }
        );

        // ============================================================
        // SUCCESS
        // ============================================================

        logger.info(
            '✅ Culqi charge created successfully',
            {
                requestId,
                chargeId: response.data.id,
                outcome:
                    response.data?.outcome?.type,
                paid:
                    response.data?.paid,
                amount:
                    response.data?.amount,
                currency:
                    response.data?.currency_code
            }
        );

        // ============================================================
        // RESPONSE TRANSFORMADA
        // ============================================================

        return this._transformChargeResponse(
            response.data
        );

    } catch (error) {

        // ============================================================
        // ERROR LOG DETALLADO
        // ============================================================

        logger.error(
            '💥 ERROR CREANDO CHARGE EN CULQI',
            {
                requestId,
                errorCode: error.code,
                message: error.message,
                statusCode: error.statusCode,
                retryable: error.retryable,
                details: error.details
            }
        );

        // ============================================================
        // RETRY AUTOMÁTICO
        // ============================================================

        if (
            error.retryable &&
            normalized._retryCount <
                CONFIG.retries
        ) {

            logger.warn(
                '🔁 RETRY AUTOMÁTICO ACTIVADO',
                {
                    retry:
                        normalized._retryCount + 1,
                    maxRetries:
                        CONFIG.retries
                }
            );

            return this._retryCharge({
                ...normalized
            });
        }

        throw error;
    }
}

    /* ============================================================
     * ORDERS
     * ============================================================
     */

    async createOrder(data) {
        this._checkCircuit();

        const normalized = {
            amount: Number(data.amount),

            currency_code:
                data.currency_code || 'PEN',

            email: data.email
                ?.trim()
                ?.toLowerCase(),

            description:
                data.description ||
                'Compra Online',

            order_number:
                data.order_number ||
                `ORD-${Date.now()}`,

            first_name:
                data.first_name || 'Cliente',

            last_name:
                data.last_name || 'Online',

            phone_number: String(
                data.phone_number ||
                    '999999999'
            ).replace(/\D/g, ''),

            confirm: Boolean(data.confirm),

            metadata: this._sanitizeMetadata(
                data.metadata
            )
        };

        this._validateOrderData(normalized);

        const payload = {
            amount: Math.round(
                normalized.amount * 100
            ),

            currency_code:
                normalized.currency_code,

            description:
                normalized.description,

            order_number:
                normalized.order_number,

            client_details: {
                first_name:
                    normalized.first_name,

                last_name:
                    normalized.last_name,

                email: normalized.email,

                phone_number:
                    normalized.phone_number
            },

            expiration_date:
                Math.floor(Date.now() / 1000) +
                1800,

            confirm: normalized.confirm,

            metadata: {
                source: 'checkout-js',
                integration: 'enterprise',
                ...(normalized.metadata || {})
            }
        };

        try {
            const response = await this.http.post(
                '/orders',
                payload,
                {
                    headers: {
                        'Idempotency-Key':
                            crypto.randomUUID()
                    }
                }
            );

            return this._transformOrderResponse(
                response.data
            );
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async confirmOrder(orderId) {
        this._checkCircuit();

        if (!orderId) {
            throw new CulqiError({
                code: 'INVALID_ORDER_ID',
                message:
                    'Order ID requerido',
                statusCode: 400
            });
        }

        try {
            const response =
                await this.http.post(
                    `/orders/${orderId}/confirm`,
                    {},
                    {
                        headers: {
                            'Idempotency-Key':
                                crypto.randomUUID()
                        }
                    }
                );

            return this._transformOrderResponse(
                response.data
            );
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async captureOrder(orderId) {
        this._checkCircuit();

        if (!orderId) {
            throw new CulqiError({
                code: 'INVALID_ORDER_ID',
                message:
                    'Order ID requerido',
                statusCode: 400
            });
        }

        try {
            const response =
                await this.http.post(
                    `/orders/${orderId}/capture`,
                    {},
                    {
                        headers: {
                            'Idempotency-Key':
                                crypto.randomUUID()
                        }
                    }
                );

            return this._transformOrderResponse(
                response.data
            );
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async getOrder(orderId) {
        try {
            const response =
                await this.http.get(
                    `/orders/${orderId}`
                );

            return this._transformOrderResponse(
                response.data
            );
        } catch (error) {
            throw this._transformError(error);
        }
    }

    /* ============================================================
     * REFUNDS
     * ============================================================
     */

    async refundCharge(chargeId, amount) {
        try {
            const response = await this.http.post(
                '/refunds',
                {
                    charge_id: chargeId,

                    amount: Math.round(
                        Number(amount) * 100
                    ),

                    reason:
                        'solicitud_comprador'
                },
                {
                    headers: {
                        'Idempotency-Key':
                            crypto.randomUUID()
                    }
                }
            );

            return {
                id: response.data.id,

                charge_id:
                    response.data.charge_id,

                amount:
                    response.data.amount / 100,

                status:
                    response.data.status
            };
        } catch (error) {
            throw this._transformError(error);
        }
    }

    /* ============================================================
     * GET CHARGE
     * ============================================================
     */

    async getCharge(chargeId) {
        try {
            const response =
                await this.http.get(
                    `/charges/${chargeId}`
                );

            return this._transformChargeResponse(
                response.data
            );
        } catch (error) {
            throw this._transformError(error);
        }
    }

    /* ============================================================
     * WEBHOOKS
     * ============================================================
     */

    verifyWebhookSignature(payload, signature) {
        if (!this.webhookSecret) {
            logger.warn(
                'CULQI_WEBHOOK_SECRET not configured'
            );

            return true;
        }

        const expectedSignature =
            crypto
                .createHmac(
                    'sha256',
                    this.webhookSecret
                )
                .update(payload)
                .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature || '')
        );
    }

    parseWebhookEvent(payload) {
        this.metrics.webhooks++;

        let body = payload;

        if (typeof payload === 'string') {
            body = JSON.parse(payload);
        }

        return {
            event: body.event || 'unknown',
            data: body.data || {},
            type: body.type || null,
            created_at: new Date()
        };
    }

    normalizeWebhookStatus(eventType) {
        const map = {
            'charge.success':
                'succeeded',

            'charge.failed':
                'failed',

            'order.paid':
                'paid',

            'order.expired':
                'expired',

            'refund.success':
                'refunded',

            'payment.pending':
                'pending'
        };

        return (
            map[eventType] || 'unknown'
        );
    }

    /* ============================================================
     * NORMALIZATION
     * ============================================================
     */

    _normalizeChargeData(data) {
        return {
            ...data,

            amount: Number(data.amount),

            email: data.email
                ?.trim()
                ?.toLowerCase(),

            metadata:
                this._sanitizeMetadata(
                    data.metadata
                ),

            _retryCount: Number(
                data._retryCount || 0
            )
        };
    }

    /* ============================================================
     * VALIDATION
     * ============================================================
     */

    _validateChargeData(data) {
        const errors = [];

        const token =
            data.token ||
            data.source_id;

        const validToken =
            typeof token === 'string' &&
            /^[a-zA-Z0-9_-]+$/.test(
                token
            ) &&
            token.length >= 10;

        if (!validToken) {
            errors.push(
                'Token/source_id inválido'
            );
        }

        if (
            !data.amount ||
            Number.isNaN(data.amount) ||
            data.amount <= 0
        ) {
            errors.push('Monto inválido');
        }

        if (
            data.amount <
            CONFIG.minimumAmounts[
                data.currency_code
            ]
        ) {
            errors.push(
                `Monto mínimo para ${data.currency_code}`
            );
        }

        if (
            !CONFIG.validCurrencies.includes(
                data.currency_code
            )
        ) {
            errors.push(
                'Moneda inválida'
            );
        }

        if (
            data.email &&
            !validator.isEmail(data.email)
        ) {
            errors.push('Email inválido');
        }

        if (errors.length) {
            throw new CulqiError({
                code: 'VALIDATION_ERROR',
                message:
                    'Datos de pago inválidos',
                details: errors,
                statusCode: 400
            });
        }
    }

    _validateOrderData(data) {
        const errors = [];

        if (
            !data.amount ||
            Number.isNaN(data.amount) ||
            data.amount <= 0
        ) {
            errors.push('Monto inválido');
        }

        if (
            data.amount <
            CONFIG.minimumAmounts[
                data.currency_code
            ]
        ) {
            errors.push(
                `Monto mínimo para ${data.currency_code}`
            );
        }

        if (
            !CONFIG.validCurrencies.includes(
                data.currency_code
            )
        ) {
            errors.push(
                'Moneda inválida'
            );
        }

        if (
            data.email &&
            !validator.isEmail(data.email)
        ) {
            errors.push('Email inválido');
        }

        if (errors.length) {
            throw new CulqiError({
                code: 'VALIDATION_ERROR',
                message:
                    'Datos de orden inválidos',
                details: errors,
                statusCode: 400
            });
        }
    }

    /* ============================================================
     * BUILDERS
     * ============================================================
     */

    _buildChargePayload(data) {

    // ============================================================
    // NORMALIZACIÓN SEGURA CLIENTE
    // ============================================================

    const firstName =
        String(
            data.first_name ||
            data.firstName ||
            data.nombre ||
            'Cliente'
        )
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 50);

    const lastName =
        String(
            data.last_name ||
            data.lastName ||
            data.apellido ||
            data.surname ||
            'GoldInfiniti'
        )
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 50);

    // ⚠️ Culqi NO acepta vacío
    const safeLastName =
        lastName.length > 0
            ? lastName
            : 'GoldInfiniti';

    const safeFirstName =
        firstName.length > 0
            ? firstName
            : 'Cliente';

    // ============================================================
    // TELÉFONO
    // ============================================================

    const phone =
        String(
            data.phone ||
            data.phone_number ||
            data.celular ||
            data.telefono ||
            '999999999'
        )
            .replace(/\D/g, '')
            .substring(0, 15);

    // ============================================================
    // DNI / DOCUMENTO
    // ============================================================

    const documentNumber =
        String(
            data.dni ||
            data.document_number ||
            data.cliente_dni ||
            '00000000'
        )
            .replace(/\D/g, '')
            .substring(0, 15);

    // ============================================================
// DIRECCIÓN (CULQI SAFE - PRODUCCIÓN)
// ============================================================

const rawAddress =
    data.address ??
    data.direccion ??
    'Lima, Perú';

const cleanAddress =
    String(rawAddress)
        .replace(/\s+/g, ' ')      // espacios múltiples
        .replace(/[\n\r\t]/g, '')  // caracteres raros
        .trim();

const address =
    cleanAddress &&
    cleanAddress.toLowerCase() !== 'undefined' &&
    cleanAddress.toLowerCase() !== 'null' &&
    cleanAddress.length >= 5
        ? cleanAddress.substring(0, 100)
        : 'Lima, Perú';

const addressCity =
    String(data.city || data.ciudad || 'Lima')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);

const country =
    String(data.country || 'PE')
        .replace(/\s+/g, '')
        .trim()
        .substring(0, 2);

    // ============================================================
    // LOGS DEBUG
    // ============================================================

    logger.info('🧾 DATOS CLIENTE NORMALIZADOS', {
        firstName: safeFirstName,
        lastName: safeLastName,
        phone,
        documentNumber,
        email: data.email,
    });

    // ============================================================
    // PAYLOAD MODERNO CULQI
    // ============================================================

    const payload = {
        amount: Math.round(Number(data.amount) * 100),

        currency_code: data.currency_code || 'PEN',

        email: data.email,

        source_id: data.token || data.source_id,

        description:
            data.description ||
            `Compra GoldInfiniti - ${data.email}`,

        capture: data.capture !== false,

        // ========================================================
        // DEVICE / FRAUD
        // ========================================================

        device_fingerprint:
            data.device_fingerprint ||
            data.deviceFingerprint ||
            undefined,

        antifraud_details: {
            address,
            address_city: addressCity,
            country_code: country,
            first_name: safeFirstName,
            last_name: safeLastName,
            phone_number: phone,

            object: 'client',

            ...(data.antifraud_details || {}),
        },

        // ========================================================
        // CUSTOMER DETAILS
        // ========================================================

        customer_details: {
            first_name: safeFirstName,
            last_name: safeLastName,
            email: data.email,
            phone_number: phone,
        },

        // ========================================================
        // METADATA
        // ========================================================

        metadata: {
            internal_ref:
                data.order_id ||
                `order_${Date.now()}`,

            dni: documentNumber,

            customer_name:
                `${safeFirstName} ${safeLastName}`,

            integration: 'goldinfiniti-v3',

            environment:
                process.env.NODE_ENV || 'development',

            created_at:
                new Date().toISOString(),

            ...(data.metadata || {}),
        },
    };

    // ============================================================
    // LOG FINAL
    // ============================================================

    logger.info('📤 PAYLOAD FINAL CULQI', {
        amount: payload.amount,
        currency: payload.currency_code,
        email: payload.email,
        customer: payload.customer_details,
        antifraud: payload.antifraud_details,
    });

    return payload;
}

    /* ============================================================
     * TRANSFORMERS
     * ============================================================
     */

    _transformChargeResponse(response) {
        return {
            id: response.id,

            object:
                response.object,

            amount:
                response.amount / 100,

            currency:
                response.currency_code,

            status: this._mapStatus(
                response.outcome?.type
            ),

            paid: response.paid,

            outcome:
                response.outcome,

            customer: {
                email:
                    response.email
            },

            payment_method: {
                brand:
                    response.source
                        ?.brand,

                last4:
                    response.source
                        ?.last_four,

                type:
                    response.source
                        ?.type
            },

            created_at: new Date(
                response.creation_date *
                    1000
            ),

            metadata:
                response.metadata || {},

            receipt_url:
                response.receipt_url ||
                null
        };
    }

    _transformOrderResponse(response) {
        return {
            id: response.id,

            order_number:
                response.order_number,

            amount:
                response.amount / 100,

            currency:
                response.currency_code,

            payment_code:
                response.payment_code,

            qr:
                response.qr || null,

            cuotealo:
                response.cuotealo ||
                null,

            state:
                response.state,

            status:
                this._normalizeOrderStatus(
                    response.state
                ),

            checkout_url:
                response.payment_url ||
                response.url ||
                null,

            created_at:
                response.creation_date
                    ? new Date(
                          response.creation_date *
                              1000
                      )
                    : null,

            expiration_date:
                response.expiration_date
                    ? new Date(
                          response.expiration_date *
                              1000
                      )
                    : null,

            metadata:
                response.metadata || {}
        };
    }

    _normalizeOrderStatus(status) {
        const map = {
            pending: 'pending',
            paid: 'paid',
            expired: 'expired',
            cancelled: 'cancelled'
        };

        return (
            map[status] || 'unknown'
        );
    }

    _mapStatus(status) {
        const map = {
            venta_exitosa:
                'succeeded',

            venta_rechazada:
                'failed',

            pendiente:
                'pending',

            anulado:
                'voided'
        };

        return (
            map[status] || 'unknown'
        );
    }

    /* ============================================================
     * RETRIES
     * ============================================================
     */

    async _retryCharge(data) {
        this.metrics.retries++;

        const retryData = {
            ...data,

            _retryCount:
                data._retryCount + 1
        };

        const delay =
            CONFIG.retryDelay *
            Math.pow(
                2,
                retryData._retryCount
            );

        logger.warn(
            'Retrying Culqi charge',
            {
                retry:
                    retryData._retryCount,

                delay
            }
        );

        await new Promise((resolve) =>
            setTimeout(resolve, delay)
        );

        return this.createCharge(
            retryData
        );
    }

    /* ============================================================
     * CIRCUIT BREAKER
     * ============================================================
     */

    _checkCircuit() {
        if (!this.circuitOpen) return;

        if (
            Date.now() >=
            this.circuitOpenUntil
        ) {
            this.circuitOpen = false;

            this.failureCount = 0;

            logger.info(
                'Circuit breaker closed'
            );

            return;
        }

        throw new CulqiError({
            code: 'CIRCUIT_OPEN',

            message:
                'Servicio temporalmente no disponible',

            statusCode: 503,

            retryable: true
        });
    }

    _openCircuit() {
        this.circuitOpen = true;

        this.circuitOpenUntil =
            Date.now() +
            CONFIG.circuitTimeout;

        this.metrics.circuitTrips++;

        logger.warn(
            'Circuit breaker opened',
            {
                failures:
                    this.failureCount
            }
        );
    }

    /* ============================================================
     * HELPERS
     * ============================================================
     */

    _sanitizePayload(payload) {

    const cloned = JSON.parse(JSON.stringify(payload || {}));

    // ============================================================
    // TARJETA
    // ============================================================

    if (cloned.card_number) {
        cloned.card_number = '****';
    }

    if (cloned.cvv) {
        cloned.cvv = '***';
    }

    // ============================================================
    // TOKENS
    // ============================================================

    if (cloned.source_id) {
        cloned.source_id =
            cloned.source_id.slice(0, 10) + '****';
    }

    // ============================================================
    // EMAIL
    // ============================================================

    if (cloned.email) {
        cloned.email = this._maskEmail(cloned.email);
    }

    // ============================================================
    // CUSTOMER DETAILS
    // ============================================================

    if (cloned.customer_details?.phone_number) {
        cloned.customer_details.phone_number = '********';
    }

    if (cloned.antifraud_details?.phone_number) {
        cloned.antifraud_details.phone_number = '********';
    }

    // ============================================================
    // DNI
    // ============================================================

    if (cloned.metadata?.dni) {
        cloned.metadata.dni = '********';
    }

    return cloned;
}

    _sanitizeMetadata(metadata) {
        try {
            return JSON.parse(
                JSON.stringify(
                    metadata || {}
                )
            );
        } catch {
            return {};
        }
    }

    _maskEmail(email) {
        if (!email)
            return 'unknown';

        const [local, domain] =
            email.split('@');

        if (!local || !domain)
            return email;

        return `${local.slice(
            0,
            2
        )}***@${domain}`;
    }

    /* ============================================================
     * ERRORS
     * ============================================================
     */

    _transformError(error) {
        if (error.culqiError)
            return error;

        if (
            error.code ===
            'ECONNABORTED'
        ) {
            return new CulqiError({
                code: 'TIMEOUT_ERROR',

                message:
                    'Timeout con Culqi',

                statusCode: 504,

                retryable: true
            });
        }

        if (!error.response) {
            return new CulqiError({
                code: 'NETWORK_ERROR',

                message:
                    'Error de conexión con Culqi',

                statusCode: 503,

                retryable: true
            });
        }

        return new CulqiError({
            code:
                error.response.data
                    ?.error_code ||
                'CULQI_ERROR',

            message:
                error.response.data
                    ?.merchant_message ||
                error.response.data
                    ?.user_message ||
                'Error procesando pago',

            statusCode:
                error.response.status,

            details:
                error.response.data,

            retryable:
                error.response.status >=
                500
        });
    }

    /* ============================================================
     * HEALTHCHECK
     * ============================================================
     */

    async ping() {
        try {
            await this.http.get(
                '/charges',
                {
                    params: {
                        limit: 1
                    },

                    timeout: 5000
                }
            );

            return true;
        } catch {
            return false;
        }
    }

    /* ============================================================
     * METRICS
     * ============================================================
     */

    getMetrics() {
        return {
            ...this.metrics,

            failureCount:
                this.failureCount,

            circuitOpen:
                this.circuitOpen
        };
    }
}

module.exports = new CulqiService();