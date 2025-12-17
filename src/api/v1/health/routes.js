// src/api/v1/health/routes.js
const express = require('express');
const router = express.Router();
const healthController = require('./controller'); // ← CAMBIAR A healthController

// ============================================
// RUTAS DE HEALTH (NO DE PAYMENT)
// ============================================

// ✅ RUTAS GET PARA HEALTH CHECK
router.get('/', healthController.healthCheck);           // Health básico
router.get('/detailed', healthController.detailedHealthCheck); // Detallado
router.get('/ready', healthController.readinessCheck);   // Ready check
router.get('/live', healthController.livenessCheck);     // Live check

// ❌ ELIMINA ESTAS (NO PERTENECEN A HEALTH):
// router.post('/', paymentController.processPayment); // ← ELIMINAR
// router.get('/stats', paymentController.getStats);   // ← ELIMINAR
// router.get('/verify/:paymentId', paymentController.verifyPayment); // ← ELIMINAR

module.exports = router;