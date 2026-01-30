'use strict';

const express = require('express');
const router = express.Router();
const reclamoController = require('./controller');

// ✅ RUTA QUE DEBE USAR EL FRONTEND
router.post('/', reclamoController.procesarReclamo.bind(reclamoController));

// 📊 Estadísticas
router.get('/stats', reclamoController.getStats.bind(reclamoController));

// 🩺 Health check
router.get('/health', reclamoController.healthCheck.bind(reclamoController));

module.exports = router;