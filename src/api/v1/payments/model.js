// src/api/v1/payments/model.js
// Modelo de pagos – versión profesional, robusta y lista para producción

const mongoose = require('mongoose');

/**
 * Payment Schema
 * - Diseñado para integrarse con Culqi
 * - Cumple buenas prácticas de seguridad (no guarda datos sensibles)
 * - Optimizado con índices
 */
const paymentSchema = new mongoose.Schema(
  {
    /* =========================
     * DATOS BÁSICOS DEL PAGO
     * ========================= */
    amount: {
      type: Number,
      required: [true, 'El monto es requerido'],
      min: [0.01, 'El monto debe ser mayor a 0'],
      max: [500000, 'El monto excede el máximo permitido'],
    },

    currency: {
      type: String,
      enum: {
        values: ['PEN', 'USD'],
        message: 'Moneda no permitida',
      },
      default: 'PEN',
    },

    description: {
      type: String,
      required: [true, 'La descripción es requerida'],
      trim: true,
      maxlength: [255, 'La descripción no puede exceder 255 caracteres'],
    },

    /* =========================
     * INFORMACIÓN DEL CLIENTE
     * ========================= */
    customer_email: {
      type: String,
      required: [true, 'El email del cliente es requerido'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
      index: true,
    },

    customer_name: {
      type: String,
      trim: true,
      default: null,
    },

    /* =========================
     * ESTADO DEL PAGO
     * ========================= */
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },

    /* =========================
     * IDENTIFICADORES CULQI
     * ========================= */
    culqi_transaction_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    culqi_order_id: {
      type: String,
      default: null,
    },

    /* =========================
     * INFORMACIÓN DE TARJETA
     * (solo datos no sensibles)
     * ========================= */
    card_last_four: {
      type: String,
      minlength: 4,
      maxlength: 4,
      default: null,
    },

    card_brand: {
      type: String,
      enum: ['Visa', 'Mastercard', 'American Express', 'Diners Club', null],
      default: null,
    },

    /* =========================
     * METADATA / AUDITORÍA
     * ========================= */
    metadata: {
      type: Object,
      default: {},
    },

    failure_reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

/* =========================
 * MÉTODOS DE INSTANCIA
 * ========================= */

/**
 * Marca el pago como completado
 * @param {Object} culqiData
 */
paymentSchema.methods.markAsCompleted = async function (culqiData) {
  this.status = 'completed';
  this.culqi_transaction_id = culqiData.id;

  if (culqiData.source && culqiData.source.card_number) {
    this.card_last_four = culqiData.source.card_number.slice(-4);
    this.card_brand = culqiData.source.card_brand || null;
  }

  return this.save();
};

/**
 * Marca el pago como fallido
 * @param {String} reason
 */
paymentSchema.methods.markAsFailed = async function (reason) {
  this.status = 'failed';
  this.failure_reason = reason;
  this.metadata = {
    ...this.metadata,
    error: reason,
  };

  return this.save();
};

/**
 * Marca el pago como en procesamiento
 */
paymentSchema.methods.markAsProcessing = async function () {
  this.status = 'processing';
  return this.save();
};

/* =========================
 * MÉTODOS ESTÁTICOS
 * ========================= */

paymentSchema.statics.findByTransactionId = function (transactionId) {
  return this.findOne({ culqi_transaction_id: transactionId });
};

paymentSchema.statics.getStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        total: { $sum: 1 },
        amount: { $sum: '$amount' },
      },
    },
  ]);
};

/* =========================
 * EXPORTACIÓN DEL MODELO
 * ========================= */
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
