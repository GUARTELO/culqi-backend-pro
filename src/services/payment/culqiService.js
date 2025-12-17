/**
 * ============================================================
 * CULQI SERVICE
 * ============================================================
 * Núcleo del sistema de pagos
 * - Comunicación directa con la API de Culqi
 * - Manejo de errores, retries, circuit breaker
 * - Transformación de requests y responses
 * - Aislado de Express (usable desde cualquier capa)
 * ============================================================
 */

'use strict';

const axios = require('axios');
const NodeCache = require('node-cache');
const logger = require('../../core/utils/logger');

/* ============================================================
 * CONSTANTES Y CONFIGURACIÓN
 * ============================================================
 */
const DEFAULT_TIMEOUT = 30000;
const CIRCUIT_MAX_FAILURES = 5;
const CIRCUIT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

const VALID_CURRENCIES = ['PEN', 'USD'];

/* ============================================================
 * CULQI SERVICE CLASS
 * ============================================================
 */
class CulqiService {
  constructor() {
    if (!process.env.CULQI_SECRET_KEY) {
      throw new Error('CULQI_SECRET_KEY no configurada');
    }

    this.secretKey = process.env.CULQI_SECRET_KEY;
    this.publicKey = process.env.CULQI_PUBLIC_KEY || null;
    this.baseURL = process.env.CULQI_BASE_URL || 'https://api.culqi.com/v2';

    /* =======================
     * CACHE
     * ======================= */
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 60,
      useClones: false,
    });

    /* =======================
     * CIRCUIT BREAKER
     * ======================= */
    this.failureCount = 0;
    this.circuitOpen = false;
    this.circuitOpenUntil = null;

    /* =======================
     * AXIOS INSTANCE
     * ======================= */
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `Culqi-Backend/${process.env.npm_package_version || '1.0.0'}`,
      },
    });

    this._setupInterceptors();

    logger.info('CulqiService inicializado', {
      baseURL: this.baseURL,
      environment: process.env.NODE_ENV,
    });
  }

  /* ============================================================
   * INTERCEPTORS
   * ============================================================
   */
  _setupInterceptors() {
    this.http.interceptors.request.use(
      config => {
        logger.debug('Culqi Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
        });

        if (config.data) {
          const safe = { ...config.data };
          if (safe.card_number) safe.card_number = '****';
          if (safe.cvv) safe.cvv = '***';
          if (safe.source_id) safe.source_id = 'tok_****';
          logger.debug('Culqi Payload', safe);
        }

        return config;
      },
      error => Promise.reject(error)
    );

    this.http.interceptors.response.use(
      response => {
        this.failureCount = 0;
        return response;
      },
      error => {
        this.failureCount++;

        if (this.failureCount >= CIRCUIT_MAX_FAILURES && !this.circuitOpen) {
          this.circuitOpen = true;
          this.circuitOpenUntil = Date.now() + CIRCUIT_TIMEOUT_MS;
          logger.warn('CIRCUIT BREAKER ABIERTO (Culqi)');
        }

        return Promise.reject(this._transformError(error));
      }
    );
  }

  /* ============================================================
   * CHARGES
   * ============================================================
   */
  async createCharge(data) {
    this._checkCircuit();

    this._validateChargeData(data);

    try {
      const payload = this._buildChargePayload(data);
      const response = await this.http.post('/charges', payload);
      return this._transformChargeResponse(response.data);
    } catch (error) {
      if (error.retryable && (data._retryCount || 0) < MAX_RETRIES) {
        return this._retryCharge(data, error);
      }
      throw error;
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

  async refundCharge(chargeId, amount) {
    try {
      const response = await this.http.post('/refunds', {
        charge_id: chargeId,
        amount: Math.round(amount * 100),
        reason: 'solicitud_comprador',
      });

      return {
        id: response.data.id,
        charge_id: response.data.charge_id,
        amount: response.data.amount / 100,
        status: response.data.status,
        created_at: new Date(response.data.creation_date * 1000),
      };
    } catch (error) {
      throw this._transformError(error);
    }
  }

  /* ============================================================
   * TOKEN (SOLO USO CONTROLADO)
   * ============================================================
   */
  async createToken(cardData) {
    const cacheKey = `token_${cardData.card_number}_${cardData.cvv}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.http.post('/tokens', {
        card_number: cardData.card_number.replace(/\s/g, ''),
        cvv: cardData.cvv,
        expiration_month: String(cardData.expiration_month).padStart(2, '0'),
        expiration_year: String(cardData.expiration_year).slice(-2),
        email: cardData.email,
      });

      this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this._transformError(error);
    }
  }

  /* ============================================================
   * VALIDACIONES
   * ============================================================
   */
  _validateChargeData(data) {
    const errors = [];

    if (!data.token || !data.token.startsWith('tok_')) {
      errors.push('Token inválido');
    }

    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
      errors.push('Monto inválido');
    }

    if (!VALID_CURRENCIES.includes(data.currency_code)) {
      errors.push('Moneda inválida');
    }

    if (!data.email) {
      errors.push('Email requerido');
    }

    if (errors.length) {
      throw {
        culqiError: true,
        code: 'VALIDATION_ERROR',
        message: 'Datos de pago inválidos',
        details: errors,
        statusCode: 400,
      };
    }
  }

  /* ============================================================
   * BUILDERS
   * ============================================================
   */
  _buildChargePayload(data) {
    return {
      amount: Math.round(data.amount * 100),
      currency_code: data.currency_code,
      email: data.email,
      source_id: data.token,
      description: data.description || `Pago ${data.email}`,
      capture: data.capture !== false,
      metadata: {
        ...data.metadata,
        internal_ref: data.order_id || `order_${Date.now()}`,
        ip: data.ip_address,
        session_id: data.session_id,
      },
      antifraud_details: data.antifraud_details || undefined,
    };
  }

  /* ============================================================
   * TRANSFORMACIONES
   * ============================================================
   */
  _transformChargeResponse(res) {
    return {
      id: res.id,
      amount: res.amount / 100,
      currency: res.currency_code,
      status: this._mapStatus(res.outcome?.type),
      paid: res.paid,
      payment_method: {
        brand: res.source?.brand,
        last4: res.source?.last_four,
      },
      customer: {
        email: res.email,
      },
      created_at: new Date(res.creation_date * 1000),
      receipt_url: res.receipt_url,
      metadata: res.metadata || {},
      _raw: process.env.NODE_ENV === 'development' ? res : undefined,
    };
  }

  _mapStatus(type) {
    const map = {
      venta_exitosa: 'succeeded',
      venta_rechazada: 'failed',
      pendiente: 'pending',
      anulado: 'voided',
    };
    return map[type] || 'unknown';
  }

  /* ============================================================
   * RETRIES
   * ============================================================
   */
  async _retryCharge(data, error) {
    data._retryCount = (data._retryCount || 0) + 1;
    const delay = BASE_RETRY_DELAY * Math.pow(2, data._retryCount);
    await new Promise(r => setTimeout(r, delay));
    return this.createCharge(data);
  }

  /* ============================================================
   * CIRCUIT BREAKER
   * ============================================================
   */
  _checkCircuit() {
    if (this.circuitOpen) {
      if (Date.now() < this.circuitOpenUntil) {
        throw {
          culqiError: true,
          code: 'CIRCUIT_OPEN',
          message: 'Servicio de pagos no disponible',
          statusCode: 503,
          retryable: true,
        };
      }
      this.circuitOpen = false;
      this.failureCount = 0;
    }
  }

  /* ============================================================
   * ERROR HANDLING
   * ============================================================
   */
  _transformError(error) {
    if (error.culqiError) return error;

    if (!error.response) {
      return {
        culqiError: true,
        code: 'NETWORK_ERROR',
        message: 'Error de conexión con Culqi',
        statusCode: 503,
        retryable: true,
      };
    }

    return {
      culqiError: true,
      code: 'CULQI_ERROR',
      message: error.response.data?.merchant_message || 'Error de pago',
      statusCode: error.response.status,
      details: error.response.data,
      retryable: error.response.status >= 500,
    };
  }

  /* ============================================================
   * HEALTHCHECK
   * ============================================================
   */
  async ping() {
    try {
      await this.http.get('/charges', { params: { limit: 1 }, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

/* ============================================================
 * SINGLETON EXPORT
 * ============================================================
 */
module.exports = new CulqiService();
