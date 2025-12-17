/**
 * ==========================================================
 * PAYMENT VALIDATORS
 * ==========================================================
 * Responsabilidad:
 * - Validar estructura y formato del request HTTP
 * - NO contiene lógica de negocio
 * - NO interactúa con servicios externos
 *
 * Esta capa protege al controller de datos inválidos.
 * ==========================================================
 */

'use strict';

const Joi = require('joi');

/* ==========================================================
 * CONSTANTES
 * ==========================================================
 */
const MAX_AMOUNT = Number(process.env.MAX_PAYMENT_AMOUNT || 500000);
const VALID_CURRENCIES = ['PEN', 'USD'];
const TOKEN_REGEX = /^tok_[a-zA-Z0-9]+$/;

/* ==========================================================
 * SCHEMAS BASE
 * ==========================================================
 */

/**
 * Metadata libre (pero controlada)
 */
const metadataSchema = Joi.object()
  .pattern(
    Joi.string().max(50),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean()
    )
  )
  .max(20)
  .messages({
    'object.max': 'Metadata excede el número máximo de campos permitidos',
  });

/**
 * Datos antifraude (opcional)
 */
const antifraudSchema = Joi.object({
  first_name: Joi.string().max(50).optional(),
  last_name: Joi.string().max(50).optional(),
  phone_number: Joi.string()
    .pattern(/^[0-9+]{6,15}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Número de teléfono inválido',
    }),
}).optional();

/* ==========================================================
 * SCHEMA PRINCIPAL: PROCESAR PAGO
 * ==========================================================
 */
const paymentSchema = Joi.object({
  token: Joi.string()
    .pattern(TOKEN_REGEX)
    .required()
    .messages({
      'string.pattern.base': 'Token inválido (formato incorrecto)',
      'any.required': 'El token es obligatorio',
      'string.empty': 'El token no puede estar vacío',
    }),

  amount: Joi.number()
    .positive()
    .precision(2)
    .max(MAX_AMOUNT)
    .required()
    .messages({
      'number.base': 'El monto debe ser numérico',
      'number.positive': 'El monto debe ser mayor a 0',
      'number.max': `El monto máximo permitido es ${MAX_AMOUNT / 100}`,
      'any.required': 'El monto es obligatorio',
    }),

  currency_code: Joi.string()
    .uppercase()
    .valid(...VALID_CURRENCIES)
    .default('PEN')
    .messages({
      'any.only': `Moneda no válida. Use: ${VALID_CURRENCIES.join(', ')}`,
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Email inválido',
      'any.required': 'El email es obligatorio',
      'string.empty': 'El email no puede estar vacío',
    }),

  description: Joi.string()
    .max(255)
    .optional()
    .allow('')
    .messages({
      'string.max': 'La descripción supera los 255 caracteres',
    }),

  metadata: metadataSchema.optional(),

  antifraud_details: antifraudSchema,
})
.options({
  abortEarly: false,
  stripUnknown: true,
});

/* ==========================================================
 * MIDDLEWARE DE VALIDACIÓN
 * ==========================================================
 */
const validatePayment = (req, res, next) => {
  const { error, value } = paymentSchema.validate(req.body);

  if (error) {
    const formattedErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error en los datos enviados',
        details: formattedErrors,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Sanitizado final
  req.body = value;
  next();
};

/* ==========================================================
 * EXPORTS
 * ==========================================================
 */
module.exports = {
  validatePayment,
  paymentSchema,
};
