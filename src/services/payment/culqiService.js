'use strict';

/**
 * ============================================================
 * CULQI SERVICE - ENTERPRISE FINTECH VERSION
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
});

/* ============================================================
 * CUSTOM ERROR
 * ============================================================
 */

class CulqiError extends Error {
    constructor({ code, message, statusCode = 500, details = null, retryable = false, provider = 'culqi' }) {
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
        this.baseURL = process.env.CULQI_BASE_URL || 'https://api.culqi.com/v2';
        this.failureCount = 0;
        this.circuitOpen = false;
        this.circuitOpenUntil = null;
        this.metrics = {
            requests: 0,
            failures: 0,
            retries: 0,
            circuitTrips: 0,
        };
        this.http = axios.create({
            baseURL: this.baseURL,
            timeout: CONFIG.timeout,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'CulqiService/3.0',
            },
        });
        this._setupInterceptors();
        logger.info('CulqiService initialized', {
            environment: process.env.NODE_ENV,
            baseURL: this.baseURL,
        });
    }

    _validateEnvironment() {
        if (!process.env.CULQI_SECRET_KEY) {
            throw new Error('CULQI_SECRET_KEY environment variable is required');
        }
    }

    _setupInterceptors() {
        this.http.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                this.metrics.requests++;
                logger.debug('Culqi request', {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    requestId: config.headers['X-Request-Id'],
                });
                if (config.data) {
                    logger.debug('Culqi payload', this._sanitizePayload(config.data));
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        this.http.interceptors.response.use(
            (response) => {
                this.failureCount = 0;
                const duration = Date.now() - response.config.metadata.startTime;
                logger.debug('Culqi response', {
                    status: response.status,
                    duration: `${duration}ms`,
                });
                return response;
            },
            (error) => {
                const status = error.response?.status;
                const shouldCountFailure = !status || status >= 500;
                if (shouldCountFailure) {
                    this.failureCount++;
                    this.metrics.failures++;
                }
                if (this.failureCount >= CONFIG.circuitMaxFailures && !this.circuitOpen) {
                    this._openCircuit();
                }
                return Promise.reject(this._transformError(error));
            }
        );
    }

    async createCharge(data) {
        this._checkCircuit();
        const normalized = this._normalizeChargeData(data);
        this._validateChargeData(normalized);
        const payload = this._buildChargePayload(normalized);
        const requestId = normalized.requestId || crypto.randomUUID();
        const idempotencyKey = normalized.idempotencyKey || crypto.randomUUID();

        try {
            logger.info('Creating Culqi charge', {
                requestId,
                amount: payload.amount,
                currency: payload.currency_code,
                email: this._maskEmail(normalized.email),
            });

            const response = await this.http.post('/charges', payload, {
                headers: {
                    'X-Request-Id': requestId,
                    'Idempotency-Key': idempotencyKey,
                },
            });

            logger.info('Culqi charge created successfully', {
                requestId,
                chargeId: response.data.id,
            });

            return this._transformChargeResponse(response.data);
        } catch (error) {
            if (error.retryable && normalized._retryCount < CONFIG.retries) {
                return this._retryCharge({ ...normalized });
            }
            throw error;
        }
    }

    async createOrder(data) {
        this._checkCircuit();

        const normalized = {
            amount: Number(data.amount),
            currency_code: data.currency_code || 'PEN',
            email: data.email?.trim()?.toLowerCase(),
            description: data.description || 'Compra Online',
            order_number: data.order_number || `ORD-${Date.now()}`,
            first_name: data.first_name || 'Cliente',
            last_name: data.last_name || 'Online',
            phone_number: String(data.phone_number || '999999999').replace(/\D/g, ''),
            metadata: this._sanitizeMetadata(data.metadata),
        };

        this._validateOrderData(normalized);

        const payload = {
            amount: Math.round(normalized.amount * 100),
            currency_code: normalized.currency_code,
            description: normalized.description,
            order_number: normalized.order_number,
            client_details: {
                first_name: normalized.first_name,
                last_name: normalized.last_name,
                email: normalized.email,
                phone_number: normalized.phone_number,
            },
            expiration_date: Math.floor(Date.now() / 1000) + 1800,
            confirm: false,
            metadata: normalized.metadata,
        };

        try {
            const response = await this.http.post('/orders', payload);
            return {
                id: response.data.id,
                order_number: response.data.order_number,
                amount: response.data.amount / 100,
                currency: response.data.currency_code,
                payment_code: response.data.payment_code,
                qr: response.data.qr || null,
                cuotealo: response.data.cuotealo || null,
                creation_date: response.data.creation_date,
                expiration_date: response.data.expiration_date,
                state: response.data.state,
                checkout_url: response.data.payment_url || response.data.url || null,
            };
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async captureOrder(orderId) {
        this._checkCircuit();
        if (!orderId) {
            throw new CulqiError({
                code: 'INVALID_ORDER_ID',
                message: 'Order ID requerido',
                statusCode: 400,
            });
        }
        try {
            const response = await this.http.post(`/orders/${orderId}/capture`);
            return response.data;
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async createToken(cardData) {
        try {
            const payload = {
                card_number: String(cardData.card_number).replace(/\s/g, ''),
                cvv: String(cardData.cvv),
                expiration_month: String(cardData.expiration_month).padStart(2, '0'),
                expiration_year: String(cardData.expiration_year),
                email: cardData.email?.trim()?.toLowerCase(),
            };
            const response = await this.http.post('/tokens', payload);
            return response.data;
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async refundCharge(chargeId, amount) {
        try {
            const response = await this.http.post('/refunds', {
                charge_id: chargeId,
                amount: Math.round(Number(amount) * 100),
                reason: 'solicitud_comprador',
            });
            return {
                id: response.data.id,
                charge_id: response.data.charge_id,
                amount: response.data.amount / 100,
                status: response.data.status,
            };
        } catch (error) {
            throw this._transformError(error);
        }
    }

    async getCharge(chargeId) {
        try {
            const response = await this.http.get(`/charges/${chargeId}`);
            return this._transformChargeResponse(response.data);
        } catch (error) {
            throw this._transformError(error);
        }
    }

    _normalizeChargeData(data) {
        return {
            ...data,
            amount: Number(data.amount),
            email: data.email?.trim()?.toLowerCase(),
            metadata: this._sanitizeMetadata(data.metadata),
            _retryCount: Number(data._retryCount || 0),
        };
    }

    _validateChargeData(data) {
        const errors = [];
        const token = data.token || data.source_id;

        // ✅ ÚNICO CAMBIO - Validación de token corregida
        const validToken = token && /^(tkn_|tok_)/.test(token);

        if (!validToken) {
            errors.push('Token inválido');
        }

        if (!data.amount || Number.isNaN(data.amount) || data.amount <= 0) {
            errors.push('Monto inválido');
        }

        if (!CONFIG.validCurrencies.includes(data.currency_code)) {
            errors.push('Moneda inválida');
        }

        if (!data.email || !validator.isEmail(data.email)) {
            errors.push('Email inválido');
        }

        if (errors.length) {
            throw new CulqiError({
                code: 'VALIDATION_ERROR',
                message: 'Datos de pago inválidos',
                details: errors,
                statusCode: 400,
            });
        }
    }

    _validateOrderData(data) {
        const errors = [];

        if (!data.amount || Number.isNaN(data.amount) || data.amount <= 0) {
            errors.push('Monto inválido');
        }

        if (!CONFIG.validCurrencies.includes(data.currency_code)) {
            errors.push('Moneda inválida');
        }

        if (!data.email || !validator.isEmail(data.email)) {
            errors.push('Email inválido');
        }

        if (errors.length) {
            throw new CulqiError({
                code: 'VALIDATION_ERROR',
                message: 'Datos de orden inválidos',
                details: errors,
                statusCode: 400,
            });
        }
    }

    _buildChargePayload(data) {
        return {
            amount: Math.round(data.amount * 100),
            currency_code: data.currency_code,
            email: data.email,
            source_id: data.token || data.source_id,
            description: data.description || `Pago realizado por ${data.email}`,
            capture: data.capture !== false,
            metadata: {
                internal_ref: data.order_id || `order_${Date.now()}`,
                ...(data.metadata || {}),
            },
            antifraud_details: data.antifraud_details || undefined,
        };
    }

    _transformChargeResponse(response) {
        return {
            id: response.id,
            amount: response.amount / 100,
            currency: response.currency_code,
            status: this._mapStatus(response.outcome?.type),
            paid: response.paid,
            customer: { email: response.email },
            payment_method: {
                brand: response.source?.brand,
                last4: response.source?.last_four,
            },
            created_at: new Date(response.creation_date * 1000),
            metadata: response.metadata || {},
            receipt_url: response.receipt_url || null,
        };
    }

    _mapStatus(status) {
        const map = {
            venta_exitosa: 'succeeded',
            venta_rechazada: 'failed',
            pendiente: 'pending',
            anulado: 'voided',
        };
        return map[status] || 'unknown';
    }

    async _retryCharge(data) {
        this.metrics.retries++;
        const retryData = {
            ...data,
            _retryCount: data._retryCount + 1,
        };
        const delay = CONFIG.retryDelay * Math.pow(2, retryData._retryCount);
        logger.warn('Retrying Culqi charge', {
            retry: retryData._retryCount,
            delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.createCharge(retryData);
    }

    _checkCircuit() {
        if (!this.circuitOpen) return;
        if (Date.now() >= this.circuitOpenUntil) {
            this.circuitOpen = false;
            this.failureCount = 0;
            logger.info('Circuit breaker closed');
            return;
        }
        throw new CulqiError({
            code: 'CIRCUIT_OPEN',
            message: 'Servicio temporalmente no disponible',
            statusCode: 503,
            retryable: true,
        });
    }

    _openCircuit() {
        this.circuitOpen = true;
        this.circuitOpenUntil = Date.now() + CONFIG.circuitTimeout;
        this.metrics.circuitTrips++;
        logger.warn('Circuit breaker opened', { failures: this.failureCount });
    }

    _sanitizePayload(payload) {
        const cloned = { ...payload };
        if (cloned.card_number) cloned.card_number = '****';
        if (cloned.cvv) cloned.cvv = '***';
        if (cloned.source_id) {
            cloned.source_id = cloned.source_id.slice(0, 8) + '****';
        }
        return cloned;
    }

    _sanitizeMetadata(metadata) {
        try {
            return JSON.parse(JSON.stringify(metadata || {}));
        } catch {
            return {};
        }
    }

    _maskEmail(email) {
        if (!email) return 'unknown';
        const [local, domain] = email.split('@');
        if (!local || !domain) return email;
        return `${local.slice(0, 2)}***@${domain}`;
    }

    _transformError(error) {
        if (error.culqiError) return error;
        if (error.code === 'ECONNABORTED') {
            return new CulqiError({
                code: 'TIMEOUT_ERROR',
                message: 'Timeout con Culqi',
                statusCode: 504,
                retryable: true,
            });
        }
        if (!error.response) {
            return new CulqiError({
                code: 'NETWORK_ERROR',
                message: 'Error de conexión con Culqi',
                statusCode: 503,
                retryable: true,
            });
        }
        return new CulqiError({
            code: error.response.data?.error_code || 'CULQI_ERROR',
            message: error.response.data?.merchant_message || error.response.data?.user_message || 'Error procesando pago',
            statusCode: error.response.status,
            details: error.response.data,
            retryable: error.response.status >= 500,
        });
    }

    async ping() {
        try {
            await this.http.get('/charges', { params: { limit: 1 }, timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            failureCount: this.failureCount,
            circuitOpen: this.circuitOpen,
        };
    }
}

module.exports = new CulqiService();